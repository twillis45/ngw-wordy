/*
 * Paste this whole file into the Chrome DevTools Console on the game, then
 * click a letter. It prints exactly what moved, and by how much.
 *
 * Why you and not me: the browser tooling in my environment cannot land a
 * click at a given coordinate — measured twice, it applied a 2.96x scale on
 * one attempt and 5.33x on the next, so every "real click" I try lands off
 * the board. Your Chrome is the only place a real click can be observed, and
 * this makes observing it a copy-paste rather than a description.
 *
 * It watches the pointer AND its neighbours, because "the puck moved" and
 * "everything around the puck moved" look identical and have different fixes.
 */
(() => {
  const wheel = document.querySelector('[data-wheel-tile]')?.parentElement;
  if (!wheel) return console.warn('Wheel not found — is the board on screen?');

  const watch = () => ({
    puck: wheel.querySelector('.glass-puck'),
    tiles: [...wheel.querySelectorAll('[data-wheel-tile]')],
    submit: wheel.querySelector('button[aria-label*="ubmit"], button[aria-label*="too short"]'),
    wheel,
  });

  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      cx: +(r.left + r.width / 2).toFixed(1),
      cy: +(r.top + r.height / 2).toFixed(1),
      w: +r.width.toFixed(1),
      h: +r.height.toFixed(1),
    };
  };

  const snap = () => {
    const w = watch();
    return {
      puck: rect(w.puck),
      puckExists: !!w.puck,
      submitExists: !!w.submit,
      wheel: rect(w.wheel),
      tiles: w.tiles.map((t) => rect(t)),
    };
  };

  const diff = (a, b) => {
    const out = {};
    if (a.puckExists !== b.puckExists) out.PUCK_APPEARED_OR_VANISHED = `${a.puckExists} -> ${b.puckExists}`;
    if (a.puck && b.puck) {
      const d = Math.hypot(b.puck.cx - a.puck.cx, b.puck.cy - a.puck.cy);
      if (d > 0.5) out.puckMoved = +d.toFixed(1) + 'px';
      if (Math.abs(b.puck.w - a.puck.w) > 0.5) out.puckResized = `${a.puck.w} -> ${b.puck.w}px`;
    }
    if (a.wheel && b.wheel) {
      const d = Math.hypot(b.wheel.cx - a.wheel.cx, b.wheel.cy - a.wheel.cy);
      if (d > 0.5) out.WHOLE_DIAL_MOVED = +d.toFixed(1) + 'px';
      if (Math.abs(b.wheel.h - a.wheel.h) > 0.5) out.dialResized = `${a.wheel.h} -> ${b.wheel.h}px`;
    }
    a.tiles.forEach((t, i) => {
      const u = b.tiles[i];
      if (!t || !u) return;
      const d = Math.hypot(u.cx - t.cx, u.cy - t.cy);
      if (d > 0.5) (out.tilesMoved ??= []).push(`#${i} ${d.toFixed(1)}px`);
      if (Math.abs(u.w - t.w) > 0.5) (out.tilesResized ??= []).push(`#${i} ${t.w}->${u.w}`);
    });
    if (a.submitExists !== b.submitExists) out.submitButtonToggled = `${a.submitExists} -> ${b.submitExists}`;
    return out;
  };

  let base = snap();
  let frames = 0;
  console.log('%cPuck probe armed — click a letter now.', 'color:#4fae7a;font-weight:bold');

  const tick = () => {
    const now = snap();
    const d = diff(base, now);
    if (Object.keys(d).length) {
      console.log(`t+${frames}f`, d);
      base = now;
    }
    if (frames++ < 240) requestAnimationFrame(tick);
    else console.log('%cProbe finished (4s). Re-paste to run again.', 'color:#849eb8');
  };
  requestAnimationFrame(tick);
})();
