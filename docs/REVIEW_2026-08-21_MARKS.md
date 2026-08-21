# Review board — the mark, the rank marks, and the kit

Convened 2026-08-21. Game wing, 12 seats: four craft, two direction, six
players. Board rules apply — **measure don't eyeball**, **brutal not
consensus**, and the surface scores as its **LOWEST** dimension.

The board was proposed twice and rejected twice: the first panel was all
designers, and the second still carried its gaps as caveats rather than seats.
The rendered-asset seat and the cultural seat exist because a panel of
reduction-first designers reaches a foregone conclusion about 3D renders, and
because "these marks carry no cultural markers" was my call to make and I
should not have made it alone.

---

## Measured first

Every rank mark rendered at 32px, mean luminance of its non-transparent
pixels, 0–255.

| Rank | Luminance | Mean RGB |
|---|---|---|
| Novice | 31.6 | 32, 31, 36 |
| Solid | 49.7 | 52, 48, 55 |
| Sharp | 47.5 | 51, 46, 50 |
| Clever | 47.9 | 53, 46, 51 |
| Fluent | 40.8 | 44, 39, 45 |
| Wordsmith | 62.1 | 75, 59, 59 |
| Complete | 57.7 | 45, 61, 64 |

**Adjacent-rank gaps: Sharp → Clever is 0.4 of 255.** Solid → Sharp is 2.2.
Wordsmith → Complete is 4.4. Three of the six steps on this ladder are
separated by less than 2% of the available value range.

**The whole ladder spans 30.5 of 255** — twelve percent of the range, all of
it crowded into the dark end.

**And it is not monotonic.** Solid 49.7 → Sharp 47.5 → Clever 47.9 → Fluent
40.8. A player climbing from Solid to Fluent watches their mark get *darker*.
There is no visual variable on this ladder that moves in one direction, which
means the ladder does not encode rank at all — it is seven pictures in an
arbitrary order.

Separately, from the kit: **zero** occurrences of clear space, minimum size,
misuse, monochrome, favicon, safe area, lockup, or social/OG spec.

## The renders themselves — evidence in the record

The board's own rules say render first and reviewers **read the PNGs**. The
first version of this review was written from the luminance table and my own
look at a contact sheet, and the images were never put into the record. They
are now, in `docs/brand/review/`:

- `marks-contact-sheet.png` — the mark and the icon at 128 / 64 / 32 / 16, the
  ladder at display size, and the ladder at 32.
- `ladder-at-32.png` — the seven ranks at the size the rail actually renders.
- `ladder-at-32-greyscale.png` — the same with hue removed, which is the
  closest cheap approximation of what the hue-encoding costs.

**One finding in the first version was WRONG and the images corrected it.** I
wrote that form repeats across the ladder while only colour changes. It does
not: Novice is a ring, Sharp is a scattered cluster, Wordsmith is a wide flat
form, and the others are flowers of varying centre treatment. The silhouettes
genuinely differ.

The accurate finding is worse, not better. **The forms differ but they do not
ORDER.** Nothing about a ring says "below" a cluster, and nothing about a
cluster says "below" a flower. So the ladder has two channels — hue and form —
and neither is monotonic, which is why the measurement and the eye agree that
climbing shows you nothing. A ladder needs one variable that only ever moves
one way; this has two that both wander.

**The plinth is the same in all seven** and occupies roughly a third of each
image's height. It is the one element that is genuinely consistent, and it is
consistent in the place where consistency costs the most: it spends a third of
a 32px budget saying nothing that distinguishes one rank from another.

**On "indistinguishable".** The greyscale sheet is rendered at 3x, and at that
magnification the silhouettes ARE separable. At the size the rail draws them
they are not — that is what the 32px browser capture shows and what the
luminance table explains. The claim is about rendered size, not about the
artwork in isolation, and the first version of this review did not draw that
line clearly enough.

## The two languages

The mark is a flat geometric dial: six dots, one accented. The rank marks are
photorealistic 3D renders — glossy forms on stone plinths, with specular
highlights and cast shadows. Placed side by side they do not read as one
brand, and a single screenshot containing both reads as two products.

---

## Findings

**Paul Rand lens — 3/10 on the family, 6/10 on the mark alone.** The mark
survives reduction to about 32px and then stops: at 16px the dots merge and
the accent dot, which is the only thing distinguishing this from a generic
six-dot loader, is the first casualty. The lens that matters here is his
practice of marks built to work in one colour at any size — this family has no
one-colour version at all, and the rank marks cannot have one, because
photorealism *is* their differentiator.

**Dieter Rams lens — 2/10 on the rank marks.** "Good design is as little
design as possible." A rank is one ordered variable with seven values. It is
being carried by modelling, lighting, material and hue, none of which is
ordered, and the measurement shows the result: the variable is not encoded.

**CVD specialist — 2/10, blocking.** The only reliable separation across the
ladder is hue, and the luminance data shows why that is not a stylistic
observation: with hue removed, three adjacent pairs differ by under 5/255. The
kit's own accessibility commitments say meaning must not be encoded in hue
alone. This ladder does exactly that, and it is the *reward* surface.

**Small-size icon specialist — 4/10.** The mark is judged at the size it is
used. Measured: at 16px the dot grid becomes a smudge; at 29px the app icon's
accent dot is one pixel of orange. No minimum size is documented anywhere, so
nothing prevents either use.

**Rendered-asset specialist — 5/10, and the dissent is worth recording.**
This seat argues the failure is execution, not medium: silhouette, value
contrast and a distinct read per rank are all achievable in 3D, and the
renders are the one warm, tactile thing in an otherwise austere interface —
throwing them out for a flat redraw loses the only place the product has
texture. It accepts the measurement and rejects the conclusion drawn from it.
**It did not carry the room**, but it changed the recommendation: fix the
encoding first, decide the medium second.

**Cultural authenticity seat — no block, one question raised.** The marks
themselves carry no cultural markers, which is what I claimed. The question
this seat raises is the one I would have missed: the ladder names a hierarchy
of verbal skill — Novice to Wordsmith — attached to a catalogue largely about
Black American cultural life, and rendered as trophies on plinths. It does not
object; it asks that the framing be looked at by a reader from that community
rather than settled by a panel. **That is the reader budget already blocked at
STORE_READINESS 1.10, still unhired.**

### The players

**Home-screen player — 4/10.** Six white dots on dark is what a dozen
utilities look like. Findable is a different property from correct, and this
icon is correct.

**Rank-earner — 1/10, and this is the lowest score in the review.** "I cleared
five rows and got a slightly different brown lump." The ladder's whole job is
to make climbing visible, and the measurement says climbing is invisible —
worse than invisible, since Fluent is darker than Solid.

**Screenshot sharer — 3/10.** A 3D render beside a flat dot-mark in one image
reads as two products. This is the surface strangers see first.

**Tab-strip player — 3/10.** At 16px among twenty favicons the tab cannot be
found. Every player today is a web player.

**CVD player — 2/10.** "I cannot tell Sharp from Clever." Not a compliance
observation; a usability one.

**Returning player — 4/10.** Memorable is a third property, after legible and
findable, and it is the one a mark exists for. A dot grid is not it.

---

## Score

**Surface score: 1/10** — the board scores as its lowest dimension, and the
lowest is the rank-earner's, which is also the one the measurement most
directly supports.

## Rulings

1. **Fix the encoding before the medium.** The ladder needs one ordered
   variable that moves in one direction across all seven ranks — value is the
   obvious candidate and is currently non-monotonic. This is required whether
   the marks stay rendered or are redrawn, which is why it comes first and why
   the rendered-asset seat's dissent does not change it.
2. **Add a second, non-hue channel.** Form, count or fill, so the ladder
   survives greyscale and CVD. Blocking, per the accessibility seat and the
   kit's own commitments.
3. **Document minimum sizes and produce a one-colour mark.** Nothing today
   stops the mark being used at 16px, where it fails.
4. **Decide the family question explicitly.** Flat mark plus rendered ranks is
   currently an accident, not a decision. Either is defensible; having both
   without having chosen is not.
5. **The kit is missing its governing half** — clear space, minimum size,
   misuse, lockups, monochrome, favicon and social specs. It documents assets;
   it does not govern them.

## What the board did not decide

- **Whether to keep the renders.** The dissent is recorded rather than
  overruled, and ruling 1 is deliberately medium-agnostic.
- **The ladder's framing.** Raised by the cultural seat, unanswered, and not
  answerable here — it needs the 1.10 reader.
- **Nobody here is cited for 3D art direction** as a craft; that seat is an
  archetype standing for the direction rather than an authority on it.
