# Xero Reporting Studio — report kit (source, tests, generator)

This folder is the source of the **kit reports** in `plugins/xero-reporting-studio/skills/` and their **report templates** in `plugins/xero-reporting-studio/reports/<skill name>/` (`report.json` + `report.html`). Each kit skill carries a `dataBindings` manifest and its complete report document: the skeleton, the stylesheet (`xk.css`), the kit (`xk-kit.js`) cut down to what that report uses, and the report config. The template is the same document and manifest.

- **With myHubV2's `artifact_from_template` tool**, the agent creates the report from the template: the platform saves an exact copy and the agent sets only the starting inputs (period, organisation …), the title and the description. Nothing is retyped. The templates also appear in Reports → Templates ("Use this report").
- **Without it**, the agent copies the skill's blocks verbatim, changing only the dates.

Either way it never writes report code. The foundation skill carries the build steps and rules, not code.

> **Never Pull this extension into the Developer Instance, and never save it there.** The Developer Instance does not keep `reports/`: its next save to dev deletes the 17 templates and the `reports` key. Change it only here, then publish from dev in Admin Center.

**Never hand-edit the report document or `dataBindings` blocks in the skill `.md` files.** Change the files here, run the tests, then regenerate.

## Setup

```bash
cd scripts/xero-reporting-kit
npm install
```

## Change → test → generate → round trip

```bash
npm test             # ledger consistency + every report (jsdom + a host-like mock SDK)
npm run gen          # reports/{ar,ap,so,pu} from the templates, then every kit skill + the foundation
npm run roundtrip    # extract from the generated skills, rerun all tests on that copy, build, platform validators, size limits
cd ../.. && npx tsx scripts/validate.ts
```

Open the PR only when `npm run roundtrip` and `validate.ts` both pass.

## What is where

| File | What it is |
|---|---|
| `xk-kit.js` / `xk.css` / `skeleton.html` | The kit, stylesheet and page skeleton (one copy each). |
| `kit-prune.js` / `build.js` | `build.js` assembles one report's document. `kit-prune.js` cuts the kit down to the `XK.*` members that report's config calls (plus what they use), minified with names kept and lines of about 300 characters. |
| `reports/<id>.cfg.js` + `<id>.manifest.json` | One kit report: its config and its `dataBindings`. `aged.tpl.js` and `pipeline.tpl.js` are templates: `mk-aged.js` writes `ar` / `ap` and `mk-pipeline.js` writes `so` / `pu`. Edit the templates, not those four. |
| `families.js` | One entry per kit skill (skill file, title, trigger, discovery, dates, members, checks, golden set, file name). |
| `gen-xero.js` | Writes the foundation and every kit skill (each with its document from `build.js`). It fails if a skill or a document is over the limits below. The foundation's "Rules for report skills without a kit config" come from `foundation-written-spec.md`. That section is the guidance for the written-spec skills, so edit it there. |
| `harness.js` | Runs a built report in jsdom against a mock `MyHubReport` that behaves like the host: params come from the manifest, defaults are filled, unknown inputs are rejected, plus `getData`, snapshot mode and a fixed clock (25 Sep 2026). |
| `ledger.js` | A small double-entry set of books. **Every Xero response is derived from it:** P&L (accrual and cash, `periods`/`timeframe`), Balance Sheet, Bank Summary, Trial Balance, and lists with statuses, `where` and 100-row paging. Cross-report ties therefore hold by construction, and a tampered value must fail. |
| `fixtures.js` | The original P&L / Balance Sheet fixtures used by `test-xero.js`. |
| `test-ledger.js` · `test-xero.js` · `test-dash.js` | The tests. Run `node test-dash.js <group>` to run one group (`aged`, `pipe`, `bo`, `pf`, `cp`, `hs`, `vz`, `cs`, `cf`, `gst`, `rc`, `tb`, `me`). |
| `check-reports.mts` + `platform/` | The platform's own validators. `report-bindings.ts` is a verbatim copy of myHubV2 `packages/shared/src/artifacts/report-bindings.ts`. |
| `roundtrip.js` | The pre-PR check described above. It extracts each document from its skill and runs the tests on that exact text. |
| `demo.js` | `node demo.js <id> [light|dark] [xero|mysmb]` writes `out/<id>…demo.html`, which runs offline on the ledger. Open it in a browser to look at a report. |

## What every report's tests cover

1. **Happy path:** figures equal the ledger, and every check passes with a green banner.
2. **Tampering:** each source is tampered in turn and the right check must fail. Confirm a new test fails without the fix, so it isn't vacuous.
3. **Failures:** a failed binding turns the banner red and never shows $0 with a tick. HTTP 429 is retried one call at a time. Lists over 100 rows load page 2, and the 20-page cap is reported.
4. **Controls:** every control, snapshot mode, branding (Xero default, mySMB under Customise), dark theme and the Excel download.

## Platform facts the kit relies on

- **Inputs:** at most 8 per report, of type string, date, enum or number (no boolean). Boolean tool params such as `paymentsOnly` are static, so a switchable cash/accrual basis needs two bindings.
- **Bindings:** at most 12. The host hydrates all of them at once and Xero allows 5 calls in progress per organisation, so the kit retries 429s sequentially.
- **Opening a report:** the host hydrates with the **manifest** defaults. A newer platform also sends the input values the bundle ran at (`bundle.inputs`), and the kit takes them first — so a template copy whose manifest defaults the agent set (and a snapshot captured at the reader's inputs) shows the right period and organisation. The kit then compares the dates in Xero's report title with its controls and refetches if they differ.
- **Skill limits:** markdown up to 128 × 1024 characters and a description of at most 500 characters (myHubV2 developer skills). The generator enforces both.
- **What the agent can produce in one turn.** An agent chat turn is aborted after **10 minutes** (and 15 steps), and an aborted turn shows **no reply at all** (myHubV2 `apps/web/src/lib/chat/service.ts`, `TURN_BUDGET_MS`). The agent writes the whole document in a single `artifact_save` call, so the document size decides how long that takes. Keep it small:
  - **No line over 1,500 characters** in any skill. A long skill result can reach the model as a file, and reading it back cuts lines over 2,000 characters. In #1015 the whole kit sat on one 65,000-character line in a 115 KB foundation, and Month-End got no reply in QA.
  - **Report document + dataBindings ≤ 35,000 tokens** (counted with `@anthropic-ai/tokenizer`). QuickBooks Forecasts, which works in QA, counts about 35,300 on the same tokenizer. That's why each report carries only the kit parts it uses — and why new features should stay lean.
  - Both limits are enforced by `gen-xero.js` and `roundtrip.js`.
- **The save check** is a plain text match on `MyHubReport.onData`. The kit calls it in full.
- **Bindings from other connectors** (e.g. `xero-payroll-au`, `xero-assets`) work like any other binding. Declare them in `cfg.sources` (`{ bindingId: { name: 'Xero Payroll AU', optional: true } }`):
  - a missing connection then names that connector;
  - only the main Xero connection raises the top "Connect Xero" banner;
  - an optional source that fails is an N/A line, not a red banner.

  Both connectors accept `xero_tenant_id`. Bind the organisation input to them too, or a report could mix two organisations' data.
- **Every document checks itself.** The agent retypes the document when it saves it, and in QA it once turned `isFinite` into `isfinite`. The skeleton's last script hashes the kit and the config from `render:` on (whitespace ignored; the agent edits only the defaults above it) and compares the result with the sum `build.js` embeds. A damaged copy shows a red "This copy of the report is damaged" line at once, and the kit adds a failed check. `test-conformance.js` checks a good copy passes and a one-character change is caught on every report.
- **A report config owns its body.** Statements use `XK.statement`; dashboards and task lists (e.g. `me.cfg.js`) build their own layout from the kit pieces. Findings such as month-end tasks are content, not checks; the banner is for data-integrity ties.

## Kit reference (for writing a report config)

`XK.app(cfg)` keys: `title`, `primary` (binding whose title a snapshot reads), `dated` (bindings whose Xero report title must name the selected dates — checked on open and after each refetch), `org` (the `get_organisation` binding id), `conns` (the `list_connections` binding id), `fyMonth` (override the organisation's financial-year start), `retryMs`, `inputs` (role → declared input: start, end, asAt, basis, cmpStart, cmpEnd, cmpAsAt, org, persona, display), `defaults`, `uses` (binding id → the declared inputs it consumes; drives refetching), `tools`, `compare`, `enums`, `views`, `options` ([{id, label, options:[[v, l]], def}] → display `o`), `presets` / `asats` (preset lists), `paged` ({binding: {input: 'page', key: 'Invoices'}}), `fan` ({binding: (inputs, ctx) → [{key, inputs}]} — extra calls after open), `noBasis`, `derive(inputs, fyMonth)` (applied on open and on every change), `roll`, `render(ctx)` → `{checks:[{name, pass:true|false|null, info?, detail}], na, notes, title, period}`, `excel(ctx)`. In `render`, `ctx` also gives `rows(id)` (every page of a list), `truncated(id)`, `fan(id)`, `opt(key)` / `setOpt(key, value)`, `change(inputs, display)`, `today`.

Helpers: `XK.walk(report)` → `{lines:[{kind:'header'|'row'|'total', depth, label, id, group, parent, calc, closes, values}], sections, columns, titles}`; `sectionTotal` / `sectionBy(walked, /title/)`; `linesTies` (SummaryRow = Σ rows) / `parentTies` (Total Assets = Σ sections) / `runningTies` (Gross / Net Profit = running Σ); `currentYearEarnings(lines)`; `orgOf` / `connections` / `companyOf` / `fiscalStart`; `find` / `val`; `money` / `pct` / `periodLine` / `rangeLabel` / `asOfLine` / `footerStamp`; `statement` / `grid` / `kpis` / `bars` / `line` / `donut` / `waterfall`; `preset` / `asAt` / `compare` / `fyStartOf`; `xlsx` / `sheetFromLines`. Lists: `doc` / `openDocs(sets, base, asAt)` (credits negative) / `ageingCols(asAt, by, n, len)` / `byContact` / `pipeline(invoices, asAt)` (draft, approval, awaiting, overdue). Parts: `plParts(walked, col)` (income, expenses, trading, cos, opex, gp, np) / `bsParts(walked, col)` (bank, currentAssets, currentLiabilities, ar, ap, gst, totals, cye). Months: `monthCols(walked)` / `monthsEnding(end, n)` / `monthKey` / `monthLabel`; `dateWhere(field, from, to)` (Xero `where` for a date window).

A document carries only the members its config calls (`kit-prune.js` finds them by the text `XK.<name>`), so call kit members as `XK.<name>`, never through an alias.
