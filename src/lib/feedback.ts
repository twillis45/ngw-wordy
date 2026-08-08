/**
 * Tactile feedback. Sound is synthesized with WebAudio rather than shipped as
 * assets — a few oscillator blips cost nothing and never need loading.
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

function buzz(pattern: number | number[]) {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* iOS Safari has no vibrate; nothing to do */
  }
}

export const feedback = {
  /** A letter joins the current word. */
  tap() {
    blip(520, 0.05, 'triangle');
    buzz(8);
  },
  /** Word accepted into the grid. The one moment that gets a chord. */
  correct(step = 0) {
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    blip(scale[Math.min(step, scale.length - 1)], 0.14, 'sine');
    buzz(18);
  },
  /** Valid word, but not one of the grid targets. */
  bonus() {
    blip(698.46, 0.1, 'sine');
    buzz(12);
  },
  /** Not a word. */
  reject() {
    blip(180, 0.13, 'sawtooth');
    buzz([12, 40, 12]);
  },
  /** Already found. */
  duplicate() {
    blip(340, 0.07, 'triangle');
    buzz(6);
  },
  /** Puzzle cleared. */
  complete() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      setTimeout(() => blip(f, 0.22, 'sine'), i * 95)
    );
    buzz([20, 50, 20, 50, 40]);
  },
};
