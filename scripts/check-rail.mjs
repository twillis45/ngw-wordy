/**
 * Does the evidence rail still fit?
 *
 * This rail has been re-fixed on four separate dates — 8/8, 8/10, 8/11, 8/14 —
 * and every fix was verified by measuring once, by hand, at whichever window
 * had just exposed it. A measurement nobody can repeat is not a guard, which
 * is why the fifth regression was always going to arrive the same way as the
 * first four: silently, on a window size that had not been checked.
 *
 * The invariant is one sentence: at every viewport we support, the Streak card
 * is fully visible without scrolling the rail. Streak is the floor of the
 * column and the last thing laid out, so it is what gets cut first — clipping
 * it costs the whole card, where the ladder above it loses height gracefully
 * because it scrolls.
 *
 * The sizes below are not a sample. Each one is a window that actually broke
 * this rail, taken from the commits that fixed it.
 *
 *   node scripts/check-rail.mjs          check
 *   KEEP=1 node scripts/check-rail.mjs   leave the server up for poking
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');

/*
 * Every entry is a window this rail has actually failed at, not a guess at
 * common hardware. 898x586 is the one from ede3ee0 (overflowed 52px, cut
 * Streak by 47); 1900x980 is the maximised-Chrome case from the howTo card
 * comment, wide but short, which a width-only breakpoint let through; 1440x900
 * fitted fine at the time and is here to catch a fix that trades one window
 * for another.
 */
const VIEWPORTS = [
  { w: 898, h: 586, note: 'ede3ee0 — overflowed 52px, Streak cut by 47' },
  { w: 1900, h: 980, note: 'maximised Chrome, wide but short' },
  { w: 1440, h: 900, note: 'fitted before — regression canary' , play: true },
  { w: 1280, h: 800, note: 'smallest desktop with the rail' },
  { w: 1512, h: 982, note: 'MacBook Pro 14 default' },
  /*
   * Short windows, added 2026-08-19. These are where Streak fell BELOW THE
   * VIEWPORT rather than below the rail: 23px at 1024x400, 3px at 1280x420,
   * measured before Streak was moved out of the scrollport. The old assertion
   * could not see either one, because it compared Streak against the scroll
   * box and the scroll box was itself off-screen.
   */
  { w: 1024, h: 400, note: 'Streak was 23px below the viewport' },
  { w: 1280, h: 420, note: 'Streak was 3px below the viewport' },
  /*
   * Tablets, both orientations, added 2026-08-19.
   *
   * Every entry above is laptop-shaped. The rail renders from `md` up, so
   * each of these shows it and none were covered. Both orientations are here
   * on purpose: they are not the same layout rotated. Portrait gives the rail
   * a tall narrow column beside a tall board; landscape is short enough to
   * land in the pinned-short sizing branch, which is where the tray was just
   * given seven more pixels a row. Testing one and assuming the other is how
   * the branch the tray actually uses gets missed.
   */
  { w: 744, h: 1133, note: 'iPad mini portrait', sheet: true },
  { w: 1133, h: 744, note: 'iPad mini landscape' },
  { w: 820, h: 1180, note: 'iPad Air portrait' },
  { w: 1180, h: 820, note: 'iPad Air landscape' },
  { w: 834, h: 1194, note: 'iPad Pro 11 portrait' },
  { w: 1194, h: 834, note: 'iPad Pro 11 landscape' },
  { w: 1024, h: 1366, note: 'iPad Pro 12.9 portrait' },
  { w: 1366, h: 1024, note: 'iPad Pro 12.9 landscape' },
  { w: 768, h: 1024, note: 'iPad portrait, smallest that shows the rail' },
  { w: 1024, h: 768, note: 'iPad landscape, smallest' },
  /*
   * BIG DESKTOPS, added 2026-08-21 after a reader photographed the rail
   * scrolling on an ordinary one.
   *
   * Every viewport above is either under 1536 wide or under 1000 tall, which
   * are exactly the two conditions that keep the "How to play" card hidden.
   * So no test in this file had ever rendered it — and that card sits OUTSIDE
   * the scroller, so switching it on does not lengthen a scrollable list, it
   * TAKES 189px from the three cards inside. 1536x1000 and 1600x1000
   * overflowed by 95px, 1920x1080 by 15, and the whole suite stayed green
   * because none of it had ever been on that side of both breakpoints.
   *
   * The lesson is the sizes, not the fix: a viewport list assembled from the
   * windows that broke things in the past has a hole wherever a feature is
   * gated on a combination nothing in the list satisfies.
   */
  { w: 1536, h: 1000, note: '2xl at exactly 1000 tall — how-to gate boundary' },
  { w: 1600, h: 1000, note: 'overflowed 95px before the gate was raised' },
  { w: 1728, h: 1080, note: 'MacBook Pro 16 default — overflowed 15px' },
  { w: 1920, h: 1080, note: 'the commonest desktop — overflowed 15px' },
  { w: 1970, h: 1110, note: 'the window this was reported from' , play: true },
  { w: 1600, h: 1130, note: 'first height where how-to is meant to show' , play: true },
  { w: 2560, h: 1400, note: 'large desktop, how-to showing with room' },
  /*
   * Phones, where the rail lives inside the progress SHEET rather than beside
   * the board — which is why they were never in this list. They are here now
   * because the rail is rendered twice, and for a while only one of the two
   * got the fade attribute at all: the effect that sets it was keyed off the
   * desktop column, so the sheet's copy could not fade however much it had to
   * scroll. Nothing looked wrong, because neither copy happened to overflow
   * at any size anyone had checked.
   */
  { w: 390, h: 844, note: 'iPhone 14 — rail is in the sheet', sheet: true },
  { w: 375, h: 667, note: 'iPhone SE — shortest phone', sheet: true },
];

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json',
};

if (!fs.existsSync(OUT)) {
  console.error('✗ no out/ — run `npm run build` first');
  process.exit(2);
}

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(OUT, p);
  if (!file.startsWith(OUT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

/*
 * An isolated userDataDir, not the default one: without it Chrome attaches to
 * the profile a running Chrome already holds a lock on, and the launch hangs
 * until puppeteer times out waiting for a WS endpoint that never appears.
 */
const browser = await launch({
  headless: true,
  userDataDir: path.join(ROOT, 'node_modules', '.cache', 'rail-chrome'),
});
const results = [];

/*
 * THE TEXT SCALE IS PART OF THE MATRIX.
 *
 * Every viewport in this file had only ever been rendered at the default text
 * size, and the app offers two more — large is 115% on the root and larger is
 * 132%. The cards grow, the window does not. Measured before the fix: at large
 * five of eight desktop sizes overflowed, up to 156px; at larger all eight did,
 * up to 344px; at default every one was clean. So the whole suite passed while
 * a reader with large text watched the rail scroll.
 *
 * PHONES AT SCALED TEXT ARE ALLOWED TO SCROLL, deliberately. On a 375x667
 * screen at 132% the cards cannot fit without deleting some, and deleting
 * information from the player who just asked for bigger type is the worse
 * trade — reflow is expected to scroll in one direction. What is NOT allowed
 * is scrolling silently, so the fade still has to be honest there.
 */
/*
 * `browser20` IS NOT ONE OF OUR SETTINGS. It is Chrome's own default font
 * size turned up — the axis this file was blind to.
 *
 * A reader reported the rail scrolling three separate times, and each fix
 * missed because their Chrome renders a 20px root where this guard renders
 * 16px. `data-text` read "default" on their machine the whole time, so even
 * the text-scale matrix added to catch this class of bug came back clean.
 *
 * Simulated by setting the root font size directly, which is faithful: the
 * app decides by reading the COMPUTED root px, and both a browser preference
 * and our own control arrive there.
 */
const TEXT_SCALES = ['default', 'large', 'larger', 'browser20'];

/*
 * Real words from the shipped warm-up board, typed through the real input, so
 * the state is the app's own rather than a hand-made blob in localStorage.
 */
const PLAY_WORDS = ['CRAFTY','CRAFT','ARTY','RAFT','ACT','ART','RAT','CAR','CAT',
  'FAR','FAT','TRY','FRY','AFT','ARC','TAR','RAY','FAY','CRY'];
const isPhone = (vp) => vp.w < 500;

for (const vp of VIEWPORTS) {
 for (const text of TEXT_SCALES) {
  /*
   * AN ISOLATED CONTEXT PER CASE.
   *
   * `browser.newPage()` shares one profile, so words typed at a `play`
   * viewport persisted into every case measured after it — 375x667 went from
   * 0px to 20px over with no app code changing, because it was being measured
   * with someone else's game already in progress. Clearing the key first was
   * the obvious patch and it raced the reload into a detached frame; a fresh
   * context is the thing that was actually wanted.
   */
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60_000);
  await page.setViewport({ width: vp.w, height: vp.h });
  /*
   * The text scale is seeded BEFORE the first navigation, not set and then
   * reloaded. The no-flash script reads it at document start, so this is the
   * only moment it can be applied without a second load — and the second load
   * was what made this file flaky: 78 isolated contexts each doing goto plus
   * reload timed out, and clearing storage between them raced into a detached
   * frame. One navigation per case, seeded, is both faster and deterministic.
   */
  await page.evaluateOnNewDocument((t) => {
    try {
      /*
       * Isolation lives HERE, not in a per-case browser context.
       *
       * Three versions of this got it wrong. A shared profile leaked the words
       * typed at a `play` viewport into every case after it, so 375x667 read
       * 0px over and then 20px with no app code changing. Clearing the key
       * after load raced the reload into a detached frame. Giving each of 78
       * cases its own context fixed the state and timed the run out.
       *
       * Seeding on the new document is both: it runs before the app's first
       * line, so the board starts empty and the scale is already set — one
       * navigation, one context, no race.
       */
      localStorage.removeItem('ngw-wordy/v2');
      if (t === 'browser20') {
        localStorage.removeItem('ngw-wordy/text');
        // Stand in for the browser preference, before the app's first line.
        document.documentElement.style.fontSize = '20px';
      } else if (t === 'default') {
        localStorage.removeItem('ngw-wordy/text');
      } else {
        localStorage.setItem('ngw-wordy/text', t);
      }
    } catch {
      /* storage unavailable — the default scale is what gets measured */
    }
  }, text);
  /*
   * `domcontentloaded` and an explicit settle, NOT `networkidle0`.
   *
   * networkidle0 waits for 500ms with no network in flight, and this app
   * registers a service worker — so on a machine that is busy with something
   * else, that quiet window may simply never arrive and the guard dies on a
   * 60s navigation timeout having measured nothing. It did, repeatedly, while
   * an unrelated Playwright suite held a core at 82%.
   *
   * A guard that fails when the machine is busy teaches people to ignore it.
   * The settle below is what the measurement actually needs: the rail laid
   * out, which is a layout event and not a network one.
   */
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 700));

  if (vp.play && text === 'default') {
    for (const word of PLAY_WORDS) {
      for (const ch of word) await page.keyboard.press(ch);
      await page.keyboard.press('Enter');
      await new Promise((r) => setTimeout(r, 90));
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  if (vp.sheet) {
    // Below `md` the rail is only mounted once the progress sheet is opened.
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) =>
        /rank and progress/i.test(b.getAttribute('aria-label') ?? ''),
      );
      btn?.click();
    });
    await new Promise((r) => setTimeout(r, 500));
  }
  await page.waitForSelector('.rail-scroll', { timeout: 10_000 });

  const m = await page.evaluate(() => {
    /*
     * THE VISIBLE rail, not the first one in the document.
     *
     * Both mounts are always in the DOM — the aside and the progress sheet —
     * so `querySelector` returns the aside's copy even on a phone, where the
     * aside is display:none and the sheet is the one the player is looking at.
     * Every phone measurement in this file was therefore taken from the hidden
     * mount, and reported Record missing on a 390x844 screen where it renders
     * perfectly well.
     *
     * This is the same defect as the Record probe that read `display` on the
     * scroller while the ASIDE was what got hidden: the query was correct and
     * pointed at the wrong element. Pick by what is rendered.
     */
    const rail =
      [...document.querySelectorAll('.rail-scroll')].find((e) => e.offsetParent) ??
      document.querySelector('.rail-scroll');
    if (!rail) return { error: 'no .rail-scroll' };
    if (getComputedStyle(rail).display === 'none') return { hidden: true };

    /*
     * Streak lives OUTSIDE the scroller now, as a pinned footer, so it is
     * looked up from the rail column rather than from the scrollport.
     */
    const column = rail.parentElement ?? rail;
    const card = [...column.querySelectorAll('section')].find(
      (s) => s.querySelector('h2')?.textContent?.trim() === 'Streak',
    );
    if (!card) return { error: 'no Streak card' };
    if (rail.contains(card)) return { error: 'Streak is back inside the scrollport' };

    /*
     * Measured at scrollTop 0 deliberately. The rail CAN scroll — that is what
     * lets the ladder give up height — but Streak sitting below the fold is
     * the exact failure being guarded, so a card you have to scroll to find
     * counts as cut, not as present.
     */
    rail.scrollTop = 0;
    const r = rail.getBoundingClientRect();
    const c = card.getBoundingClientRect();

    /*
     * The fade, and whether it is lying.
     *
     * `.rail-scroll` fades its last 28px to say "there is more below". This
     * check used to ask only whether Streak was CUT — bottom past the rail's
     * bottom — which a card ending exactly flush passes while sitting wholly
     * inside the fade. That is how a permanently half-erased Streak card
     * survived a guard written specifically to protect the Streak card.
     *
     * `fadedBy` is how much of the card the gradient covers. It is only a
     * failure when the rail is NOT scrollable at this position, because then
     * the fade is promising content that does not exist.
     */
    /*
     * THE RAIL MUST NOT SCROLL, at any viewport that shows it.
     *
     * This script asserted that Streak was visible and that the fade was
     * honest, and never that the rail FIT. So a 95px overflow at 1600x1000
     * passed every check: Streak was fine (it sits outside the scroller), and
     * the fade was correctly on because there genuinely was more below. The
     * Rank ladder was cut mid-rung and Record was out of sight, and the suite
     * was green.
     *
     * The requirement is that every card is visible without scrolling. That
     * is now the assertion rather than an implication of three narrower ones.
     */
    /*
     * RECORD MUST BE REACHABLE.
     *
     * Record is allowed to hide on very short windows — it is reference, not
     * status, and at 1024x400 the rail has 167px for three cards. What is not
     * allowed is hiding with no way to get to it. The card's own comment said
     * the figures were still in the progress sheet; the sheet mounts this very
     * component, so the viewport-height rule hid it in both places and the
     * defence was circular.
     *
     * So the assertion is not "Record is visible" — it is "Record is visible
     * HERE, or this is the board and the sheet will show it." The sheet
     * viewports below are the ones that prove the second half.
     */
    const recordCard = [...column.querySelectorAll('section')].find(
      (s2) => s2.querySelector('h2')?.textContent?.trim() === 'Record',
    );
    const recordShown = !!recordCard?.offsetParent;

    /*
     * If Record is hidden, the way to it has to be on screen. That is the
     * whole of the claim the card's comment used to make for free.
     */
    const escapeHatch = [...document.querySelectorAll('button')].some(
      (b) => /rank and progress/i.test(b.getAttribute('aria-label') ?? '') && b.offsetParent,
    );

    const overflowPx = Math.max(0, rail.scrollHeight - rail.clientHeight);

    const FADE = 28;
    const masked = getComputedStyle(rail).maskImage !== 'none';
    /*
     * EVERY scroller must have decided, not just the one found first. The
     * attribute being absent is a different failure from it being 'false':
     * absent means nothing is managing that instance, so it can never fade.
     */
    const unmanaged = [...document.querySelectorAll('.rail-scroll')].filter(
      (el) => el.dataset.fade !== 'true' && el.dataset.fade !== 'false',
    ).length;

    /*
     * The rank ladder's RHYTHM.
     *
     * The rungs used to be spread with `justify-between` to fill whatever
     * height the card had, on the reasoning that a growing list should add
     * space between rows rather than leave a pool at the bottom. Measured
     * across the sizes this rail actually runs at, the gap between rungs went
     * from 0.9px at 898x586 to 108.8px at 1024x1366 — a 120x swing, ending
     * three and a half times the height of the rows it separated, at which
     * point eight rungs stop reading as one list.
     *
     * The invariant is a rhythm, not a number: whatever the gap resolves to,
     * it must stay smaller than the rows it is separating. That is what every
     * app doing this well holds to — Duolingo, Mimo, Speak, Life Reset and
     * Agoda all keep tier rows contiguous and let the leftover sit outside
     * the list.
     */
    const ladder = (() => {
      const ol = [...document.querySelectorAll('ol')].find(
        (o) => o.querySelectorAll('li').length > 4,
      );
      if (!ol) return null;
      const rows = [...ol.querySelectorAll('li')].map((e) => e.getBoundingClientRect());
      const gaps = [];
      for (let i = 1; i < rows.length; i++) gaps.push(rows[i].top - rows[i - 1].bottom);
      return {
        rung: +rows[0].height.toFixed(1),
        maxGap: +Math.max(...gaps).toFixed(1),
        spread: +(Math.max(...gaps) - Math.min(...gaps)).toFixed(1),
      };
    })();
    return {
      unmanaged,
      overflowPx,
      recordShown,
      escapeHatch,
      ladder,
      railCount: document.querySelectorAll('.rail-scroll').length,
      overflow: Math.max(0, rail.scrollHeight - rail.clientHeight),
      /*
       * The invariant, restated 2026-08-19: the bottom of the Streak card is
       * inside the VIEWPORT. Not "inside the rail" — the rail can itself be
       * taller than the screen, which is how this passed while the card was
       * off the bottom of a 1024x400 window.
       */
      belowFold: Math.max(0, Math.round(c.bottom - window.innerHeight)),
      streakHeight: Math.round(c.height),
      masked,
      overlapsFade:
        masked && c.bottom > r.bottom - FADE && c.top < r.bottom
          ? Math.round(Math.min(c.bottom, r.bottom) - (r.bottom - FADE))
          : 0,
      moreBelow: rail.scrollHeight - rail.clientHeight - rail.scrollTop > 1,
    };
  });

  await page.close();

  if (m.hidden) { results.push({ vp, text, skip: true }); continue; }
  if (m.error) { results.push({ vp, text, fail: true, why: m.error }); continue; }

  /*
   * Two ways to lose the Streak card, and the second one is why this file
   * grew: it can be cut off the bottom, or it can be sitting under a fade
   * that has nothing to fade to.
   */
  const fail =
    m.belowFold > 0 ||
    m.overlapsFade > 0 ||
    (m.masked && !m.moreBelow) ||
    m.unmanaged > 0 ||
    (m.overflowPx > 0 && !(isPhone(vp) && text !== 'default')) ||
    (!m.recordShown && !m.escapeHatch) ||
    (m.ladder && m.ladder.maxGap > m.ladder.rung) ||
    (m.ladder && m.ladder.spread > 1);
  results.push({ vp, text, fail, ...m });
 }
}

await browser.close();
server.close();

let failed = 0;
for (const r of results) {
  const label = `${r.vp.w}x${r.vp.h} ${r.text === "default" ? "" : r.text}`.padEnd(18);
  if (r.skip) { console.log(`—  ${label} rail hidden at this width`); continue; }
  if (r.fail) {
    failed++;
    /*
     * `r.why` first: it carries the structural errors (no Streak card, Streak
     * back inside the scrollport). Without this the error fell through to the
     * fade branch and a revert of the layout split was reported as a fade
     * problem — a guard that fails for the right reason and says the wrong
     * one is only half a guard.
     */
    const why =
      r.why
        ? r.why
        : r.belowFold > 0
          ? `Streak ${r.belowFold}px below the viewport`
          : r.overlapsFade > 0
            ? `Streak overlaps the fade by ${r.overlapsFade}px`
            : r.ladder && r.ladder.maxGap > r.ladder.rung
              ? `rank ladder gap ${r.ladder.maxGap}px exceeds its ${r.ladder.rung}px rungs — the rows have stopped reading as one list`
              : r.ladder && r.ladder.spread > 1
                ? `rank ladder gaps vary by ${r.ladder.spread}px — the rhythm is uneven`
                : !r.recordShown && !r.escapeHatch
              ? 'Record is hidden and nothing on screen leads to it'
              : r.overflowPx > 0
              ? `rail scrolls — ${r.overflowPx}px of cards below the fold; every card must be visible without scrolling`
              : r.unmanaged > 0
              ? `${r.unmanaged} of ${r.railCount} rail scrollers have no data-fade — nothing manages them, so they can never fade`
              : 'fade is on with nothing below to fade to';
    console.log(`✗  ${label} ${why}  — ${r.vp.note}`);
  } else {
    console.log(
      `✔  ${label} Streak in viewport, clear of the fade (scroller overflow ${r.overflow}px, fade ${r.masked ? 'on' : 'off'})`,
    );
  }
}

if (failed) {
  console.log(`\n✗ rail regressed at ${failed} of ${results.length} viewports`);
  process.exit(1);
}
console.log(`\n✔ rail holds at all ${results.length} viewport/text-size combinations`);
