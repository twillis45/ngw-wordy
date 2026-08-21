/**
 * Who guards the guards.
 *
 * Every check script in this repo exists because something broke silently.
 * That gives them a shared weakness worth testing directly: a guard written
 * to catch the bug that just happened tends to assert THAT BUG rather than
 * the invariant behind it, and then passes the next time the same property
 * fails a slightly different way. This is not hypothetical. On 2026-08-21,
 * in one session:
 *
 *   check-rail passed while the Streak card was permanently half-erased by a
 *   gradient — it asserted the card was not CUT, and a card ending flush with
 *   the edge is not cut.
 *
 *   check-rail passed again while a NEW card above Streak was clipped —
 *   it only ever looks at Streak.
 *
 *   check-tiles passed while every filled row rendered its letters clipped —
 *   the tile was the right size and the font was the right size and nothing
 *   compared the line box to the box it had to fit in.
 *
 * So: deliberately break something, rebuild, and assert the guard NOTICES.
 * A guard that cannot fail is decoration, and this script is the only thing
 * in the repo that can tell the difference.
 *
 *   node scripts/check-guards.mjs
 *
 * Slow by nature — one production build per mutation. It is not part of the
 * fast loop; it is what you run when you have added a guard, or when a guard
 * has just failed to catch something.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/*
 * Each mutation is a defect that HAS actually shipped or was caught in
 * review, not an invented one. `file` and `from`/`to` describe the break;
 * `guard` names the script that must notice; `why` says what a player would
 * experience if it went unnoticed.
 */
const MUTATIONS = [
  {
    name: 'tile narrower than tall',
    file: 'src/components/WordTray.tsx',
    from: "aspectRatio: '5 / 4',",
    to: "aspectRatio: '7 / 8',",
    guard: 'check-tiles',
    why: 'the letters shrink back below body copy on every viewport',
  },
  {
    name: 'folded word overflows its chip',
    file: 'src/app/globals.css',
    from: '--fold-glyph: 0.6;',
    to: '--fold-glyph: 1.4;',
    guard: 'check-tiles',
    why: 'every solved row renders its word clipped inside the pill',
  },
  {
    name: 'the fold frees nothing but still spends',
    file: 'src/app/globals.css',
    from: '--fold-chip: 0.78;',
    to: '--fold-chip: 1;',
    guard: 'check-tiles',
    why: 'the tray grows into the dial — measured 235 to 202 when this shipped',
  },
  {
    name: 'rail fade always on',
    file: 'src/app/globals.css',
    from: ".rail-scroll[data-fade='true'] {",
    to: '.rail-scroll {',
    guard: 'check-rail',
    why: 'the bottom of the Streak card is permanently erased by a gradient',
  },
  {
    /*
     * TWO edits, and the first version of this mutation had only one — which
     * is how it reported the guard as broken when the guard was fine.
     *
     * The ladder fix was a pair: the list stopped spreading itself AND the
     * card stopped absorbing the column's leftover height. Reverting only the
     * list leaves the card at its natural size, so the list never grows, so
     * the gaps stay tight and there is nothing for the guard to catch. A
     * mutation that does not actually reproduce the defect proves nothing
     * about the guard — it is the same trap as a probe that cannot fail for
     * the right reason, one level up.
     */
    name: 'rank ladder rows spread apart',
    file: 'src/components/Rail.tsx',
    /*
     * RETIRED AND REPLACED 2026-08-21.
     *
     * The old mutation set the Rank card to `flex-1` and the list to
     * `justify-between`, so the rungs spread into whatever height the card
     * had. It is unreachable now, and not because the guard got better: the
     * scroller is `flex-initial`, so it is content-height and there is no
     * slack for a card to grow into. The defect was designed out by a
     * different fix, which has its own mutation above.
     *
     * That is worth saying plainly rather than deleting the entry, because a
     * mutation that MISSES for that reason looks identical to one that misses
     * because the guard is broken — and this one spent a day printing SKIPPED
     * on a drifted anchor, which looks identical to both.
     *
     * The rhythm invariant is still real and still worth defending, so this
     * attacks it the way it can still break: widen the gap directly. The rows
     * must stay closer together than they are tall, whatever height they get.
     */
    from: "<ol className=\"flex flex-col gap-1.5 [@media(min-height:801px)_and_(max-height:920px)]:gap-1 short:gap-0.5\">",
    to: '<ol className="flex flex-col gap-16">',
    guard: 'check-rail',
    why: 'rungs sit further apart than they are tall and stop reading as one list',
  },
  {
    name: 'reduced motion silences the rejection',
    file: 'src/app/globals.css',
    from: '  .anim-shake {\n    animation: rm-reject 420ms ease-in-out both !important;\n  }',
    to: '  .anim-shake-disabled-for-audit { color: inherit; }',
    guard: 'check-motion',
    why: 'a reduced-motion player on a desktop gets NO feedback for a wrong word',
  },
  {
    name: 'ambient pools go back to steel',
    file: 'src/app/globals.css',
    from: '  --ambient-1: color-mix(in srgb, var(--color-steel-lift) 30%, transparent);',
    to: '  --ambient-1: color-mix(in srgb, var(--color-steel) 30%, transparent);',
    guard: 'check-color',
    why: 'the lowest layer in the app turns blue and every card blurs it upward',
  },
  {
    name: 'studio panels lose their lit edge',
    file: 'src/app/globals.css',
    from: '    inset 0 1px 0 var(--raise-light),\n    0 1px 1px -1px var(--raise-shadow),',
    to: '    0 1px 1px -1px var(--raise-shadow),',
    guard: 'check-depth',
    why: 'studio cards go back to being printed on the page instead of sitting on it',
  },
  {
    name: 'the rail column stretches again',
    file: 'src/components/Rail.tsx',
    from: 'className="rail-scroll flex min-h-0 flex-initial flex-col',
    to: 'className="rail-scroll flex min-h-0 flex-1 flex-col',
    guard: 'check-rail',
    why: 'the scroller grows to fill, opening a 362px hole above the pinned Streak card',
  },
  {
    name: 'bonus chips grow without a ceiling',
    file: 'src/components/Rail.tsx',
    from: 'const BONUS_CHIPS = 4;',
    to: 'const BONUS_CHIPS = 999;',
    guard: 'check-rail',
    why: 'Your words grows all game and the rail overflows once somebody actually plays',
  },
  {
    name: 'text scale inferred from our own control',
    file: 'src/components/Game.tsx',
    from: '  const scaledText = rootPx > 17;',
    to: "  const scaledText = textScale !== 'default';",
    guard: 'check-rail',
    why: "a reader whose BROWSER font is large gets a scrolling rail and data-text still reads default",
  },
  {
    name: 'pointer not converted into ring space',
    file: 'src/components/LetterWheel.tsx',
    from: '    return toRing({\n      x: ((e.clientX - r.left) / r.width) * 100,',
    to: '    return ({\n      x: ((e.clientX - r.left) / r.width) * 100,',
    guard: 'check-drag',
    why: 'a drag spells different letters than the ones it crossed once the dial has turned',
  },
  {
    name: 'accent applies to matte only',
    file: 'src/lib/accent.ts',
    from: "  if (next === 'default') delete document.documentElement.dataset.accent;\n  else document.documentElement.dataset.accent = next;",
    to: "  if (next === 'matte') document.documentElement.dataset.accent = next;\n  else delete document.documentElement.dataset.accent;",
    guard: 'check-settings',
    why: 'the control says Tide and the page stays green — a setting that does not take',
  },
  {
    name: 'dial glyph wrapper removed',
    file: 'src/components/LetterWheel.tsx',
    from: 'className="dial-glyph"',
    to: 'className="dial-glyph-removed-for-audit"',
    guard: 'check-motion',
    why: 'letters lie on their side for the 420ms a shuffle takes',
  },
];

/*
 * SAFETY, and it is not theoretical — this script corrupted the working tree
 * the first time it ran.
 *
 * The first run was killed by a two-minute timeout WHILE a mutation was
 * applied, leaving the break on disk. The next run then read that broken file
 * as its "original", found its anchor missing, reported a skip, and faithfully
 * restored the damage. A harness that deliberately writes bugs into source has
 * to assume it will be interrupted, because it will be.
 *
 * Three guarantees, in order of how much they are worth:
 *
 *   1. Refuse to start on a dirty tree. If the files this touches already have
 *      uncommitted changes there is no safe "original" to restore, and a
 *      restore would silently destroy real work.
 *   2. Restore from GIT, not from a string held in memory. Git's copy survives
 *      this process dying; a variable does not.
 *   3. Restore on the way out — best effort only, and worth being honest
 *      about: `execSync` blocks the event loop, so a signal arriving while a
 *      build is running cannot run a JS handler at all. Verified by killing a
 *      run mid-build: the tree was left mutated and the handler never fired.
 *      So (3) catches the tidy exits and (1) is what actually prevents damage
 *      — the next run refuses to start rather than baking the break in as a
 *      new "original", which is precisely the failure this script caused the
 *      first time it ran.
 */
const gitRestore = (file) => {
  try {
    execSync(`git checkout HEAD -- "${file}"`, { cwd: ROOT, stdio: 'pipe' });
  } catch {
    console.error(`!! could not restore ${file} — check it by hand`);
  }
};

const touched = [...new Set(MUTATIONS.map((m) => m.file))];

const dirty = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .map((l) => l.slice(3).trim())
  .filter(Boolean);
const conflicts = touched.filter((f) => dirty.includes(f));
if (conflicts.length) {
  console.error('✗ refusing to run: these files have uncommitted changes, so');
  console.error('  there is no safe original to restore afterwards.\n');
  conflicts.forEach((f) => console.error(`    ${f}`));
  console.error('\n  Commit or stash them first.');
  process.exit(2);
}

/*
 * A LOCK, because the dirty-tree gate only guards the START.
 *
 * It answers "was the tree clean when this began" and nothing about what
 * happens during the next several minutes of builds. While a run was in
 * flight I audited the mutation anchors, read `BONUS_CHIPS = 999` off disk —
 * a value this script had deliberately written seconds earlier — concluded
 * the anchor was dead, and came within one step of "fixing" a file that was
 * mid-test. Two concurrent runs would be worse: the second sees the first's
 * mutation as the original and restores the break as truth, which is exactly
 * how this script corrupted the tree the first time it ran.
 *
 * So the lock is not really about two harnesses. It is a sign on the door for
 * anything else that reads this repo — including a person, or an agent, who
 * would otherwise believe what the files say.
 *
 * Stale locks are cleared by checking whether the recorded pid is alive:
 * `kill(pid, 0)` throws if it is not. A crashed run must not block the next
 * one forever, which is the standard way lockfiles become worse than no lock.
 */
const LOCK = path.join(ROOT, 'node_modules', '.cache', 'check-guards.lock');

const readLock = () => {
  try {
    return JSON.parse(fs.readFileSync(LOCK, 'utf8'));
  } catch {
    return null;
  }
};

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const held = readLock();
if (held && alive(held.pid)) {
  console.error('✗ refusing to run: another guard-mutation run holds the lock.');
  console.error(`    pid ${held.pid}, started ${held.started}`);
  console.error('    That run has bugs written into source right now. Wait for it,');
  console.error('    and do not trust what these files say until it finishes.');
  process.exit(2);
}
if (held) {
  console.error(`!  clearing a stale lock from pid ${held.pid} (not running)`);
  console.error('   Check the tree before believing this run: that process may');
  console.error('   have died with a mutation still applied.\n');
}
fs.mkdirSync(path.dirname(LOCK), { recursive: true });
fs.writeFileSync(
  LOCK,
  JSON.stringify({ pid: process.pid, started: new Date().toISOString() }, null, 2)
);

let restoreArmed = true;
const restoreAll = () => {
  if (!restoreArmed) return;
  restoreArmed = false;
  touched.forEach(gitRestore);
  try {
    fs.unlinkSync(LOCK);
  } catch {
    /* already gone — the run that mattered was the restore above */
  }
};
process.on('exit', restoreAll);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    console.error(`\n!! ${sig} — restoring mutated files before exit`);
    restoreAll();
    process.exit(130);
  });
}

const run = (cmd) => {
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};

console.log('Mutation-testing the guards. One build per mutation — this is slow.\n');

let missed = 0;
const results = [];

for (const m of MUTATIONS) {
  const file = path.join(ROOT, m.file);
  const original = fs.readFileSync(file, 'utf8');
  const edits = m.edits ?? [{ from: m.from, to: m.to }];

  const missing = edits.filter((e) => !original.includes(e.from));
  if (missing.length) {
    console.log(`?  ${m.name.padEnd(38)} SKIPPED — anchor not found in ${m.file}`);
    results.push({ ...m, skipped: true });
    continue;
  }

  let broken = original;
  for (const e of edits) broken = broken.replace(e.from, e.to);
  fs.writeFileSync(file, broken);
  const built = run('npm run build');
  /*
   * A mutation that will not BUILD proves nothing about the guard — the
   * compiler caught it, which is a different and earlier line of defence.
   * Reported separately rather than counted as a pass.
   */
  const caught = built ? !run(`node scripts/${m.guard}.mjs`) : null;
  // From git, not from `original` — see the safety note above.
  gitRestore(m.file);

  if (caught === null) {
    console.log(`—  ${m.name.padEnd(38)} build failed — the compiler caught it, not ${m.guard}`);
    results.push({ ...m, compiler: true });
  } else if (caught) {
    console.log(`✔  ${m.name.padEnd(38)} caught by ${m.guard}`);
    results.push({ ...m, caught: true });
  } else {
    missed++;
    console.log(`✗  ${m.name.padEnd(38)} MISSED by ${m.guard}`);
    console.log(`   would ship: ${m.why}`);
    results.push({ ...m, caught: false });
  }
}

// Leave the tree as we found it, built.
run('npm run build');

const real = results.filter((r) => !r.skipped && !r.compiler);
console.log(
  `\n${real.length - missed}/${real.length} defects caught by the guard that owns them.`
);
if (missed) {
  console.log(`✗ ${missed} would ship silently — the guard for each is decoration.`);
  process.exit(1);
}
console.log('✔ every guard fails when the thing it protects is broken');
