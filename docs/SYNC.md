# Optional sync

Off unless a build sets `NEXT_PUBLIC_SYNC_URL`. Unconfigured, the UI never
renders, no network call is possible, and `connect-src` stays `'self'` — a build
that does not opt in is byte-for-byte as private as it was before this existed.

## Why it exists, and why it is optional

Asked whether the no-account posture was worth more than real sync, the player
board split hard. Every paying seat would take a login. Six seats refuse one
outright — one because a signup screen is a delete, another because a mandatory
account is also an accessibility barrier. They did not vote to spend the privacy
win; they voted for **optional account, no wall**.

## Why this beats the leader instead of matching it

NYT Games requires an account and can read everything in it. Here there is no
email, no username, no password reset, and nothing the operator can decrypt.

- The passphrase never leaves the device.
- PBKDF2-HMAC-SHA256 at 600,000 iterations derives a master secret, then HKDF
  splits it into **two independent values under different labels**: a sync id
  and an AES-GCM key. The server learns the id. It never sees the key, and the
  id cannot be walked back to it.
- Progress is sealed before upload, with a fresh IV each time so two identical
  uploads never produce identical ciphertext — otherwise the server could tell
  that a player's progress had not changed.

Verified against a mock endpoint. What the server actually received:

```
PUT id=530fc1410adc08485f327f7984fca7e5  bytes=1016
    body="TGKqKkxYk7nt8SkuzDfMIh/PcVRIgNqzWs7Zt5NGdyz7SYGZ565IKkNoS268sMUDb/rD5mjS…"
```

A wrong passphrase derives a **different id**, so it 404s rather than failing to
decrypt — the server cannot confirm whether an account exists at all.

## The honest limit

Forget the passphrase and the progress is gone. There is no reset, because a
reset would require the operator to hold something that could open the box. The
UI states this before the player chooses, not after.

## Server contract

Two routes. The server is a dumb key-value store for opaque blobs; it needs no
knowledge of Wordy and should be given none.

```
PUT /v1/blob/:id      body: base64 ciphertext, text/plain    -> 204
GET /v1/blob/:id                                             -> 200 + body
                                                             -> 404 if absent
```

`:id` is 32 lowercase hex characters. Reject anything else.

CORS must allow the game's origin for `GET`, `PUT`, `OPTIONS` and the
`content-type` header.

### What the server must NOT do

- **No logging of bodies.** They are ciphertext, but a log is still a copy.
- **No account model, no email, no recovery.** There is nothing to recover.
- **No listing endpoint.** Ids are unguessable; an index makes them enumerable.
- **No analytics.** The privacy posture is one of only two wings beating the
  leader, and it is spent the moment this server starts taking notes.

### Suggested limits

- Cap a body at 8 KB. A real code is ~1 KB; anything larger is abuse.
- Rate-limit `PUT` per id and per IP. The id is derived from a passphrase, so a
  slow online guessing attack is the realistic threat, and 600k PBKDF2
  iterations already make it expensive on the client side.
- Expire blobs untouched for a year, and say so in the UI before that ships.

## Local verification

```bash
node /tmp/mocksync.mjs                 # or any KV store honouring the contract
NEXT_PUBLIC_SYNC_URL=http://localhost:4900 npx next build
```

Then push on one profile, pull on a clean one, and read the server log: it
should show an opaque id and unreadable bytes, and nothing else.
