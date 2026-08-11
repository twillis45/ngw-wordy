#!/usr/bin/env node
/**
 * How thematic are a board's ROWS, not just its clues?
 *
 * Every row on a themed board is a word the base's letters happen to allow,
 * and the clue is what ties it to the theme. That works — "how far down the
 * hall the smell gets" makes `mile` a kitchen word — but it is doing all of
 * the lifting, and a player reasonably asks what `mile` has to do with a
 * kitchen. A row whose WORD already belongs to the theme reads as belonging;
 * a row carried entirely by its clue reads as filler with a nice sentence on
 * it.
 *
 * This finds the cases where the pack could have done better with the letters
 * it already had: a legal, common, unused row that IS in the theme's
 * vocabulary, sitting next to a used row that is not. Those are free wins —
 * same base, same structure, a word that belongs instead of one that doesn't.
 *
 * Usage: node scripts/theme-fit.mjs [themeId]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isBlocked } from './lib/blocklist.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** What each theme's world is made of. Words a player would call "on theme". */
const VOCAB = {
  cookout: 'grill grills coal coals fire smoke meat ribs rib link links sauce foil pan pans plate plates cup cups cooler ice soda drink chair chairs table tent yard music song dance card cards kid kids pool hose uncle aunt cousin seat shade heat cook cooks lid tongs char ash embers',
  fishfry: 'fish fry fried oil pan meal corn bread plate side slaw price cash box dollar bill line order sale sales fund roof deacon pastor lady ladies sink towel apron heat batter crisp golden hall basement menu ticket plates',
  reunion: 'family branch shirt shirts color hotel block room bus drive program page name names list book photo album chart tree elder date july park hall banquet dues vote badge tag prize grave stone quilt letter mail cousin kin',
  kitchen: 'pot pots pan pans lid stove oven sink counter knife spoon fork plate bowl cup salt sugar flour oil grease heat boil bake fry stir mix pour taste season recipe timer towel apron drawer shelf can jar bag box roast dough batter lime limb rind peel',
  sunday: 'dinner table grace plate roast greens rice bread roll gravy yam ham pie cake tea ice glass chair seat elder mother kitchen platter dish bowl fork spoon napkin foil second helping hat suit',
  barbershop: 'chair clip fade edge line razor blade shave neck cape mirror sink comb cut trim shape brush oil talc towel wait turn next boss shop radio bet argue debate loud money tip cash bill dollar hair beard part guard buzz clippers',
  salon: 'hair braid braids wash dry set curl press comb part scalp oil cream gel edge wrap cap dryer chair seat mirror sink cape towel bowl clip pin rod roller shop owner stylist rent book polish nail hand curls',
  hbcu: 'yard band step line dorm dean quad greek pledge march drum horn alum class exam grade major minor dues fee book study hall chapel song crown queen king float stroll cane boot shoe cape stand seat bus ride game dance party bid',
  homecoming: 'game float parade band step line queen crown court dance party tent lot grill class year alum badge tag gate seat stand score half time song shirt tie suit hat bus ride hotel room yard chapel show',
  church: 'choir robe organ piano song hymn book page seat pew aisle usher fan hat glove offer plate mother board deacon elder pastor sermon amen praise shout tea dinner basement bus program prayer altar candle bell',
  spades: 'card cards deck deal hand book books bid trick trump cut shuffle table chair team score board pad pen point set run talk rule joke laugh drink ice cup seat partner spade heart club ace king',
  steppers: 'step steps line dance floor slide turn spin count beat song music heat party hall club shoe shoes heel sole grip lead follow hand hold quick slow smooth suit dress hat set crowd chair seat room mirror class teach',
  // The language of making and selling records — not objects that happen to be
  // in the room. A row is only on-theme if a singer, an engineer or an A&R rep
  // would actually say it.
  rnb90s: 'hook hooks verse bridge chorus riff vamp vamps runs belt belts croon duet trio alto tenor bass tempo groove rhythm melody lyrics single demo label labels studio master mixer board booth tape tapes reel reels sample loop loops kick drums keys chord chords note notes scale sharp flat minor major gold charts chart radio video tour stage encore sing sang sung song songs anthem cover medley fade intro track tracks album cut cuts take takes mix mixed slow jam jams beat beats bars bar vocal vocals writer credit deal signed debut group duo solo tone pitch key hits hit',
  juneteenth: 'red drink soda cup ice grill park tent chair table flag star date year free news order paper read speech song march parade band hat shirt bead beat dance heat sun shade cooler plate meat side story elder child',
  sitcom: 'show shows tape set cast star role scene line host guest plot joke laugh seat couch screen dial knob clock week night rerun theme song ad break crew light stage act open close title card tune watch film reel',
  carolina: 'hog hogs pig pigs pit fire coal coals ash wood oak sauce slaw bun tray plate chop chops pull skin salt heat cook tent field church money ticket box pan lid barrel smoke night turn shovel',
  texas: 'oak post beef brisket rib ribs link links sausage pit smoke fat bark salt pepper paper tray pickle onion bread red soda cooler heat fence yard fire coal wood log ranch boot hat scale pound pounds',
  chicago: 'tip tips rib ribs sauce mild hot link links fry bag window glass south side park lot permit meter grill cart corner block bus train lake wind cold coat porch alley cousin card music speaker hickory',
  westcoast: 'beach ring sand fire wood coast grill cooler ice tent chair car trunk park lot wave pier boat sun palm freeway valley block yard hose links tri tip shipyard',
  caribbean: 'jerk pan drum coal pepper curry goat rice pea peas plantain oxtail bread festival music bass tent flag island yard pot spoon lime rum ginger cane market flat roti',
};

const themes = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'themes.json'), 'utf8'));
const words = fs
  .readFileSync(path.join(ROOT, 'data', 'enable1.txt'), 'utf8')
  .split('\n')
  .map((w) => w.trim().toLowerCase())
  .filter((w) => w.length >= 3 && !isBlocked(w));
const popular = new Set(
  fs
    .readFileSync(path.join(ROOT, 'data', 'popular.txt'), 'utf8')
    .split('\n')
    .map((w) => w.trim().toLowerCase())
);

/** Words spellable from a base with no letter reused. */
function legalRows(base) {
  const pool = new Set(base);
  return words.filter((w) => {
    if (w === base || w.length > base.length) return false;
    if (new Set(w).size !== w.length) return false;
    for (const c of w) if (!pool.has(c)) return false;
    return popular.has(w);
  });
}

// Flags are not theme filters — `--all` was being read as a theme id, which
// matched nothing and reported zero opportunities.
const only = process.argv.slice(2).find((a) => !a.startsWith('-'));
const opportunities = [];
let scored = 0;
let onTheme = 0;

for (const p of themes.puzzles) {
  if (only && p.theme !== only) continue;
  const vocab = new Set((VOCAB[p.theme] ?? '').split(/\s+/).filter(Boolean));
  if (vocab.size === 0) continue;

  const rows = Object.keys(p.clues).filter((w) => w !== p.base);
  const generic = rows.filter((w) => !vocab.has(w));
  scored += rows.length;
  onTheme += rows.length - generic.length;

  const unusedOnTheme = legalRows(p.base).filter(
    (w) => vocab.has(w) && !rows.includes(w)
  );
  if (unusedOnTheme.length && generic.length) {
    opportunities.push({
      theme: p.theme,
      base: p.base,
      generic,
      available: unusedOnTheme,
    });
  }
}

opportunities.sort((a, b) => b.available.length - a.available.length);

process.stdout.write(
  `rows scored ${scored} · already on-theme ${onTheme} (${Math.round(
    (100 * onTheme) / scored
  )}%)\n\n`
);
const cap = process.argv.includes('--all') ? opportunities.length : 24;
for (const o of opportunities.slice(0, cap)) {
  process.stdout.write(
    `${o.theme}/${o.base}\n  generic rows : ${o.generic.join(' ')}\n  could use    : ${o.available.join(' ')}\n`
  );
}
process.stdout.write(`\n${opportunities.length} boards could swap a generic row for an on-theme one\n`);
