/**
 * Tactile feedback: audio + haptics.
 *
 * Sound is synthesized with WebAudio rather than shipped as assets — a few
 * oscillator blips cost nothing and never need loading.
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

function blip(freq: number, duration = 0.09, type: OscillatorType = 'sine') {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  gain.gain.setValueAtTime(0.0001, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.14, ac.currentTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + duration + 0.02);
}

/* ── Haptics ──────────────────────────────────────────────────────────── */

/**
 * iOS fallback: since iOS 18, toggling an `<input type="checkbox" switch>`
 * emits a real system haptic. Clicking a hidden one inside a user gesture is
 * the only way to get Taptic feedback from Safari, which exposes no haptic API.
 *
 * The tick is a fixed system pattern — we cannot vary its strength. So on iOS
 * the vocabulary is expressed purely as RHYTHM (how many ticks, how spaced),
 * while Android varies duration too. Patterns below are designed so the rhythm
 * alone distinguishes them.
 */
let hapticLabel: HTMLLabelElement | null = null;

function switchEl(): HTMLLabelElement | null {
  if (typeof document === 'undefined') return null;
  if (hapticLabel?.isConnected) return hapticLabel;

  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  // Must be in the layout tree for the click to register, but must never be
  // visible, focusable, or hit-testable.
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

function iosTicks(count: number, gap: number) {
  const label = switchEl();
  if (!label) return;
  for (let i = 0; i < count; i += 1) {
    if (i === 0) label.click();
    else setTimeout(() => label.click(), i * gap);
  }
}

/**
 * @param pattern Android vibrate pattern (ms, alternating on/off).
 * @param ticks   iOS rhythm: [count, gap-in-ms].
 */
function buzz(pattern: number | number[], ticks: [number, number]) {
  if (typeof navigator === 'undefined' || muted) return;

  // Android/Chromium: the real API, with real durations.
  if ('vibrate' in navigator) {
    try {
      if (navigator.vibrate(pattern)) return;
    } catch {
      /* fall through to the iOS path */
    }
  }

  // iOS Safari: rhythm only.
  try {
    iosTicks(ticks[0], ticks[1]);
  } catch {
    /* no haptics available — audio and motion still carry the feedback */
  }
}

/* ── The vocabulary ───────────────────────────────────────────────────── */

/**
 * Escalation is deliberate and should be legible with the screen off:
 * one tick to select, two to bank, three broken ticks to reject, a run for
 * completion. Nothing here is decoration.
 */
export const feedback = {
  /** A letter joins the current word — the lightest thing we can do. */
  tap() {
    blip(520, 0.05, 'triangle');
    buzz(8, [1, 0]);
  },
  /** Word accepted into the grid. The one moment that gets a chord. */
  correct(step = 0) {
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    blip(scale[Math.min(step, scale.length - 1)], 0.14, 'sine');
    buzz(24, [2, 70]);
  },
  /** Valid word, but not one of the grid targets — lighter than a target. */
  bonus() {
    blip(698.46, 0.1, 'sine');
    buzz(14, [1, 0]);
  },
  /** Not a word. Broken rhythm reads as "no" without needing sound. */
  reject() {
    blip(180, 0.13, 'sawtooth');
    buzz([14, 60, 14], [2, 130]);
  },
  /** Already found — a nudge, deliberately duller than either accept. */
  duplicate() {
    blip(340, 0.07, 'triangle');
    buzz(6, [1, 0]);
  },
  /** Puzzle cleared. The only run of ticks in the whole vocabulary. */
  complete() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      setTimeout(() => blip(f, 0.22, 'sine'), i * 95)
    );
    buzz([20, 60, 20, 60, 20, 60, 45], [5, 110]);
  },
};
