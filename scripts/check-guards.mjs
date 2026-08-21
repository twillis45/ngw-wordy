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
    name: 'rank ladder spread to fill',
    file: 'src/components/Rail.tsx',
    edits: [
      {
        from: '<ol className="flex flex-col gap-1.5 short:gap-0.5">',
        to: '<ol className="flex min-h-0 flex-1 flex-col justify-between gap-0.5 overflow-y-auto">',
      },
      {
        from: '        className="flex flex-col"\n        title="Rank"',
        to: '        className="flex min-h-0 flex-1 flex-col"\n        title="Rank"',
      },
    ],
    guard: 'check-rail',
    why: 'rungs drift to 108px apart on a tall tablet and stop reading as a list',
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

let restoreArmed = true;
const restoreAll = () => {
  if (!restoreArmed) return;
  restoreArmed = false;
  touched.forEach(gitRestore);
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
