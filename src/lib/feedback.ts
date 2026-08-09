/**
 * Tactile feedback: audio + haptics.
 *
 * Sound is synthesized with WebAudio rather than shipped as assets — a few
 * oscillators cost nothing and never need loading.
 *
 * Haptics are the hard part on the web. `navigator.vibrate` has never been
 * supported by Safari on iOS, so the obvious implementation is silently dead
 * on the flagship platform. See `buzz()` for the workaround.
 *
 * Both channels are opt-out and both fail silently on unsupported devices.
 */

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(next: boolean) {
  muted = next;
}
export function isMuted() {
  return muted;
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || muted) return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  // Browsers suspend the context until a user gesture; resume is a no-op
  // once it is already running.
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/* ── Audio ────────────────────────────────────────────────────────────── */

/**
 * A single oscillator with an ADSR-ish envelope.
 *
 * The previous version ramped one gain node with a fixed curve, which made
 * every sound the same shape — a plink. Attack and release are separated here
 * because that shape is most of a sound's character: a fast attack reads as a
 * tap, a slow one as a swell.
 */
function tone(opts: {
  freq: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  delay?: number;
  /** Sweep to this frequency over the note — what makes a sound feel alive. */
  glideTo?: number;
  /** Slight detune in cents; two of these together give a chorus. */
  detune?: number;
}) {
  const ac = audio();
  if (!ac) return;

  const {
    freq,
    dur = 0.12,
    type = 'sine',
    gain = 0.12,
    attack = 0.008,
    delay = 0,
    glideTo,
    detune = 0,
  } = opts;

  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const amp = ac.createGain();

  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);

  // A gentle low-pass takes the edge off square/saw without dulling sines.
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.max(1200, freq * 4), t0);

  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(filter).connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

/** Two detuned voices — thicker and warmer than a bare oscillator. */
function chord(
  freq: number,
  opts: Omit<Parameters<typeof tone>[0], 'freq'>
) {
  tone({ ...opts, freq, detune: -6 });
  tone({ ...opts, freq, detune: 7, gain: (opts.gain ?? 0.12) * 0.6 });
}

/**
 * Filtered noise — the "body" under a hit. Pure oscillators sound synthetic;
 * a short noise transient is what makes a tap read as something touching
 * something.
 */
function noise(opts: { dur?: number; gain?: number; freq?: number } = {}) {
  const ac = audio();
  if (!ac) return;
  const { dur = 0.05, gain = 0.05, freq = 2200 } = opts;

  const frames = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    // Decay inside the buffer so the transient dies immediately.
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }

  const src = ac.createBufferSource();
  src.buffer = buffer;

  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 0.9;

  const amp = ac.createGain();
  amp.gain.setValueAtTime(gain, ac.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);

  src.connect(bp).connect(amp).connect(ac.destination);
  src.start();
}

/* ── Haptics ──────────────────────────────────────────────────────────── */

/**
 * iOS fallback: since iOS 18, toggling an `<input type="checkbox" switch>`
 * emits a real system haptic. Clicking a hidden one inside a user gesture is
 * the only way to get Taptic feedback from Safari, which exposes no haptic API.
 *
 * The tick is a fixed system pattern — its strength can't be varied. So on iOS
 * the vocabulary is RHYTHM: how many ticks and how they're spaced. Patterns
 * below are designed so rhythm alone distinguishes them with the screen off.
 */
let hapticLabel: HTMLLabelElement | null = null;

function switchEl(): HTMLLabelElement | null {
  if (typeof document === 'undefined') return null;
  if (hapticLabel?.isConnected) return hapticLabel;

  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText =
    'position:fixed;top:-9999px;left:-9999px;width:0;height:0;' +
    'opacity:0;pointer-events:none;overflow:hidden';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  label.appendChild(input);

  document.body.appendChild(label);
  hapticLabel = label;
  return label;
}

function iosTicks(gaps: number[]) {
  const label = switchEl();
  if (!label) return;
  let at = 0;
  label.click();
  for (const gap of gaps) {
    at += gap;
    setTimeout(() => label.click(), at);
  }
}

/**
 * @param pattern Android vibrate pattern (ms, alternating on/off).
 * @param gaps    iOS rhythm: gaps in ms between successive ticks.
 */
function buzz(pattern: number | number[], gaps: number[]) {
  if (typeof navigator === 'undefined' || muted) return;

  // Android/Chromium: the real API, with real durations.
  if ('vibrate' in navigator) {
    try {
      if (navigator.vibrate(pattern)) return;
    } catch {
      /* fall through to the iOS path */
    }
  }

  try {
    iosTicks(gaps);
  } catch {
    /* no haptics available — audio and motion still carry the feedback */
  }
}

/* ── The vocabulary ───────────────────────────────────────────────────── */

/**
 * Escalation is deliberate and should be legible with the screen off. The
 * previous set was near-uniform — 8ms vs 14ms vs 24ms is not a distinction any
 * hand can feel — so both the durations and the RHYTHMS are now spread wide:
 * one light tick to select, a firm double to bank, a broken triple to reject,
 * an accelerating run for the prize, a long roll for completion.
 */
export const feedback = {
  /** A letter joins the current word — the lightest thing we can do. */
  tap() {
    noise({ dur: 0.03, gain: 0.035, freq: 3000 });
    tone({ freq: 620, dur: 0.045, type: 'triangle', gain: 0.07 });
    buzz(10, []);
  },

  /** Word accepted into the grid. Rises with each word in the puzzle. */
  correct(step = 0) {
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    const f = scale[Math.min(step, scale.length - 1)];
    noise({ dur: 0.04, gain: 0.05, freq: 2400 });
    chord(f, { dur: 0.2, type: 'sine', gain: 0.13, attack: 0.006 });
    // A fifth above, quieter and slightly late — a chime, not a beep.
    tone({ freq: f * 1.5, dur: 0.26, gain: 0.05, delay: 0.045 });
    buzz([26, 40, 22], [58]);
  },

  /** Valid word, but not one of the grid targets — lighter than a target. */
  bonus() {
    noise({ dur: 0.03, gain: 0.04, freq: 2800 });
    tone({ freq: 698.46, dur: 0.16, gain: 0.1, glideTo: 880 });
    buzz(16, []);
  },

  /** Not a word. A falling, broken shape — legible without sound. */
  reject() {
    noise({ dur: 0.05, gain: 0.05, freq: 700 });
    tone({ freq: 240, dur: 0.16, type: 'sawtooth', gain: 0.09, glideTo: 150 });
    buzz([18, 55, 18], [95]);
  },

  /** Already found — a nudge, deliberately duller than either accept. */
  duplicate() {
    tone({ freq: 380, dur: 0.07, type: 'triangle', gain: 0.06 });
    buzz(8, []);
  },

  /** A hint spent. Downward, so it reads as a cost, not a reward. */
  spend() {
    tone({ freq: 560, dur: 0.13, type: 'sine', gain: 0.08, glideTo: 380 });
    buzz([12, 30, 12], [60]);
  },

  /**
   * The prize word — every letter used. The biggest sound in the game: a
   * rising major arpeggio with the root sustained under it.
   */
  prize() {
    noise({ dur: 0.06, gain: 0.06, freq: 2000 });
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      chord(f, { dur: 0.34, gain: 0.12, delay: i * 0.075, attack: 0.005 })
    );
    tone({ freq: 261.63, dur: 0.75, gain: 0.07, attack: 0.03 });
    // Accelerating run — unmistakable against every other pattern.
    buzz([30, 45, 30, 40, 30, 35, 55], [70, 60, 50]);
  },

  /** Puzzle cleared. Slower and broader than the prize — an ending. */
  complete() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      chord(f, { dur: 0.42, gain: 0.11, delay: i * 0.1 })
    );
    tone({ freq: 392, dur: 1.1, gain: 0.06, attack: 0.05, delay: 0.2 });
    buzz([24, 60, 24, 60, 24, 60, 60], [95, 95, 130]);
  },
};
