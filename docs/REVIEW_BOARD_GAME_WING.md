# NGW Review Board — GAME WING (Wordy)

Created 2026-08-09. Companion to the main roster in `ngw-event-planner`
`demo/docs/claude-skills/REVIEW_BOARD_ROSTER.md`. **Keep in sync with the
`feedback_review_board_roster` memory.**

The standing NGW roster is design-stars + event-industry-pros. Wordy is a
**game**, shipping to **web + App Store + Google Play**. The event wing has no
authority here and is NOT convened. These seats are.

Same rules as always: **lens-not-literal** (channel each person's publicly known
signature principle, a synthesis of their philosophy — never fabricate quotes or
claim the individual reviewed anything), **render-first**, **brutal not
consensus**, **reviewers complete a workflow end-to-end**, **measure don't
eyeball** ([[feedback_board_hierarchy_audit]]), and **the surface scores as its
LOWEST dimension** — bless = 10+ ([[feedback_bless_threshold]]).

---

## 1. GAME DESIGN & THE CORE LOOP (go FIRST — is it even fun?)

- **Jesse Schell** (*The Art of Game Design*) — the Lenses; "what is the
  essential experience, and does every system serve it?"
- **Zach Gage** (*Good Sudoku*, *Knotwords*, *Really Bad Chess*) — the modern
  puzzle-game auteur; teaching without tutorials, respecting the player's
  intelligence, making an old genre feel new.
- **Josh Wardle** (*Wordle*) — radical restraint; one a day, no account, no ads,
  shareable result. The anti-engagement-farming conscience.
- **Sid Meier** — "a series of interesting decisions"; is any choice here real?
- **Raph Koster** (*Theory of Fun*) — fun is learning; is the difficulty curve a
  teaching curve, and does mastery deepen?
- **Steve Swink** (*Game Feel*) — input responsiveness, juice, the tactile
  moment; "does the dial feel good in the hand?"
- **Jonathan Blow** — anti-dark-pattern; refuse manipulation, respect the player.

## 2. LAYOUT, HIERARCHY & VISUAL SYSTEM (cross-listed from the standing roster)

- **Dieter Rams** — less but better; ruthless reduction.
- **Jony Ive** — inevitability, material honesty.
- **Edward Tufte** — data-ink ratio; is the screen earning its pixels?
- **Julie Zhuo** — craft at ship; hierarchy of user needs.
- **Susan Kare** — iconography, warmth, making the technical human.
- Enforces the **semantic-hierarchy audit** rule: tabulate computed
  size/weight/colour by intended rank and assert monotonic decrease.

## 3. INTERACTION, MOTION & FEEL

- **Emil Kowalski** (Linear) — purposeful motion, restraint, haptic timing.
- **Rauno Freiberg** (Vercel) — craft-level interaction detail.
- **Game-feel designer** (Cultured Code / Things 3 Taptic discipline) — juice on
  the moment WITHOUT streaks/XP/badge theatre.

## 4. ONBOARDING, FRICTION & FIRST RUN

- **Luke Wroblewski** — mobile-first, thumb zones, progressive disclosure.
- **Don Norman** — affordances, signifiers, error prevention; "is this control
  lying about what it does?"
- **"Grandmother"** (permanent seat, NOT a star) — the non-technical
  first-timer. Decisive voice on clarity and trust; **holds a veto**. Shuts the
  laptop when confused.

## 5. ACCESSIBILITY (non-negotiable seat — every pass)

- **A WCAG 2.2 / mobile-a11y lead** — contrast, target size, focus order,
  screen-reader semantics, reduced motion, dynamic type.
- **A colour-vision-deficiency specialist** — ~8% of men have CVD; a word game
  that signals success with GREEN must not encode meaning in hue alone.
- **A motor-accessibility specialist** — drag-to-connect is a fine-motor
  gesture; is there a full non-drag path?

## 6. MONETIZATION & PAY

- **An F2P puzzle economy designer** (King / Playrix class) — hint currency,
  sinks and faucets, where a paywall belongs and where it poisons the loop.
- **A subscription strategist** (Duolingo / Blinkist class) — trial design,
  paywall placement, churn; free-tier generosity as acquisition.
- **A store-billing compliance specialist** — StoreKit / Play Billing rules,
  restore-purchases, price tiers, tax, receipt validation, "digital goods MUST
  use IAP."
- **Ramit Sethi** (cross-listed) — spend extravagantly on what you love; is the
  paid thing actually worth paying for, and is the ask honest?

## 7. STORE READINESS & RELEASE (web + iOS + Android)

- **An App Store Review specialist** — **Guideline 4.2 minimum functionality is
  the live grenade here: a repackaged website gets rejected.** Also 3.1.1 IAP,
  privacy nutrition labels, age rating, 2.1 completeness.
- **A Google Play policy specialist** — Data Safety form, target API level
  deadlines, Play Billing, Families policy if the age rating invites children.
- **A mobile release engineer** — Capacitor/TWA vs native, versioning, staged
  rollout, crash reporting, update path for a PWA-derived binary.

## 8. SECURITY, PRIVACY & IP

- **An application-security engineer** — client-side trust boundaries, CSP,
  XSS via definitions/share text, dependency supply chain, service-worker cache
  poisoning, what localStorage can be trusted for.
- **A privacy counsel** — GDPR/CCPA, analytics consent, data minimisation, and
  **COPPA/age-gating: a word game will attract children whether or not it is
  aimed at them.**
- **Content & IP counsel** — wordlist licence (ENABLE1), definition source
  licence (Webster 1913), theme names, trademark exposure in puzzle content.

## 9. CULTURAL AUTHENTICITY (permanent floating seat)

- Vets The Cookout / 90s R&B / Sitcom Sunday / HBCU / Barbershop for
  **insider-accuracy, not stereotype**; internal-diversity-aware;
  anti-appropriation; ASK-don't-ASSUME. Has authority to block content.

## 10. LIVE OPS & RETENTION

- **A daily-puzzle live-ops PM** (NYT Games class) — content cadence, streak
  design, notification ethics, what happens on day 2 and day 30.

---

## How to run it

1. **Render first.** `node scripts/capture-review.mjs <url>` against the
   PRODUCTION export (not the dev server) → `review-artifacts/`. Seven
   viewports × six states.
2. Dispatch one agent per wing. Each **reads the PNGs**, cross-references
   `file:line`, and completes a workflow — not a glance.
3. Design/game stars first → synthesize → accessibility, store, security and
   the Grandmother **override** where compliance or comprehension beats taste.
4. Each returns ranked findings with `file:line` and an **honest /10**.
5. Surface score = **lowest** dimension. Fix-the-lowest, re-render, repeat.
