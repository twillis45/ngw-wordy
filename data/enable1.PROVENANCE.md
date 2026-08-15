# enable1.txt — where it came from and what permits shipping it

Store readiness 1.8. The word list ships inside the binary on both stores, so
"public domain in practice" is not good enough — this is the record of what was
actually checked, on 2026-08-14.

## What ships

```
path      data/enable1.txt
sha256    3f16130220645692ed49c7134e24a18504c2ca55b3c012f7290e3e77c63b1a89
lines     172,823
bytes     1,743,363
```

Asserted in `src/lib/content.test.ts`, so the file that was vetted is the file
that ships. A different list — a newer edition, a "cleaned" copy, somebody's
fork — changes the hash and fails the suite rather than quietly replacing the
thing this document describes.

## Where it came from

Byte-identical to the copy at
`https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt`,
re-downloaded and compared on 2026-08-14: same sha256, same 1,743,363 bytes.

That repository is a **mirror and carries no licence file of its own**, which
is why the permission below is cited from the ENABLE project rather than from
where the bytes were fetched.

## The permission

ENABLE — the Enhanced North American Benchmark LExicon — was compiled as a
public-domain alternative to the copyrighted official Scrabble dictionaries.
The project's own readme releases the master list explicitly:

> The ENABLE master word list, WORD.LST, is herewith formally released into the
> Public Domain.

and, on the file's role:

> WORD.LST (pronounced "word-dot-list") is the generic term for the
> ASCII-format word file released into the Public Domain as a standard and a
> reference for crossword-type games.

On authorship, the same document:

> The accuracy of the WORD.LST is due, in great part, to the herculean efforts
> of Alan Beale.

Sources for the quotations: the ENABLE2K readme as archived at
`https://github.com/BartMassey/wordlists/blob/main/README-enable2k.txt`, whose
own index adds "This list was placed in the Public Domain by its creators."

## What is honestly still soft

Three things, stated so nobody later mistakes this page for a signed licence.

**The permission is not in the file.** `enable1.txt` is 172,823 bare words with
no header, no notice and no licence. The release statement lives in the
project's readme, which is a separate document, and the copy this repo fetched
its bytes from does not carry that readme. The quotations above are therefore
cited from an archived copy of the project's document, not from anything that
travels with the data.

**Our file is ENABLE 1.x, not ENABLE2K.** The readme quoted above is the
millennial edition, and it counts 173,528 words against our 172,823 — so it
describes a later revision of the same project's list. The public-domain
release is of WORD.LST, the project's master list, which is what both editions
are; but the sentence was written about the later one.

**Public domain is a claim about a place.** The dedication is unambiguous in
the US. Some jurisdictions do not let an author abandon copyright the way a US
author can, and neither store restricts distribution by jurisdiction. This has
not been reviewed by a lawyer, and it is the one part of 1.8 that a lawyer, not
a hash, would close.

None of the three is a reason to hold the release. All three are reasons the
row says what was checked rather than "fine".

## If someone wants to close the last gap

Ask the attorney reviewing the store filing whether a public-domain dedication
made by a US author in 1997 needs a fallback licence (CC0 is the usual answer)
for distribution in territories that do not recognise abandonment. That is a
ten-minute question for someone already reading the filing, and it is cheaper
to ask then than after a takedown.
