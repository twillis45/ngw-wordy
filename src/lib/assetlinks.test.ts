/*
 * assetlinks.json is the file that decides whether the Android app shows an
 * address bar.
 *
 * A TWA proves it owns its web content by matching its signing certificate
 * against this file at the ORIGIN ROOT. If the match fails, Android does not
 * error — it silently falls back to Custom Tab UI **with a visible address
 * bar**, which is precisely the "repackaged website" read the whole store
 * effort exists to avoid. Nobody gets told. The app just looks cheap.
 *
 * So the failure this guards is not a missing file. It is a file that is
 * PRESENT, valid JSON, served with the right content type, and wrong in one
 * character. That is invisible until a reviewer opens the app.
 *
 * Two legal states, and nothing in between:
 *   1. UNBUILT   — the fingerprint is the literal placeholder. No app exists
 *                  yet, so nothing can match, and that is honest.
 *   2. WIRED     — the fingerprint is 32 colon-separated uppercase hex pairs,
 *                  which is the only shape Play App Signing emits.
 *
 * A half-filled file — a truncated hash, lowercase, spaces, a SHA-1 from the
 * wrong screen in Play Console — is the state this test exists to make
 * impossible.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PLACEHOLDER = 'REPLACE_WITH_PLAY_APP_SIGNING_SHA256_FINGERPRINT';
const raw = readFileSync(new URL('../../public/.well-known/assetlinks.json', import.meta.url), 'utf8');

describe('assetlinks.json', () => {
  const doc = JSON.parse(raw) as Array<{
    relation: string[];
    target: { namespace: string; package_name: string; sha256_cert_fingerprints: string[] };
  }>;

  it('is a non-empty array of statements', () => {
    expect(Array.isArray(doc)).toBe(true);
    expect(doc.length).toBeGreaterThan(0);
  });

  it('delegates URL handling to an android_app', () => {
    expect(doc[0].relation).toContain('delegate_permission/common.handle_all_urls');
    expect(doc[0].target.namespace).toBe('android_app');
  });

  /*
   * The package name must match the domain, because a mismatch is the other
   * silent failure: Android looks for the statement belonging to the package
   * that is asking, finds none, and falls back. `com.sixonthedial.game` and
   * not `com.6onthedial.game` — an Android package segment cannot begin with
   * a digit, so the spelled form was always the identity. See
   * docs/DOMAIN_MIGRATION.md.
   */
  it('names the package that actually ships', () => {
    expect(doc[0].target.package_name).toBe('com.sixonthedial.game');
    expect(doc[0].target.package_name.split('.').some((seg) => /^\d/.test(seg))).toBe(false);
  });

  it('carries exactly one fingerprint', () => {
    expect(doc[0].target.sha256_cert_fingerprints).toHaveLength(1);
  });

  /*
   * THE ONE THAT MATTERS. Either the honest placeholder, or a fingerprint in
   * the exact shape Play App Signing emits. Never anything else.
   */
  it('is either an honest placeholder or a well-formed SHA-256', () => {
    const fp = doc[0].target.sha256_cert_fingerprints[0];
    if (fp === PLACEHOLDER) return; // unbuilt, and saying so
    expect(fp, 'fingerprint must be 32 colon-separated uppercase hex pairs')
      .toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    // A SHA-1 is 20 pairs and lives one screen away in Play Console. It is
    // the single easiest wrong value to paste in.
    expect(fp.split(':')).toHaveLength(32);
  });

  it('has no placeholder left anywhere once a fingerprint is real', () => {
    const fp = doc[0].target.sha256_cert_fingerprints[0];
    if (fp === PLACEHOLDER) return;
    expect(raw).not.toContain('REPLACE_WITH_');
  });
});
