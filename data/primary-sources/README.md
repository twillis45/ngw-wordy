# Primary sources — full text

The themed packs make factual claims. This directory holds the **complete text of
the public-domain documents those claims rest on**, so a clue can be checked
against the document rather than against a summary of it.

Every file here is a US federal government work — a statute, a Supreme Court
opinion, a presidential proclamation or executive order, a military general
order, or the text of the Constitution. None of it carries copyright: 17 U.S.C.
§ 105 for federal works, and the government-edicts doctrine (*Banks v.
Manchester*, 128 U.S. 244 (1888); *Georgia v. Public.Resource.Org*, 590 U.S. 255
(2020)) for statutes and judicial opinions.

## The boundary — what must never be stored here

Copyrighted works do not go in this directory, no matter how central they are to
a pack. **In particular, do not archive the text of Martin Luther King Jr.'s
speeches or sermons.** The King estate holds those copyrights and enforces them
actively; "I Have a Dream" (1963) and "I've Been to the Mountaintop" (1968) are
under copyright until 2058 and 2063 respectively. Cite them, date them, describe
what they say — never paste them. The same rule applies to book text, documentary
transcripts, oral-history recordings, song lyrics, and any other speech still in
copyright.

## Index

All files retrieved 2026-08-10.

| Slug | Document | Date | Source URL fetched | Public-domain basis |
|---|---|---|---|---|
| `general-order-no-3-1865` | General Orders, No. 3, Headquarters District of Texas, Galveston (the Juneteenth order) | 19 Jun 1865 | https://visit.archives.gov/whats-on/explore-exhibits/general-order-no-3-june-19-1865 | US Army general order; federal government work, 17 U.S.C. § 105 |
| `emancipation-proclamation-1863` | The Emancipation Proclamation | 1 Jan 1863 | https://www.archives.gov/exhibits/featured-documents/emancipation-proclamation/transcript.html | Presidential proclamation; federal government work |
| `amendments-13-14-15` | Amendments XIII, XIV and XV to the US Constitution | ratified 6 Dec 1865 / 9 Jul 1868 / 3 Feb 1870 | https://www.archives.gov/founding-docs/amendments-11-27 | Constitutional text; edict of government |
| `brown-v-board-of-education-1954` | *Brown v. Board of Education of Topeka*, 347 U.S. 483 | 17 May 1954 | https://static.case.law/us/347/cases/0483-01.json | Judicial opinion; government-edicts doctrine |
| `brown-v-board-of-education-ii-1955` | *Brown v. Board of Education* (Brown II), 349 U.S. 294 | 31 May 1955 | https://static.case.law/us/349/cases/0294-01.json | Judicial opinion; government-edicts doctrine |
| `civil-rights-act-1964` | Civil Rights Act of 1964, Pub. L. 88-352, 78 Stat. 241 | 2 Jul 1964 | https://www.govinfo.gov/content/pkg/STATUTE-78/pdf/STATUTE-78-Pg241.pdf | Statute; edict of government + 17 U.S.C. § 105 |
| `voting-rights-act-1965` | Voting Rights Act of 1965, Pub. L. 89-110, 79 Stat. 437 | 6 Aug 1965 | https://www.govinfo.gov/content/pkg/STATUTE-79/pdf/STATUTE-79-Pg437.pdf | Statute |
| `fair-housing-act-1968` | Civil Rights Act of 1968, Pub. L. 90-284, 82 Stat. 73 — Title VIII is the Fair Housing Act | 11 Apr 1968 | https://www.govinfo.gov/content/pkg/STATUTE-82/pdf/STATUTE-82-Pg73.pdf | Statute |
| `executive-order-9981-1948` | Executive Order 9981, desegregating the armed forces (13 Fed. Reg. 4313) | 26 Jul 1948 | https://www.archives.gov/milestone-documents/executive-order-9981 | Executive order; federal government work |
| `morrill-act-1890` | Second Morrill Act, ch. 841, 26 Stat. 417 — created the public 1890 land-grant HBCUs | 30 Aug 1890 | https://www.govinfo.gov/content/pkg/STATUTE-26/pdf/STATUTE-26-Pg417-2.pdf | Statute |
| `plessy-v-ferguson-1896` | *Plessy v. Ferguson*, 163 U.S. 537, including Harlan's dissent | 18 May 1896 | https://static.case.law/us/163/cases/0537-01.json | Judicial opinion; government-edicts doctrine |

Each `.txt` file opens with a header repeating its title, date, source URL,
public-domain basis and retrieval date, so a file stays self-describing if it is
moved or quoted out of this directory.

## Provenance notes, per document

**Statutes** are extracted from the govinfo scans of the *United States Statutes
at Large* with `pdftotext -layout`. These are page images of the printed volume,
so the marginal running notes the Government Printing Office set alongside the
text appear inline, and the OCR is imperfect on some words. The statutory text
itself is complete and in order. Where the printed page that begins an act also
carries the tail of the preceding act, that fragment is left in rather than
guessed at — this affects the top of `voting-rights-act-1965` (eight lines closing
an unrelated public health act approved 5 August 1965; the Voting Rights Act
itself begins at the "Public Law 89-110" line) and the head and tail of `morrill-act-1890` and
`fair-housing-act-1968`. The `fair-housing-act-1968` file is the **whole** 1968
Civil Rights Act, 82 Stat. 73-92; Title VIII begins at 82 Stat. 81.

**Supreme Court opinions** are the Caselaw Access Project's transcription of the
official *United States Reports* — clean text with head matter, syllabus,
counsel, opinion and (for *Plessy*) the full Harlan dissent. The Library of
Congress page images of the same official reporter volumes were fetched and
compared, and are recorded in each file's header as the verification source:

- 347 U.S. 483 — https://tile.loc.gov/storage-services/service/ll/usrep/usrep347/usrep347483/usrep347483.pdf
- 349 U.S. 294 — https://tile.loc.gov/storage-services/service/ll/usrep/usrep349/usrep349294/usrep349294.pdf
- 163 U.S. 537 — https://tile.loc.gov/storage-services/service/ll/usrep/usrep163/usrep163537/usrep163537.pdf

The LOC scans are the more official artefact but are raw OCR of mid-century
print and garble words ("Fourteenth Amendfnent"). The transcription is stored
instead because a garbled document cannot ground a factual claim; the official
page images remain one click away for anyone checking a quotation.

**General Order No. 3** is the shortest and the most load-bearing document here.
The original is in NARA Record Group 393, *Records of U.S. Army Continental
Commands*, orders issued by the District of Texas. The two operative paragraphs
are the National Archives Museum transcription verbatim; the heading, date line
and signature block (Maj. Gen. Gordon Granger, by F. W. Emery, Major & A.A.
Genl.) follow the original order sheet. Note that popular quotation of this order
varies in punctuation and in whether "all slaves are free" carries its quotation
marks — the NARA wording is what is stored.

**Nothing failed to retrieve.** All eleven requested documents are here in full.

## Related

- `docs/research/README.md` — the sourcing standard these documents serve.
- `docs/research/CANON.md` and `data/canon.json` — what individual clues cite.
