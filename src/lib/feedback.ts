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
/*
 * Haptics are a SEPARATE channel from audio.
 *
 * `buzz` used to return early on `muted`, so silencing the game also silenced
 * the taptic feedback — and the player who mutes because they are in a meeting
 * is exactly the player who most needs the other channel. Muting sound should
 * mute sound.
 */
let hapticsMuted = false;

export function setMuted(next: boolean) {
  muted = next;
}
export function isMuted() {
  return muted;
}

export function setHapticsMuted(next: boolean) {
  hapticsMuted = next;
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

/**
 * One bus for every voice, with a limiter on it.
 *
 * Everything used to connect straight to `destination`. `prize()` stacks four
 * chords — eight oscillators — at 75ms spacing with 340ms decays, over a
 * sustain and a noise burst; the summed peak comfortably exceeds 1.0. So the
 * biggest moment in the game was the one most likely to hard-clip, and
 * clipping on a phone speaker reads as a broken app rather than a triumph.
 */
let bus: GainNode | null = null;
function output(ac: AudioContext): GainNode {
  if (bus) return bus;
  const gain = ac.createGain();
  gain.gain.value = 0.45;
  const limiter = ac.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.ratio.value = 6;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.12;
  gain.connect(limiter).connect(ac.destination);
  bus = gain;
  return bus;
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

  osc.connect(filter).connect(amp).connect(output(ac));
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

  src.connect(bp).connect(amp).connect(output(ac));
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
 * One rhythm, described once.
 *
 * `pulses[i]` buzzes, then `gaps[i]` of silence, then `pulses[i + 1]`. So a
 * rhythm always has exactly one more pulse than it has gaps.
 *
 * WHY THIS TYPE EXISTS. The two platforms were previously given the rhythm
 * SEPARATELY — an Android `vibrate` array and an iOS gap list — and they
 * disagreed on six of the eight signals. `iosTicks` fires once and then once
 * per gap, so it always played `gaps.length + 1` ticks, while the hand-written
 * Android arrays carried one fewer pulse than the comment beside them claimed.
 *
 * The damage was not cosmetic. On Android `bonus` played a single pulse, which
 * is exactly what `tap` plays — so finding a word felt identical to touching a
 * letter. `correct` and `duplicate` both came out as two pulses, so the reward
 * and the "you already had that" shared a rhythm. This module's own comment
 * says the vocabulary must be "legible with the screen off"; on Android half of
 * it was not legible at all.
 *
 * Deriving both platforms from one description makes that class of drift
 * impossible rather than merely fixed, and `feedback.test.ts` asserts the
 * invariant.
 */
export type Rhythm = { pulses: number[]; gaps: number[] };

/** Android `vibrate()` wants [on, off, on, off, ... on]. */
export function androidPattern(r: Rhythm): number[] {
  const out: number[] = [];
  r.pulses.forEach((p, i) => {
    out.push(p);
    if (i < r.gaps.length) out.push(r.gaps[i]);
  });
  return out;
}

/** How many distinct bumps the hand should feel, on any platform. */
export function pulseCount(r: Rhythm): number {
  return r.pulses.length;
}

function buzz(r: Rhythm) {
  if (typeof navigator === 'undefined' || hapticsMuted) return;

  // Android/Chromium: the real API, with real durations.
  if ('vibrate' in navigator) {
    try {
      if (navigator.vibrate(androidPattern(r))) return;
    } catch {
      /* fall through to the iOS path */
    }
  }

  try {
    iosTicks(r.gaps);
  } catch {
    /* no haptics available — audio and motion still carry the feedback */
  }
}

/**
 * The rhythms, named.
 *
 * Exported so the test can assert the vocabulary is actually distinguishable,
 * which is the part of "does this feel right" that does not need a device in a
 * hand: two signals that share a pulse count AND a gap pattern are the same
 * signal, whatever the design intent was.
 */
export const RHYTHM = {
  /** One tick, the lightest thing available. */
  tap: { pulses: [10], gaps: [] },
  /** Fast triple — the reward. */
  correct: { pulses: [26, 22, 26], gaps: [45, 45] },
  /** Fast double — clearly not a bare tap. */
  bonus: { pulses: [16, 16], gaps: [45] },
  /** Long-then-short, broken on purpose. */
  reject: { pulses: [18, 18, 18], gaps: [110, 45] },
  /** Slow double — nothing happened. */
  duplicate: { pulses: [8, 8], gaps: [150] },
  /** One wide gap, deliberately heavy and slow — a cost. */
  spend: { pulses: [12, 12], gaps: [190] },
  /** Accelerating run — unmistakable against everything else. */
  prize: { pulses: [30, 30, 30, 30, 55], gaps: [70, 60, 50, 45] },
  /** Decelerating — an ending, not a reward. */
  complete: { pulses: [24, 24, 24, 24, 60], gaps: [100, 100, 140, 180] },
} satisfies Record<string, Rhythm>;

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
    buzz(RHYTHM.tap);
  },

  /** Word accepted into the grid. Rises with each word in the puzzle. */
  correct(step = 0) {
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    const f = scale[Math.min(step, scale.length - 1)];
    noise({ dur: 0.04, gain: 0.05, freq: 2400 });
    chord(f, { dur: 0.2, type: 'sine', gain: 0.13, attack: 0.006 });
    // A fifth above, quieter and slightly late — a chime, not a beep.
    tone({ freq: f * 1.5, dur: 0.26, gain: 0.05, delay: 0.045 });
    buzz(RHYTHM.correct);
  },

  /** Valid word, but not one of the grid targets — lighter than a target. */
  bonus() {
    noise({ dur: 0.03, gain: 0.04, freq: 2800 });
    tone({ freq: 698.46, dur: 0.16, gain: 0.1, glideTo: 880 });
    buzz(RHYTHM.bonus);
  },

  /** Not a word. A falling, broken shape — legible without sound. */
  reject() {
    noise({ dur: 0.05, gain: 0.05, freq: 700 });
    tone({ freq: 240, dur: 0.16, type: 'sawtooth', gain: 0.09, glideTo: 150 });
    buzz(RHYTHM.reject);
  },

  /** Already found — a nudge, deliberately duller than either accept. */
  duplicate() {
    tone({ freq: 380, dur: 0.07, type: 'triangle', gain: 0.06 });
    buzz(RHYTHM.duplicate);
  },

  /** A hint spent. Downward, so it reads as a cost, not a reward. */
  spend() {
    tone({ freq: 560, dur: 0.13, type: 'sine', gain: 0.08, glideTo: 380 });
    buzz(RHYTHM.spend);
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
    buzz(RHYTHM.prize);
  },

  /** Puzzle cleared. Slower and broader than the prize — an ending. */
  complete() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      chord(f, { dur: 0.42, gain: 0.11, delay: i * 0.1 })
    );
    tone({ freq: 392, dur: 1.1, gain: 0.06, attack: 0.05, delay: 0.2 });
    buzz(RHYTHM.complete);
  },
};
