# myHub Tile Display Standards

One canonical reference for how every tile formats dates, money, status, headers, spacing, and color — so tiles look like one product, not twenty connectors bolted together.

Grounded in a full audit of ~197 shipped widgets across 40+ plugins (2026-08-05). Before this document, no such standard existed anywhere in this repo or myHubV2 — see "Why this exists" at the bottom.

A condensed one-page PDF version of this same content exists for sharing outside the repo (meetings, prompts to other AI sessions) — ask in the team channel if you need it; this file is the canonical source.

---

## 1. Dates

**Default, everywhere a human reads a date: `dd-Mmm-yy`** — e.g. `05-Aug-26`. Two-digit day, 3-letter Title Case month, 2-digit year, dash-separated.

| Context | Format | `$computed` call |
|---|---|---|
| Default — list rows, detail views, everything human-facing | `05-Aug-26` | `format_date` — **new format option, doesn't exist yet** (see platform gap below) |
| Activity feed ("how long ago") | `3mo ago` | `relative_time` |
| Machine-facing only | `2026-07-28` | `format_date` with `"format": "iso"` — never for a human-facing label |

**Rule:** pick ONE per widget based on context above — never mix within a single widget for the same conceptual field (found happening in Cliniko's recent-patients tile: `created_at` shown as both "Jul 28, 2026" and "3mo ago" in the same tile).

**Platform gap:** `format_date`'s existing variants (`iso`/`short`/`medium`/`long`) don't produce `dd-Mmm-yy` — needs a new format value added to the system `format_date` helper (`myHubV2/apps/web/src/features/widgets-system/system/functions.ts`) before widgets can actually use this as their default. Flagging as a follow-up engineering task, same as the spacing and color gaps below.

**Retire:** `format_date_au` / `due_date_au` (`DD/MM/YYYY`) — confirmed unused by any shipped widget. Superseded by `dd-Mmm-yy` above, not worth reviving.

## 2. Currency

**Standard format: `A$x,xxx.xx`** — currency-symbol prefix (not a suffix code like `x.xx AUD`), comma thousands separators, always 2 decimal places. E.g. `A$1,234.56`.

- **Always pass `currency` explicitly** — matching the connector's actual region/org currency. Never rely on `format_currency`'s default (silently AUD) — this is currently wrong for NetSuite, Salesforce, HubSpot, and Dataverse widgets that never pass it.
- **2 decimal places is the standard.** Drop to 0 (`fractionDigits: 0`) only as a deliberate, reviewed UX choice (e.g. a round-dollar quick-donate button) — never as an accidental omission. Charitabl's donate widget (0dp) and its own giving-history widget (2dp) currently disagree on the same "donation amount" concept without either being a deliberate call — that's the case to actually fix, not a template to copy.

## 3. Status badges

**Standard: Title Case.** `Fully Invoiced`, `Awaiting Parts`, `Open`, `In Progress` — not `FULLY INVOICED`, not `fully invoiced`, not `Fully invoiced`. Matches WorkQ's own `status_label`/`priority_label` convention exactly ("Not Started", "In Progress", "Urgent").

**Rule:** never pass a raw connector enum straight to a `Badge`/table `variant: "badge"` cell. Every status must go through a label-normalizing `$computed` before display — the tone function alone (`xero_status`, `simpro_job_status_tone`, etc.) only controls color, not casing.

**A fix already exists and isn't used:** `hubspot_ticket_priority_label` (`plugins/hubspot/widget-elements/src/index.ts`) does exactly this — Title-Cases HubSpot's raw `HIGH`/`MEDIUM`/`LOW`. The shipped widget (`hubspot-support-tickets.json`) only calls the *tone* function, never the *label* function, so tickets still render `HIGH` in production. This is the reference pattern every other connector should follow: a `<connector>_<field>_label` helper alongside every `<connector>_<field>_tone` helper.

**Known violators to fix first:** Xero Projects (raw UPPERCASE), HubSpot ticket priority (raw UPPERCASE, fix exists unused), DocuSign (raw lowercase).

## 4. Column headers & field naming

**Title Case for all headers**, no exceptions (fixes: Stripe's `"Due date"` → `"Due Date"`).

**One word per concept, always:**

| Concept | Use | Not |
|---|---|---|
| Org/company a record belongs to | **Customer** | ~~Client~~, ~~Account~~, ~~Company~~ |
| Amount owed / due | **Amount** | ~~Total~~, ~~Amount Due~~ |
| When something is due | **Due Date** | ~~Due~~ |

(Decision confirmed 2026-08-05: "Customer" universally, even for practice-management-flavored connectors like Xero Practice Manager, which currently says "Client.")

## 5. Spacing

**The only valid `gap` values are `xs` / `sm` / `md` / `lg`** (`packages/widget-tokens` in myHubV2). Conventional usage:
- `xs` — tight pairs (icon+value, label directly above its value)
- `sm` — rows within a list (avatar+content rows use this consistently already — keep doing this)
- `md` / `lg` — separating distinct sections of a card

**Known bug, not just inconsistency:** `"gap": "xxs"` is used in **45 widget files across 8+ connectors** (NetSuite, Dataverse, MYOB, Salesforce, HubSpot, Charitabl, Talkdesk) but isn't a real value — it silently renders as **zero gap**, identical to `"none"`. Every widget using `"xxs"` for an icon/value/label stack is unintentionally rendering with no gap at all.

**Action needed (platform, not just this doc):** either add `xxs` as a real half-step value to `GAP_SIZE` in `myHubV2/packages/widget-tokens`, or do a mass find-replace to `xs`/`none` across the 45 files. This is a follow-up engineering task, not fixed by writing this standard alone — until it lands, don't add new `"gap": "xxs"` usages.

## 6. Color / tone

**Status tones (`success` / `warning` / `destructive` / `info` / `muted`) are for real state only.** Before using one, ask: *does this color need to change based on live data?* If no, it's not a status — see "Decorative color" below.

**Reference model: WorkQ's own Priority column** (`todo_priority_tone`) — a small, deliberately limited palette: `destructive` for the most severe/urgent state, `warning` for elevated/needs-attention, `muted` for everything normal/default. Apply the same restraint to connector statuses: map each connector's actual status set into this small vocabulary using judgment rather than inventing a new tone per status — most "normal, nothing wrong here" statuses should just be `muted`, not `accent` (broken — see §Decorative color) and not `info` unless the state is genuinely informational.

**"Success" always means done/paid/completed — never "still open/active"** (confirmed 2026-08-05 — deliberately diverges from WorkQ's own todo `done`=`muted`, since a paid invoice reading as gray rather than green would be worse here). Matches Xero, Simpro, and Cliniko's existing independent convention. GitHub's own widget-elements file currently disagrees with itself (`issue_state_tone`: open=success; `gantt_status_tone`: done=success, three functions apart in the same file) — GitHub's open-issue mapping is the one to fix, not the other four.

**"Overdue" escalation — exactly matches WorkQ's real `is_overdue` logic** (confirmed 2026-08-05): `muted` while not yet due → `warning` on the due date itself, that day only → `destructive` from the day after, no further grace period. Don't wait 30 days (Xero's current behavior) or 60 (QuickBooks') — a 45-day-late invoice currently reads as "fine" in one connector and "urgent" in another.

### Matching a connector's own source UI — decision required, not a silent default (confirmed 2026-08-06)

This standard's tone rules will sometimes disagree with the exact colors a connector's own product shows for the same concept (e.g. HubSpot's ticket-priority UI uses a green dot for `LOW`, which this doc's tone model does not — `muted` is correct here, since `success` is reserved for done/paid/completed, not "not urgent"). Resolving this case-by-case, session-by-session — as happened building the HubSpot Support Tickets tile — is exactly the kind of ad hoc judgment call that produced the inconsistency this doc exists to fix in the first place, just from the opposite direction.

**The rule:** default to this doc's platform tone/status standard. A deliberate deviation to match the integrated platform's own visual convention is allowed, but only as an explicit, answered decision at authoring time — not a silent default either way, and not decided unilaterally by whichever session happens to be building the tile that day. Every tile-authoring workflow (composing a new widget, or reworking an existing one's status/tone handling) must surface this as an explicit question — "match the platform standard, or deliberately match `<connector>`'s own UI, and why?" — and record the answer (e.g. in the widget's own doc comment or PR description), the same way the currency/casing/spacing rules above are checked. Silence defaults to the platform standard.

### Decorative (non-status) color — new rule

**Never repurpose a status tone for a color that doesn't represent a state.** This was the exact root cause of the HubSpot Membership-by-State bug: a plain percentage bar (no inherent good/bad meaning) was set to `tone: "accent"`, and `accent` is deliberately a near-invisible gray reserved for menu-hover highlights in myHub's real theme — not a display color at all. The fix that shipped (`"info"`) is visually correct but still technically borrows a status meaning ("informational") for something that isn't conveying status.

**Standard decorative color: mint `#34DFBA`** (confirmed 2026-08-06) — matches mySMB.com's own public-site button color. Note this is a deliberate choice *against* the in-app product's current `--brand` token, which is blurple (`#635bff`) post the July "blurple restyle." Mint currently survives in the app's own tokens only as `--sidebar-primary` ("sidebar active rail") — a narrow, legacy-labeled use, not a general variable. This is a live, unresolved brand-consistency gap between the public marketing site and the in-app product, bigger than this doc — flagging it, not resolving it here.

Mint was specifically confirmed in the same meeting for the HubSpot Membership-by-State progress bar: that bar is purely decorative (a plain percentage fill with no dynamic good/bad meaning), unlike other tiles' progress bars which use tone to represent live state — using the same status-driven coloring for both would misleadingly imply Membership-by-State's bar means something it doesn't.

**Not yet implemented — tracked follow-up, not done by shipping this doc:** Membership-by-State's bar currently ships on `tone: "info"` (the interim fix for the original harness-palette bug, described above). That is a real, working color, but it's still a borrowed status tone standing in for the decorative one — it should migrate to mint once the platform gap below is resolved. Don't read "the bar renders correctly" as "this is done."

**Platform gap, flagged not fixed here:** `ProgressBar`/`Badge`'s `Tone` type (`myHubV2/packages/widget-tokens`) has no non-status/decorative option at all. Implementing this standard needs a new Tone value (e.g. `brand` or `chart`) bound to `#34DFBA` specifically — it can't simply alias the existing `--brand` variable, since that now resolves to blurple, not mint. Recommended follow-up: add this new tone to `Tone`/`TONE_BG_SOLID`, sourced from a dedicated variable (not `--brand`), so future decorative-color needs (including migrating HubSpot's bar off its current `"info"` workaround) have a correctly-colored, correctly-named home.

`--chart-1` through `--chart-5` (`#635bff` / `#0d9488` / `#f59e0b` / `#d6409f` / `#0ea5e9`) remain the right choice specifically for genuine multi-series charts (multiple simultaneous data series, not a single decorative bar) — a separate case from the single-bar mint default above.

## 7. Rollout & enforcement (confirmed 2026-08-06)

This doc states the standard; it doesn't by itself make ~197 existing widgets comply, and writing it down doesn't stop the next widget from making the same mistakes (the `xxs` bug above was re-introduced in brand-new code within the same session that documented it — the doc alone didn't prevent it).

**Sequencing — apply in this order, not all at once:**

1. **Ship the platform gaps first.** The `dd-Mmm-yy` `format_date` variant, a real `xxs`/half-step `GAP_SIZE` value (or the 45-file mass-fix), and a decorative `Tone` value bound to `#34DFBA` are all real engineering work in myHubV2/`packages/widget-tokens`, not fixed by this document existing. Until they land, widgets attempting to comply will keep hand-rolling per-plugin workarounds (e.g. a plugin-local date-formatting helper duplicating what the system `format_date` should do) — file these three as tracked tickets (GitHub Projects board #2, per myHubV2's own workflow), not left as prose here.
2. **Going forward, from now on: every new tile, and every existing tile touched for any reason** (a bug fix, a feature add, anything) **must comply with this standard as part of that touch.** Standard boy-scout-rule — no separate dedicated pass required to bring a tile you're already editing into line.
3. **A full retrofit of untouched legacy tiles is a separate, deliberately scoped initiative** (e.g. prioritized by tile popularity/usage), tracked on its own — not required before this standard "counts," and not left permanently undone either. Rationale: ~197 widgets is a large surface for a small team to rewrite in one pass, it's cosmetic/consistency debt rather than a functional bug, and most of it is blocked on step 1 regardless of scope decisions. "Future tiles only, forever" would quietly guarantee the inconsistency never resolves for anything not touched again, which defeats the point of having a standard — so this needs to stay a real, planned initiative, just not an urgent-blocking one.

**Enforcement — make compliance structural, not memory-dependent:**

- Add the mechanically-checkable rules to `scripts/validate.ts` (already run on every plugin PR) — at minimum, fail on `"gap": "xxs"` immediately; add currency-explicit and date-format-call checks as they become checkable.
- Wire the same rules into `workspace-plugin-builder:plugin-reviewer`'s checklist, so a pre-PR review actively flags violations rather than relying on the author having read this file.
- Until enforcement lands, treat this doc as required reading before touching dates/currency/status/headers/spacing/color in any tile — but don't mistake "documented" for "enforced."

---

## Why this exists

A full-repo audit (2026-08-05) found **zero enforced standard** for any of the above prior to this document — only fragments (a one-line "Sentence case for labels" rule in myHubV2's `docs/design/WIDGET-STYLE-GUIDE.md`, routinely unfollowed for status badges specifically; dead code like `format_date_au` and `hubspot_ticket_priority_label` that would have already fixed two of these issues had it been used). This document is the first time these are stated as an explicit, intentional standard rather than left to each widget author's individual judgment call.

If you're authoring a new widget or fixing an existing one and it touches dates, currency, status badges, headers, spacing, or color, check it against this doc before shipping.
