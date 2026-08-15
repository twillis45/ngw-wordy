/**
 * One place that knows how to open a browser.
 *
 * Every runtime check in this repo — check-rail, check-intro, check-hydration,
 * and the two capture scripts — drives a real Chrome, and each had found its
 * own way to one. Four of them resolved puppeteer through
 * `createRequire('/Users/toddwillis/Code/ngw-core/')`, i.e. out of a DIFFERENT
 * REPOSITORY's node_modules on one laptop, and the fifth hardcoded the macOS
 * app bundle path. So the checks that hold the strongest claims in the project
 * — the rail holds at five viewports, the teach retires, the export hydrates —
 * were the only ones that could not run anywhere but this machine, and
 * therefore the only ones CI could never run.
 *
 * puppeteer-core is a devDependency of THIS repo and always was.
 *
 * Chrome itself is resolved in order: CHROME_PATH, then the usual macOS
 * bundle, then the names a Linux CI image installs. Nothing is downloaded —
 * puppeteer-core deliberately ships no browser, which is why it is the
 * dependency and `puppeteer` is not.
 */
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean);

const exists = (p) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
};

/** The first Chrome that actually exists, or a message naming every path tried. */
export function chromePath() {
  /*
   * CHROME_PATH is an instruction, not a hint. If it is set and wrong, say so
   * — falling through to a different browser would answer a question about the
   * one that was asked for with a measurement of another.
   */
  if (process.env.CHROME_PATH) {
    if (exists(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
    throw new Error(`CHROME_PATH is set to "${process.env.CHROME_PATH}", which does not exist.`);
  }
  const found = CANDIDATES.find(exists);
  if (found) return found;
  throw new Error(
    'No Chrome found. Set CHROME_PATH, or install one of:\n  ' +
      CANDIDATES.join('\n  ')
  );
}

/** Headless Chrome, resolved the same way for every check in the repo. */
export function launch(options = {}) {
  return puppeteer.launch({
    headless: 'new',
    executablePath: chromePath(),
    // --no-sandbox is required in the CI container and harmless locally.
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    ...options,
  });
}

export { puppeteer };
