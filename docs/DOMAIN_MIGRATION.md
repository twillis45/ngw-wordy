# Domain migration — github.io to a custom domain

Runbook. Written 2026-08-16, for STORE_READINESS **0.3**.

**Why this exists.** A TWA proves it owns its web content with a Digital Asset
Links file at `https://<domain>/.well-known/assetlinks.json` — the **origin
root**, not the app's sub-path. Today the app is served from
`https://twillis45.github.io/ngw-wordy/`, and that well-known path belongs to
the `twillis45.github.io` user-pages repo, not this one. This repo structurally
cannot publish it. Unverified, a TWA falls back to Custom-Tab UI **with a
visible address bar** — the "repackaged website" read we are trying to avoid.

So: **Play cannot start until a custom domain does.** Nothing else in the store
track is blocked on anything this cheap.

**The name is not settled, and this runbook does not depend on it.** Everywhere
below, `<domain>` is whatever gets bought. Exactly two files carry the choice:
`public/CNAME`, and the `package_name` in `assetlinks.json`.

Front-runner as of 2026-08-16 is **`sixonthedial.com`**, with `6onthedial.com`
and both `.app` variants also free — worth taking all four, because the only
real weakness of a digit name is that people hear "six" and type either
spelling, and owning both retires that problem permanently.

Its knockout search is clean: a USPTO wordmark search for `six` + `dial`
returns zero marks, live or dead. That is a knockout, **not clearance** — see
STORE_READINESS 1.11 for what is still owed.

Do not buy before that row closes. The point of clearing first is to avoid
paying for an asset that has to be abandoned.

---

## What is already in place

Committed ahead of the domain, and inert until `public/CNAME` exists:

- **`.github/workflows/pages.yml`** derives `NEXT_PUBLIC_BASE_PATH` and
  `NEXT_PUBLIC_SHARE_URL` from whether `public/CNAME` is present. With no CNAME
  it behaves exactly as before (`/ngw-wordy`, the Pages base URL). With one, it
  serves from the root. The two settings must agree, and deriving both from one
  file is what stops them drifting apart.
- **`public/.well-known/assetlinks.json`** exists with a placeholder
  fingerprint. Verified that Next's static export copies dot-directories out of
  `public/` — it does — and `.nojekyll` is already written by the workflow, so
  Pages will serve the path rather than let Jekyll strip it.

The file is **inert until step 6** replaces the fingerprint. It is deliberately
`REPLACE_WITH_...` rather than a plausible-looking hex string, so it cannot be
mistaken for a real one.

---

## Steps

### 1. Buy the domain

Only after 1.11 closes. Buy the `.app` alongside the `.com` — `.app` is
HSTS-preloaded at the TLD level, so HTTPS is structural rather than a setting
that can be turned off, which is worth having on the origin that will serve
asset links and universal links.

Point only one at the app. The others redirect.

### 2. DNS

Apex `A` records:

    185.199.108.153
    185.199.109.153
    185.199.110.153
    185.199.111.153

Apex `AAAA` records:

    2606:50c0:8000::153
    2606:50c0:8001::153
    2606:50c0:8002::153
    2606:50c0:8003::153

And `www` as a `CNAME` to `twillis45.github.io`.

**Pick apex or www as canonical and commit to it.** Android's verifier does not
follow redirects when fetching `assetlinks.json`, so the TWA's host must be
whichever one actually serves the file. Apex is the simpler choice here.

### 3. Add the CNAME file

    echo '<domain>' > public/CNAME

One line, no trailing whitespace — the workflow strips it, but the Pages UI is
less forgiving. Commit, open a PR, merge. That is the whole switch.

Note this is `public/CNAME`, not a CNAME committed to the deploy branch. We
deploy an Actions artifact, so the file has to be *in the export*; the repo
Settings → Pages field alone will not survive a rebuild.

### 4. Turn on HTTPS

Repo Settings → Pages → set the custom domain, then tick **Enforce HTTPS**.

The tick box is greyed out until the certificate is provisioned, which needs
DNS to have propagated and can take up to 24 hours. Do not skip it and do not
build the TWA before it is on: asset links are fetched over HTTPS only.

### 5. Verify the web move before touching Android

    curl -sI https://<domain>/ | head -3
    curl -s  https://<domain>/.well-known/assetlinks.json
    curl -s  https://<domain>/manifest.webmanifest | head -20

Expect: a 200 at the root, the asset links file served as `application/json`,
and a manifest whose `start_url` and icon paths have **no `/ngw-wordy` prefix**.
A stray prefix here means the CNAME was not in the export and the build took
the project-pages branch.

Then confirm STORE_READINESS **5.1** on the live deploy, which has been waiting
for a real origin: load the site, ship any change, reload once, and check the
new build is picked up.

### 6. Build the TWA, then fix the fingerprint

Bubblewrap init against the live manifest, build, upload to Play.

**Then** read the fingerprint from **Play Console → Test and release → App
integrity → App signing key certificate**, and put that SHA-256 into
`public/.well-known/assetlinks.json`.

This is the step that most often goes wrong. With Play App Signing enabled —
and it is mandatory for new apps — Google re-signs the app with *their* key. The
fingerprint from the local upload keystore is **not** the one that matters, and
using it produces a TWA that builds, installs, runs, and shows an address bar.

Commit the real fingerprint, let Pages redeploy, then verify:

    curl -s https://<domain>/.well-known/assetlinks.json

Google's statement-list tester:

    https://developers.google.com/digital-asset-links/tools/generator

On a device, verification state is readable directly:

    adb shell pm get-app-links com.<domain>.game

Look for `verified`. Anything else means the address bar will be there.

### 7. Package name

`assetlinks.json` currently claims `com.<domain>.game`. Whatever Bubblewrap
is configured with must match it exactly, and the package name is permanent —
Play will not let it change after the first upload.

---

## Known consequences of the move

- **The installed-app identity resets.** The manifest `id` is resolved against
  the origin, so moving hosts makes this a different app to the browser. Anyone
  who installed from `github.io` keeps a stale icon and gets a second install
  alongside it. Acceptable pre-launch; it would not be after.
- **The old origin keeps serving.** A service worker installed from
  `twillis45.github.io/ngw-wordy/` will go on serving its cached copy to anyone
  who has it, and nothing published at the new domain can reach it. If that
  matters, the last thing deployed to the old path should be a build whose
  worker unregisters itself.
- **Links already shared point at the old host.** The share card has been
  emitting `NEXT_PUBLIC_SHARE_URL` since it was wired up, so anything sent
  before the move keeps working only as long as the old Pages site stays up.

## Still owed after this

`apple-app-site-association`, also at `.well-known/`, for iOS universal links.
Not created yet on purpose — it needs a real Team ID and bundle ID, and there is
no Apple Developer account yet (STORE_READINESS 3.1). It belongs with the iOS
client work in 0.1, not with this migration.
