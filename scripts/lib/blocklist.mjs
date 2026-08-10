/**
 * Words that must never appear in a puzzle.
 *
 * ENABLE1 is a Scrabble word list. Scrabble-legal is not the same as
 * publishable: the shipped set contained `spic`, `dago`, `chink`, and `rape`
 * as SCORING WORDS, with a dictionary definition attached to each. On a game
 * that ships The Cookout, HBCU and Barbershop, that is not a policy checkbox.
 *
 * Filtered at wordlist load, which is the only chokepoint that covers every
 * consumer at once — grid, bonus, maxScore, unlockOrder and the definition
 * bundle all derive from the same array, so filtering here makes it impossible
 * for a blocked word to reach any of them.
 *
 * Deliberately hand-curated rather than pulled from a dependency. A generic
 * profanity package would also strip `hell`, `damn` and a long tail of medical
 * and place names, which is both worse for the puzzle and not the point. The
 * bar here: slurs unconditionally, plus crude/sexual/violent terms that would
 * push the store age rating above 4+.
 *
 * SLURS is separated so the test can assert on it specifically and so the
 * reason for each group survives contact with a future editor.
 */

/** Ethnic, racial, religious and orientation slurs. Non-negotiable. */
const SLURS = [
  'abo', 'abos', 'boong', 'boongs', 'chink', 'chinks', 'coon', 'coons',
  'cracker', 'crackers', 'dago', 'dagoes', 'dagos', 'darkie', 'darkies',
  'darky', 'gippo', 'gook', 'gooks', 'gyp', 'gyps', 'gypped', 'gyppo',
  'heeb', 'heebs', 'honkey', 'honkeys', 'honkie', 'honkies', 'honky',
  'injun', 'injuns', 'jap', 'japs', 'kaffir', 'kaffirs', 'kike', 'kikes',
  'mick', 'micks', 'negress', 'negresses', 'negro', 'negroes', 'negros',
  'nig', 'nigs', 'nigger', 'niggers', 'paki', 'pakis', 'pickaninny',
  'polack', 'polacks', 'quadroon', 'quadroons', 'raghead', 'ragheads',
  'redskin', 'redskins', 'sambo', 'sambos', 'spic', 'spics', 'spik', 'spiks',
  'squaw', 'squaws', 'wetback', 'wetbacks', 'wog', 'wogs', 'wop', 'wops',
  'yid', 'yids', 'zipperhead',
  // Orientation / gender slurs.
  'dyke', 'dykes', 'fag', 'fagot', 'fagots', 'fags', 'faggot', 'faggots',
  'homo', 'homos', 'poof', 'poofs', 'poofter', 'tranny', 'trannies',
  // Ableist slurs.
  'cripple', 'cripples', 'imbecile', 'imbeciles', 'mongoloid', 'mongoloids',
  'retard', 'retards', 'retarded', 'spastic', 'spastics',
];

/** Sexual, violent and scatological terms that would break a 4+ rating. */
const CRUDE = [
  'anal', 'anus', 'anuses', 'arse', 'arses', 'ballsack', 'ballsacks',
  'bastard', 'bastards', 'bitch', 'bitches', 'blowjob', 'blowjobs', 'boner',
  'boners', 'bollock', 'bollocks', 'bugger', 'buggers', 'bukkake', 'bung',
  'cameltoe', 'clit', 'clits', 'clitoris', 'cock', 'cocks', 'coitus',
  'condom', 'condoms', 'coprophilia', 'crap', 'crapped', 'crapper',
  'crappers', 'crapping', 'craps', 'cum', 'cums', 'cunt', 'cunts', 'dick',
  'dicks', 'dildo', 'dildos', 'dong', 'dongs', 'douche', 'douches',
  'ejaculate', 'erection', 'erections', 'fart', 'farted', 'farter',
  'farters', 'farting', 'farts', 'felch', 'fellatio', 'fetish', 'fetishes',
  'foreskin', 'foreskins', 'fuck', 'fucked', 'fucker', 'fuckers', 'fucking',
  'fucks', 'genitalia', 'gonad', 'gonads', 'handjob', 'hooker', 'hookers',
  'horny', 'incest', 'jizz', 'labia', 'masturbate', 'molest', 'molested',
  'molester', 'molesters', 'molesting', 'molests', 'nipple', 'nipples',
  'nude', 'nudes', 'nudity', 'orgasm', 'orgasms', 'orgy', 'orgies', 'penis',
  'penises', 'phallus', 'piss', 'pissed', 'pisser', 'pissers', 'pissing',
  'porn', 'porno', 'pornos', 'prick', 'pricks', 'pube', 'pubes', 'pubic',
  'pussy', 'pussies', 'queef', 'rape', 'raped', 'raper', 'rapers', 'rapes',
  'raping', 'rapist', 'rapists', 'rectum', 'rectums', 'scat', 'scats',
  'scrotum', 'scrotums', 'semen', 'semens', 'shag', 'shagged', 'shagging',
  'shags', 'shit', 'shits', 'shitted', 'shitter', 'shitters', 'shitting',
  'slut', 'sluts', 'smegma', 'sodomy', 'sperm', 'sperms', 'testicle',
  'testicles', 'tit', 'tits', 'titties', 'titty', 'turd', 'turds', 'twat',
  'twats', 'urinal', 'urinals', 'urinate', 'urine', 'vagina', 'vaginas',
  'vulva', 'vulvas', 'wank', 'wanker', 'wankers', 'wanks', 'whore', 'whores',
];

/** Self-harm and extreme violence — inappropriate as a scoring "win". */
const HARM = [
  'lynch', 'lynched', 'lyncher', 'lynchers', 'lynches', 'lynching',
  'lynchings', 'suicide', 'suicides',
];

/*
 * Words that are not slurs and are perfectly ordinary English, but which no
 * player should ever be asked to SPELL FOR POINTS in this game.
 *
 * The catalogue is 305 hand-authored boards about Black American life. A
 * generated board that scores a player for finding `racist`, or `slave`, or
 * `massa` in a letter wheel is not edgy, it is the product tripping over its
 * own subject — and because generated boards are drawn from a seeded shuffle,
 * nobody would have chosen it or noticed until a player did.
 *
 * Found by accident: `racist` surfaced in the vetted BASE pool, meaning a
 * different seed or a larger set could have promoted it to a board's base
 * word. None of these currently ship. That is luck, not design, and this list
 * is the design.
 */
const RACIAL_HARM = [
  'racist', 'racists', 'racism', 'racisms',
  'slave', 'slaves', 'slaver', 'slavers', 'slavery', 'slaved', 'slaving',
  'massa', 'massas', 'mammy', 'mammies', 'picaninny', 'pickaninny',
  'noose', 'nooses', 'klan', 'klans', 'chattel', 'chattels',
  'segregate', 'segregated', 'segregates', 'segregation',
  'apartheid', 'colonize', 'colonized', 'colonizer', 'colonizers',
  'whipping', 'whippings', 'shackle', 'shackles', 'shackled',
  'bondage', 'bondages', 'overseer', 'overseers',
];

/*
 * Religious and ethnic identity terms.
 *
 * Not slurs, and mostly ordinary English — which is exactly why they were
 * never caught. The objection is the same one that applies to `racist` and
 * `slave`: this game SCORES the words a player spells, and a board that awards
 * points for `jew`, `papist` or `infidel` has turned somebody's identity, or a
 * word used against it, into a token worth four points.
 *
 * Prompted by a report of `shia` in the Gulf Coast pack. That word is not in
 * ENABLE1 and never shipped — but `danish` is a base in that pack, its wheel
 * spells it, and a player reasonably read the wheel as offering it. The wheel
 * is the surface people judge, so the list is written to cover the class
 * rather than the one report: several of these ARE in ENABLE1, none currently
 * ship, and that is luck rather than design.
 *
 * Deliberately not here: `church`, `chapel`, `deacon`, `pastor`, `parish`,
 * `hymn`, `choir`, `amen`. Those are places, roles and practices, they are all
 * over the Sunday Service and Fish Fry packs, and removing them would gut the
 * catalogue to no purpose. The line is naming a PEOPLE, not naming a practice.
 */
const IDENTITY = [
  'jew', 'jews', 'jewess', 'jewesses',
  'papist', 'papists', 'infidel', 'infidels',
  'gentile', 'gentiles', 'pagan', 'pagans',
  'shia', 'shias', 'sunni', 'sunnis', 'sikh', 'sikhs',
  'hindu', 'hindus', 'muslim', 'muslims', 'mormon', 'mormons',
  'zionist', 'zionists',
];

export const SLUR_LIST = SLURS;
export const BLOCKLIST = new Set([...SLURS, ...CRUDE, ...HARM, ...RACIAL_HARM, ...IDENTITY]);

/** True when a word must never be shown to a player. */
export function isBlocked(word) {
  return BLOCKLIST.has(String(word).trim().toLowerCase());
}

/**
 * True when a passage of PROSE contains a slur.
 *
 * Separate from `isBlocked` because a clue is a sentence, not a word: matched
 * on token boundaries so `scunner` and `class` survive, and checked against
 * SLURS plus the period-racial vocabulary that Webster's 1913 uses freely in
 * otherwise ordinary definitions.
 */
const PROSE_SLURS = new Set([
  ...SLURS,
  'negroes', 'negroe', 'mulatto', 'mulattoes', 'octoroon', 'octoroons',
  'savages', 'heathen', 'heathens', 'oriental', 'orientals', 'mohammedan',
  'mohammedans', 'mahometan', 'mahometans', 'hottentot', 'hottentots',
  'esquimaux', 'aborigines',
]);

/*
 * Institutions that name themselves with a word the filter otherwise blocks.
 *
 * The gate above exists because Webster's 1913 used period racial vocabulary
 * inside ordinary entries — `obis` shipped with "sorcery... practiced among the
 * negroes of the". That is the case it must keep catching.
 *
 * It is not this case. The National Council of Negro Women is Mary McLeod
 * Bethune's organisation, founded in 1935, led by Dorothy Height from 1957 to
 * 1998, and still operating under that name. The United Negro College Fund
 * still raises money for HBCUs under that name. The Negro Leagues are what the
 * Negro Leagues were called. A filter that cannot let a game about Black
 * American life name these is not protecting anybody — it is erasing the
 * institutions Black Americans built and named themselves, which is a worse
 * failure than the one it was written to prevent.
 *
 * So: exact institutional names pass, and the bare word still does not.
 */
const PROPER_NAMES = [
  'national council of negro women',
  'united negro college fund',
  'negro motorist green book',
  'negro leagues',
  'negro league',
  'negro national league',
  'american negro theatre',
  'negro ensemble company',
  'journal of negro history',
  'association for the study of negro life and history',
];

export function containsSlur(text) {
  let scrubbed = String(text).toLowerCase();
  for (const name of PROPER_NAMES) scrubbed = scrubbed.split(name).join(' ');
  const tokens = scrubbed.match(/[a-z]+/g) ?? [];
  return tokens.some((t) => PROSE_SLURS.has(t));
}
