# myHub Tile Display Standards

One canonical reference for how every tile formats dates, money, status, headers, spacing, and color — so tiles look like one product, not twenty connectors bolted together.

Grounded in a full audit of ~197 shipped widgets across 40+ plugins (2026-08-05). Before this document, no such standard existed anywhere in this repo or myHubV2 — see "Why this exists" at the bottom.

A condensed one-page PDF version of this same content exists for sharing outside the repo (meetings, prompts to other AI sessions) — ask in the team channel if you need it; this file is the canonical source.

---

## 1. Dates

**Default, everywhere a human reads a date: `dd-Mmm-yy`** — e.g. `05-Aug-26`. Two-digit day, 3-letter Title Case month, 2-digit year, dash-separated.

| Context | Format | `$computed` call |
|---|---|---|
| Default — list rows, detail views, everything human-facing | `05-Aug-26` | `{ "$computed": "format_date", "args": { "value": …, "format": "dd-mmm-yy" } }` (or `cellFormatters.dd_mmm_yy` in a `Table` column) |
| Activity feed ("how long ago") | `3mo ago` | `relative_time` |
| Machine-facing only | `2026-07-28` | `format_date` with `"format": "iso"` — never for a human-facing label |

**Rule:** pick ONE per widget based on context above — never mix within a single widget for the same conceptual field (found happening in Cliniko's recent-patients tile: `created_at` shown as both "Jul 28, 2026" and "3mo ago" in the same tile).

**Implemented (2026-08-10, pending merge of myHubV2 PR #1245):** an earlier draft of this doc listed `dd-Mmm-yy` as a platform gap — `format_date`'s existing variants (`iso`/`short`/`medium`/`long`) didn't produce it. That option now exists (`myHubV2/apps/web/src/features/widgets-system/system/functions.ts`), plus a matching `cellFormatters.dd_mmm_yy` for `Table` columns. Until #1245 merges to `dev`, this exists on that branch only.

**Retire:** `format_date_au` / `due_date_au` (`DD/MM/YYYY`) — confirmed unused by any shipped widget. Superseded by `dd-Mmm-yy` above, not worth reviving.

## 2. Currency

**Standard format: `A$x,xxx.xx`** — currency-symbol prefix (not a suffix code like `x.xx AUD`), comma thousands separators, always 2 decimal places. E.g. `A$1,234.56`.

- **Always pass `currency` explicitly** — matching the connector's actual region/org currency. Never rely on `format_currency`'s default (silently AUD) — this is currently wrong for NetSuite, Salesforce, HubSpot, and Dataverse widgets that never pass it.
- **2 decimal places is the standard.** Drop to 0 (`fractionDigits: 0`) only as a deliberate, reviewed UX choice (e.g. a round-dollar quick-donate button) — never as an accidental omission. Charitabl's donate widget (0dp) and its own giving-history widget (2dp) currently disagree on the same "donation amount" concept without either being a deliberate call — that's the case to actually fix, not a template to copy.

## 3. Status badges

**Standard: Title Case.** `Fully Invoiced`, `Awaiting Parts`, `Open`, `In Progress` — not `FULLY INVOICED`, not `fully invoiced`, not `Fully invoiced`. Matches WorkQ's own `status_label`/`priority_label` convention exactly ("Not Started", "In Progress", "Urgent").

**Rule:** never pass a raw connector enum straight to a `Badge`/table `variant: "badge"` cell. Every status must go through a label-normalizing `$computed` before display — the tone function alone (`xero_status`, `simpro_job_status_tone`, etc.) only controls color, not casing.

**Reference pattern:** a `<connector>_<field>_label` helper alongside every `<connector>_<field>_tone` helper. `hubspot_ticket_priority_label` (`plugins/hubspot/widget-elements/src/index.ts`) is the example this doc originally flagged as "exists but unused" — as of the Support Tickets tile rebuild, `hubspot-support-tickets.json` now calls both the label and tone functions, so this one's fixed, not just available.

**Also found and fixed (2026-08-10, pending merge of myHubV2 PR #1245):** the shared `Badge` component's `soft` variant combined with `muted` tone rendered essentially invisibly in both light and dark theme — a platform bug, not a tile mistake, discovered via this exact HubSpot ticket-priority case (a `muted` "Low" pill that should read clearly, matching WorkQ's own priority-pill contrast, but didn't). Root-caused and fixed in `myHubV2/apps/web/src/features/widgets-system/system/components.tsx` directly — no tile-level workaround needed, and every other tone/variant combination was left untouched.

**Known violators as of 2026-08-07 — re-verify before treating as current, this list is a snapshot, not a standard:** Xero Projects (raw UPPERCASE), DocuSign (raw lowercase). HubSpot ticket priority was on this list originally; fixed in the Support Tickets tile rebuild, see above.

## 4. Column headers & field naming

**Title Case for all headers**, no exceptions (fixes: Stripe's `"Due date"` → `"Due Date"`).

**One word per concept, always:**

| Concept | Use | Not |
|---|---|---|
| Org/company a record belongs to | **Customer** | ~~Client~~, ~~Account~~, ~~Company~~ |
| Amount owed / due | **Amount** | ~~Total~~, ~~Amount Due~~ |
| When something is due | **Due Date** | ~~Due~~ |

(Decision confirmed 2026-08-05: "Customer" universally, even for practice-management-flavored connectors like Xero Practice Manager, which currently says "Client.")

**Platform bug, found and fixed (2026-08-10, pending merge of myHubV2 PR #1245):** the system `Table` component hardcoded `uppercase` on every column header via CSS, regardless of how the widget author cased `column.header` — the one place in the widget system that silently violated this section's own rule no matter what a tile author wrote. Removed; headers now render exactly as authored. Checked against every existing widget using `Table` before removing it — none relied on the forced transform.

## 5. Spacing

**The only valid `gap` values are `xs` / `sm` / `md` / `lg`** (`packages/widget-tokens` in myHubV2). Conventional usage:
- `xs` — tight pairs (icon+value, label directly above its value)
- `sm` — rows within a list (avatar+content rows use this consistently already — keep doing this)
- `md` / `lg` — separating distinct sections of a card

**Known bug, not just inconsistency:** `"gap": "xxs"` is used in **45 widget files across 8+ connectors** (NetSuite, Dataverse, MYOB, Salesforce, HubSpot, Charitabl, Talkdesk) but isn't a real value — it silently renders as **zero gap**, identical to `"none"`. Every widget using `"xxs"` for an icon/value/label stack is unintentionally rendering with no gap at all.

**Action needed (platform, not just this doc):** either add `xxs` as a real half-step value to `GAP_SIZE` in `myHubV2/packages/widget-tokens`, or do a mass find-replace to `xs`/`none` across the 45 files. This is a follow-up engineering task, not fixed by writing this standard alone — until it lands, don't add new `"gap": "xxs"` usages.

## 6. Building tabular tiles (confirmed 2026-08-07)

**For any multi-column, row-based tile (a deal list, a ticket list, anything that reads as a table), use the system `Table` component — never hand-roll it from `Row` (with a `template`) + `repeat` — unless the tile needs interactive column sorting, which `Table` doesn't support yet; see "Interactive column sorting" below for that case's own standard.**

**Why this is a real bug, not just style:** a hand-rolled table's header row and each data row are *separate* CSS Grid containers. If any column width is `auto` (or otherwise content-dependent), each row computes its own column widths independently — so the header's short labels ("Stage", "Amount") and the data rows' wider content (a stage pill, a dollar amount) can end up with genuinely different column widths, even though every individual row looks fine on its own. The header and the data silently stop lining up. `Table` doesn't have this failure mode: header and rows are one component sharing one width state, so alignment is guaranteed by construction, and columns are user-resizable for free.

**Found in:** HubSpot's Deals Pipeline tile, hand-rolled with `Row`+`template`+`repeat`. Not a one-off mistake — **30 widget files across the marketplace hand-roll tables this way, versus 26 using the real `Table` component** — roughly an even split. Root cause: `myHubV2`'s `composing-widgets` skill already has this exact rule for a different case ("Never hand-roll these rows from `Row` + `Text`... use `ActivityItem`/`ListItem` instead") but has no equivalent explicit rule pointing tabular data at `Table` — it mentions Table exists, but never says "always use this instead of hand-rolling grid rows." That's a real documentation gap, not carelessness by whoever built the affected widgets.

**Recurred independently, confirming this is systemic, not a one-off (2026-08-12):** Salesforce's own Deals Pipeline tile hit the identical bug — the exact same fractional-width template (`2fr 1.2fr 1fr 0.9fr`) HubSpot's originally shipped with, built by a different session with no visibility into HubSpot's fix. Resolved the same way: fixed pixel widths (`minmax(0, 1fr) 150px 85px 85px`) plus a `justify:"center"` wrapper `Row` around the Stage `Badge`. If a hand-rolled table's columns won't line up, this is almost certainly the cause and the fix — check here before re-deriving it from scratch.

**A real limitation to know about, not a reason to avoid `Table`:** its built-in cell formatters (`format`/`toneFormat`) only see one column's own value — they can't reference another field on the same row. A per-row value that depends on a *different* field (e.g. formatting `amount` using that row's own `deal_currency_code`) still needs custom handling — pre-compute a display-ready string before handing rows to `Table`, the same way you would outside it.

**Not yet applied retroactively:** Deals Pipeline itself was left as-is (already built, tested, and working — reworking it into `Table` right after fixing its alignment bug risked unnecessary regression for no functional gain). New tabular tiles should use `Table` from the start; migrating existing hand-rolled ones is the same opportunistic "touch it, fix it" policy as §14's rollout plan, not a mandatory rewrite.

**One migration done as a concrete example (2026-08-07):** HubSpot's Recent Contacts tile was rebuilt directly onto `Table` (previously hand-rolled `Row`+`repeat`) as part of the same round of fixes — the "touch it, fix it" policy actually applied, not just Deals Pipeline's "left as-is" counterexample.

**Folded in (2026-08-07):** this rule now also lives in `myHubV2/.claude/skills/composing-widgets/SKILL.md`'s "Common gotchas" section (the actual authoritative "which component to use" doc — this section here remains the record of the finding) and in the plugin-scaffold template's copy of the same skill (`mysmb-marketplace/scripts/create-plugin/template/.claude/skills/composing-widgets/SKILL.md`), so new plugins inherit the rule from creation.

### Interactive column sorting (confirmed 2026-08-10 — from a Stripe tiles demo, with a follow-up that it belongs in this doc)

**When a tile needs interactive column sorting, hand-roll it instead of using `Table` — with fixed pixel column widths mandatory, not optional.** `Table`'s `TableColumn.header` is a plain string with no slot for a button or any custom content per column, and it has no `sortable`/`onSort`/header-click mechanism at all — there is currently no way to add a sort affordance to a `Table` column. Rather than block sortable tiles on unbuilt, unvalidated platform work (extending `Table` itself was considered and explicitly rejected for now — zero tiles have proven what that would look or behave like), this doc accepts hand-rolling as the standard path for this specific need, the same way `Table` is the standard for the non-sorting case above. The fixed-pixel-width rule from the alignment-bug fix above still applies here — it's what prevents the exact failure mode that motivated adopting `Table` in the first place, so a hand-rolled sortable table without it is still non-compliant, not a valid exception.

**Standardize the affordance, not full per-column coverage.** A tile author picks which columns are meaningfully sortable — Stripe's own reference implementation (the one that prompted this section) doesn't sort every column either.

**Standard interaction:** a small icon button sits immediately beside the sortable column's header label — matching the demoed Stripe placement, generalized to any column an author marks sortable (not restricted to one fixed column the way the current Salesforce/Stripe widgets do it). Unsorted sortable columns show a neutral `ArrowUpDown` icon; the active sort column shows a direction-specific `ArrowUp` (ascending) or `ArrowDown` (descending) icon instead. Clicking toggles between ascending and descending for that column — two states, not three; none of the existing shipped implementations return to an "unsorted" state once clicked, and no case has needed that yet.

**Known inconsistency this replaces:** three independently-built patterns existed, matching none of each other. Shopify's Product Catalog: a row of buttons *above* the table, one per sortable column, resets to ascending on column switch. Salesforce (2 widgets) and Stripe (4 widgets): a single icon button beside one fixed column's header, cycling only that column — the same shape reinvented twice, independently, in two different connectors' widget-elements. MYOB built a fourth design (an arrow character appended into the header text) that was never actually wired into any shipped widget. None of these need retroactive migration to match the standard above — same opportunistic "touch it, fix it" policy as the rest of this doc — but new sortable tiles should follow the standard interaction, not add a fifth pattern.

**Still needs doing:** fold this into `myHubV2/.claude/skills/composing-widgets/SKILL.md`'s "Common gotchas" section alongside the Table-vs-hand-rolled rule above, so new plugins inherit both halves of this decision together — held off for now, same reasoning as this doc's other "still needs folding in" notes.

### A second, distinct alignment bug: header padding, not column width (found 2026-08-13)

**A hand-rolled table's header row needs the same padding as its data rows, even when neither `hover` nor `selected` — the styling props that happen to carry that padding as a side effect — otherwise applies to the header.** `Row`'s `hover`/`selected` props apply `px-2 py-1.5` padding together with their highlight/selection background, as one bundled side effect, not two independent things. A header row that (correctly) skips `hover` therefore also loses that padding, shifting where its grid's content box starts relative to a sibling data row that has `hover: true` — every fixed-width column past the first ends up offset by a constant amount, **regardless of tile width**, since only the flexible (`1fr`) column absorbs resizing. This is a different failure mode from the column-width bug above (that one comes from `auto`/content-dependent widths computing independently per row; this one exists even with identical, fixed pixel widths on both rows) — a tile can be fully compliant with the fixed-pixel-width rule above and still misalign this way.

**Found in:** HubSpot's and Salesforce's Deals Pipeline tiles (the same two tiles §"Building tabular tiles" already tracked for the column-width bug), plus — once audited for the same pattern — 4 Stripe widgets (`stripe-invoices`, `stripe-recent-payments`, `stripe-subscription-overview`, `stripe-customers`) and Talkdesk's QA scorecard (which used the unrelated `Grid` component for its header, itself incapable of carrying `hover`/`selected`/padding at all — converted to `Row` so it could take the fix below). 7 widgets total; Cliniko's and Dataverse's hand-rolled tables were audited and found *not* affected — they don't have a separate header row sharing a template with their data rows in the first place, so there's nothing for this bug to misalign.

**Fix: a new `padded` prop on `Row`** — same `px-2 py-1.5` spacing as `hover`/`selected`, no background. Purely additive; every existing `hover`/`selected` usage is untouched. Give a header row `padded: true` (no `hover`) to match a sibling data row's `hover: true` spacing without adopting its highlight behavior.

**Status: fixed, not yet merged.** `myHubV2` PR #1313 adds the `padded` prop; `mysmb-marketplace` PR #581 applies it to all 7 widgets above. Both open, pending review — verified in the tile harness against the real component (not a build artifact), light and dark mode, before opening either.

## 7. Color / tone

**Status tones (`success` / `warning` / `destructive` / `info` / `muted`) are for real state only.** Before using one, ask: *does this color need to change based on live data?* If no, it's not a status — see "Decorative color" below.

**Reference model: WorkQ's own Priority column** (`todo_priority_tone`) — a small, deliberately limited palette: `destructive` for the most severe/urgent state, `warning` for elevated/needs-attention, `muted` for everything normal/default. Apply the same restraint to connector statuses: map each connector's actual status set into this small vocabulary using judgment rather than inventing a new tone per status — most "normal, nothing wrong here" statuses should just be `muted`, not `accent` (broken — see §Decorative color) and not `info` unless the state is genuinely informational.

**`muted` means "nothing to report," not "early."** Don't apply it to the first/earliest value of a *progression* field (a pipeline stage, a fulfillment step, anything that moves a record through discrete, ordered steps toward a terminal state) just because it's the lowest-severity value — a record that has just entered a tracked process is actively progressing, not sitting in a no-news-is-good-news default the way an untouched `LOW`-priority ticket is. Use `info` for every open/in-progress stage of a progression field instead, escalating to `warning`/`destructive`/`success` only at the stages that actually warrant them (nearing a deadline, blocked, or genuinely terminal). Reserve `muted` on a progression field for a real "no stage set" / "not applicable" case, if one exists.

Found 2026-08-10: HubSpot's Deals Pipeline had `appointmentscheduled` (a pipeline's first stage) on `muted`, copied from `ticket_priority_tone`'s `LOW`-is-`muted` pattern without noticing the two fields aren't the same shape — ticket priority is a severity field (most tickets sit at normal severity forever, correctly `muted`), deal stage is a progression field (every open deal is, by definition, doing something). Moved to `info`, matching the other open stages (`qualifiedtobuy`, `presentationscheduled`, `decisionmakerboughtin`) — the whole open pipeline now reads as one continuous band, breaking only at `contractsent` (`warning`). Four stages sharing one tone is intended, not a gap to fill with more tones: the badge's own text label carries stage identity, tone only carries urgency-tier (see the restraint principle above) — don't invent a tone per stage to make them "look different from each other."

**"Success" always means done/paid/completed — never "still open/active"** (confirmed 2026-08-05 — deliberately diverges from WorkQ's own todo `done`=`muted`, since a paid invoice reading as gray rather than green would be worse here). Matches Xero, Simpro, and Cliniko's existing independent convention. GitHub's own widget-elements file currently disagrees with itself (`issue_state_tone`: open=success; `gantt_status_tone`: done=success, three functions apart in the same file) — GitHub's open-issue mapping is the one to fix, not the other four.

**"Overdue" escalation — exactly matches WorkQ's real `is_overdue` logic** (confirmed 2026-08-05): `muted` while not yet due → `warning` on the due date itself, that day only → `destructive` from the day after, no further grace period. Don't wait 30 days (Xero's current behavior) or 60 (QuickBooks') — a 45-day-late invoice currently reads as "fine" in one connector and "urgent" in another.

### Matching a connector's own source UI — decision required, not a silent default (confirmed 2026-08-06)

This standard's tone rules will sometimes disagree with the exact colors a connector's own product shows for the same concept (e.g. HubSpot's ticket-priority UI uses a green dot for `LOW`, which this doc's tone model does not — `muted` is correct here, since `success` is reserved for done/paid/completed, not "not urgent"). Resolving this case-by-case, session-by-session — as happened building the HubSpot Support Tickets tile — is exactly the kind of ad hoc judgment call that produced the inconsistency this doc exists to fix in the first place, just from the opposite direction.

**The rule:** default to this doc's platform tone/status standard. A deliberate deviation to match the integrated platform's own visual convention is allowed, but only as an explicit, answered decision at authoring time — not a silent default either way, and not decided unilaterally by whichever session happens to be building the tile that day. Every tile-authoring workflow (composing a new widget, or reworking an existing one's status/tone handling) must surface this as an explicit question — "match the platform standard, or deliberately match `<connector>`'s own UI, and why?" — and record the answer (e.g. in the widget's own doc comment or PR description), the same way the currency/casing/spacing rules above are checked. Silence defaults to the platform standard.

### Decorative (non-status) color — implemented (2026-08-07)

**Never repurpose a status tone for a color that doesn't represent a state.** This was the exact root cause of the HubSpot Membership-by-State bug: a plain percentage bar (no inherent good/bad meaning) was set to `tone: "accent"`, and `accent` is deliberately a near-invisible gray reserved for menu-hover highlights in myHub's real theme — not a display color at all.

**Standard decorative color for a single connector accent: mint `#34DFBA`** (confirmed 2026-08-06) — matches mySMB.com's own public-site button color, deliberately *not* the in-app product's `--brand` blurple (`#635bff`, post the July "blurple restyle").

**Correction to an earlier draft of this doc:** an earlier version claimed this needed a new platform `Tone` value that didn't exist yet. That was wrong — myHubV2 already had the exact mechanism: a widget declares a top-level `"brandColor": "#RRGGBB"` (validated in `widget-schema.ts`), the renderer sets it as `--widget-brand` on the tile's wrapper (`renderer.tsx`), and `tone: "brand"` (already a real `Tone` value, resolving to `var(--widget-brand, var(--accent))`) picks it up on any `ProgressBar`/`Badge`/`Icon`/`Dot`. HubSpot's Membership-by-State ships this today — `"brandColor": "#34DFBA"` + `tone: "brand"` on its progress bars, confirmed rendering `#34DFBA` exactly. (The local tile-harness didn't wire `--widget-brand` into its preview wrapper the way the real renderer does, which made this look broken/unverifiable for a while — fixed in the harness itself, `tile-harness/harness/src/App.tsx`, once found; not a widget or platform bug.)

**Categorical (multi-color, non-status) breakdowns are a separate case from the single-brand-accent one above** — e.g. coloring 3+ arbitrary, portal-defined category labels distinctly in a legend/list, where no single accent or status tone applies to any one of them. `--chart-1` through `--chart-5` (`#635bff` / `#0d9488` / `#f59e0b` / `#d6409f` / `#0ea5e9`) are the token set for this. As of 2026-08-07 these are wired into the real `Tone` system (`myHubV2/packages/widget-tokens`'s `Tone` union + `TONE_TEXT`/`TONE_BG_SOFT`/`TONE_BG_SOLID`/`TONE_BORDER`, plus `components.tsx`'s SVG-specific `TONE_VAR`) as `chart-1`..`chart-5`, usable on any tone-aware component the same as `brand` — **pending merge of myHubV2 PR #1245**; until that merges, `chart-1..5` exist in that PR's branch but not yet on myHubV2's `dev`. HubSpot's own widget-elements code has no compile-time dependency on the `Tone` type (tone values are plain strings there, matched structurally at render time, not imported from `@myhub/widget-tokens`), so this repo's build/validate is unaffected either way — it's a rendering concern only, resolved once #1245 merges. `Donut`'s default segment-coloring fallback (`CHART_PALETTE`, used only when a segment has no explicit `legend`/`tone`) was migrated off its previous `['accent','info','success','warning','destructive','muted']` cycle — the same status-tone-borrowing anti-pattern this section warns against, predating this doc — onto `chart-1..5`. HubSpot's Membership-by-Category tile's rank-colored dots (`hubspot_category_rank_tone`) were fixed the same way. Callers that genuinely want status semantics in a `Donut` legend (e.g. a true/false split where "true" means overdue) still opt in explicitly via `legend: { ...: { tone: "warning" } }` — only the no-opinion default changed.

## 8. Connector logo chip

**Every tile gets a small connector-brand logo chip in its top-right corner** — a separate thing from the title-row `Icon` next to the tile's heading (a generic Lucide icon, always `size: "sm"`, already fully consistent across all ~195 shipped widgets — no action needed there). This chip is a real image, resolved by `myHubV2/apps/web/src/features/widgets-system/brand-mark.ts`'s `CONNECTOR_BRANDS` map (keyed by `connectorsUsed` id-prefix) against real assets in `myHubV2/apps/web/public/logos/`, rendered by `renderer.tsx`'s `ConnectorBrandMark` at a fixed `h-7 w-auto` — 28px tall, width scales to the image's native aspect ratio.

**Two accepted shapes** (confirmed 2026-08-12, audited against real shipped assets):
- **Wide wordmark** (the common case) — Simpro (1859×744, aspect 2.50), MYOB (1182×486, aspect 2.43), NetSuite and Talkdesk (an identical 1859×744 canvas to Simpro's, suggesting a shared export template). **New uploads targeting this shape: match Simpro's exact canvas, 1859×744.**
- **Square icon-only mark** — Salesforce (400×400, aspect 1.00, no wordmark text) is the reference. Acceptable when the connector's own brand is fundamentally a monogram/icon rather than a wordmark — don't force a square brand into an artificially wide canvas just to match the wordmark case.

**Scope — forward-only, not retroactive.** This governs HubSpot's upload (currently zero entry in `CONNECTOR_BRANDS` — the actual gap prompting this rule) and any future connector going forward. Existing connectors' already-shipped logos are not to be resized or touched.

**Platform-adjacent fix, same audit (2026-08-12):** the local tile-harness never rendered this chip at all — the same class of fidelity gap as the earlier `--widget-brand` CSS variable issue (§7's Decorative color section). Fixed in `tile-harness` (PR #7, `fix/harness-connector-logos`): aliases `brand-mark.ts` live from MyHub and serves `/logos/*` from MyHub's real asset directory, so both shapes now render correctly there too — verified against Simpro's wordmark and Salesforce's square mark directly.

## 9. Tile subtitle (Eyebrow)

**Every tile places an `Eyebrow` directly below its `Heading`** — this is already universal across every shipped widget, but the convention had never been written down anywhere until now (confirmed absent from this doc when asked directly, 2026-08-13).

**Content is use-case-specific — there's no fixed template.** Unlike headers, dates, or currency, there's no single right answer for what goes in the Eyebrow. A tile author picks whichever fits the tile's own use case: the connector/product context (`Dynamics 365 Sales`), a live record count (`4 open deals`), a time window (`Last 7 days`), an activity descriptor (`Recent calls`), or a combination joined with `·`. Don't force a tile's Eyebrow into a template lifted from a different tile if it doesn't fit what that tile is actually showing.

**Casing: Sentence case, per `·`-separated segment** — capitalize only the first word of the string, and (if the Eyebrow has a `·`-joined second clause) only the first word of that clause too; everything else stays lowercase. A connector/brand/product name keeps its own natural capitalization wherever it appears (e.g. `Stripe`, `Dynamics 365`, `NetSuite ERP`) — that's normal proper-noun capitalization, not an exception to sentence case. Never Title Case throughout, never ALL CAPS.

**Reference pattern, done consistently:** NetSuite's widgets get this right across the board — `NetSuite ERP · Current month`, `NetSuite ERP · Bank accounts`, `NetSuite ERP · Requires attention`, `NetSuite ERP · Rolling 90 days` — connector name capitalized (it's a proper noun), first word after `·` capitalized (start of that clause), everything else lowercase.

**Known violators (found 2026-08-13, sampled from ~70 shipped Eyebrow strings):** plain Title Case throughout — `Bank Accounts`, `Gross Profit`, `Net Income`, `Total Employees`, `Total Expenses`, `Recent Donations`, `Recurring Gifts`, `Top 5 Agents`, `On Leave Today`, `Overdue Buckets`, `Revenue by Customer`, `Industry Benchmark`, `Lowest Registered Attendance`; a leading number that should leave the following word lowercase but doesn't — `3 Campaigns`, `3 Open`, `3 Pending`, `3 Recent` (contrast with the same file's own correct `4 products`); Title-Casing the second `·`-clause instead of just its first word — `Charitabl · Last 30 Days` (should be `Last 30 days`), `Charitabl · Curator`, `Charitabl · Featured`, `Charitabl · Featured Charity`; and one plain ALL CAPS, `SUMMARY`. Snapshot, not exhaustive — re-verify before treating as current.

**Not yet enforced or retroactively fixed** — same rollout policy as everything else in this doc (see §14): new/touched tiles must comply going forward, a full retrofit of the violators above is a separate scoped initiative, not required before this section "counts."

## 11. Row limits & pagination (confirmed 2026-08-14)

**A list/table tile shows a maximum of 20 rows at a time.** When more rows exist than that, a **"See more" button** at the bottom reveals the next 20, appended in place — the tile grows, or gains an internal scroll region — never an auto-load-on-scroll. Infinite scroll is explicitly out (DSM 2026-08-13): every reveal is a deliberate click, not a side effect of scroll position.

**When rows are truncated, show a plain count** (e.g. "Showing 20 of 47") — text only, not a link or a drill-down destination.

**Not yet built:** the widgets-system's `repeat` component currently only supports a flat display `limit` (a hard slice, no reveal-more behavior) — confirmed via `apps/web/src/features/widgets-system/system/components.tsx`. This section documents the target design; implementing "See more" is its own tracked task, same doc-first pattern as everything else in this file. Existing widgets keep using flat `limit` until it lands — this section doesn't retroactively obligate them to grow a "See more" button on their own.

## 12. Foundational tile principles (confirmed 2026-08-14)

Before a tile gets built, it should satisfy all four (DSM 2026-08-13):

- **Useful** — answers a real, recurring question; not built just because the data happens to be available.
- **Provides visibility** — surfaces something the user would otherwise have to dig for across systems/tabs.
- **Solves a problem** — gives the user something they can act on: an informed, empirical decision grounded in real data, not decoration.
- **Genuinely accessible** — reachable and usable by the people who actually need it (permissions, tenant fit), not built for a hypothetical audience.

## 13. Data governance: velocity & veracity (confirmed 2026-08-14)

**Velocity (freshness):** every tile discloses the time context of its data via the Eyebrow (§9) — a time window, "as of" framing, or similar — so a viewer knows how current the number is. No new UI needed; this rides the existing Eyebrow convention rather than inventing a separate freshness badge.

**Veracity (reliability/completeness):** when a tile's data is partial, sampled, delayed, or bound by an upstream platform limit (e.g. a connector only exposing a rolling window of history), the tile discloses that limitation — via Eyebrow, an inline note, or empty/misconfigured-state copy — rather than presenting partial data silently as if it were complete. Raised at DSM re: MYOB reportedly previewing only ~3 months of data — **unconfirmed against MYOB's actual docs as of this writing** (no such limit found in `myhub-mcp-servers/src/integrations/myob`, so this is likely an MYOB platform/API constraint, not something mySMB imposes); the principle generalizes to any connector with a known native retrieval limit, once confirmed.

## 14. Rollout & enforcement (confirmed 2026-08-06)

This doc states the standard; it doesn't by itself make ~197 existing widgets comply, and writing it down doesn't stop the next widget from making the same mistakes (the `xxs` bug above was re-introduced in brand-new code within the same session that documented it — the doc alone didn't prevent it).

**Sequencing — apply in this order, not all at once:**

1. **Ship the platform gaps.** Status as of 2026-08-10: two of the three originally identified here are done — the `dd-Mmm-yy` `format_date` variant + `cellFormatters.dd_mmm_yy`, and decorative color (`brandColor`/`tone:"brand"` for a single connector accent, `chart-1..5` for categorical breakdowns) — both in myHubV2 PR #1245, pending merge. Still genuinely open: a real `xxs`/half-step `GAP_SIZE` value (or the 45-file mass-fix) in `packages/widget-tokens` — file as a tracked ticket (GitHub Projects board #2, per myHubV2's own workflow) if not already, not left as prose here.
2. **Going forward, from now on: every new tile, and every existing tile touched for any reason** (a bug fix, a feature add, anything) **must comply with this standard as part of that touch.** Standard boy-scout-rule — no separate dedicated pass required to bring a tile you're already editing into line.
3. **A full retrofit of untouched legacy tiles is a separate, deliberately scoped initiative** (e.g. prioritized by tile popularity/usage), tracked on its own — not required before this standard "counts," and not left permanently undone either. Rationale: ~197 widgets is a large surface for a small team to rewrite in one pass, it's cosmetic/consistency debt rather than a functional bug, and most of it is blocked on step 1 regardless of scope decisions. "Future tiles only, forever" would quietly guarantee the inconsistency never resolves for anything not touched again, which defeats the point of having a standard — so this needs to stay a real, planned initiative, just not an urgent-blocking one.

**Enforcement — make compliance structural, not memory-dependent:**

- Add the mechanically-checkable rules to `scripts/validate.ts` (already run on every plugin PR) — at minimum, fail on `"gap": "xxs"` immediately; add currency-explicit and date-format-call checks as they become checkable. A hand-rolled sortable table using `auto`/`fr` column widths instead of fixed pixels is checkable the same way.
- Wire the same rules into `workspace-plugin-builder:plugin-reviewer`'s checklist, so a pre-PR review actively flags violations rather than relying on the author having read this file — including the §6 decision test itself: does this tile need sorting? If yes, hand-rolled + fixed widths + the standard button convention; if no, `Table`.
- Until enforcement lands, treat this doc as required reading before touching dates/currency/status/headers/spacing/color in any tile — but don't mistake "documented" for "enforced."

---

## Why this exists

A full-repo audit (2026-08-05) found **zero enforced standard** for any of the above prior to this document — only fragments (a one-line "Sentence case for labels" rule in myHubV2's `docs/design/WIDGET-STYLE-GUIDE.md`, routinely unfollowed for status badges specifically; dead code like `format_date_au` and `hubspot_ticket_priority_label` that would have already fixed two of these issues had it been used). This document is the first time these are stated as an explicit, intentional standard rather than left to each widget author's individual judgment call.

If you're authoring a new widget or fixing an existing one and it touches dates, currency, status badges, headers, spacing, or color, check it against this doc before shipping.
