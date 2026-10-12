# Client Report Analytics: report kit (source, tests, generator)

This folder is the source of `plugins/client-report-analytics`: its report templates (`reports/<slug>/report.json` + `report.html`), its skills and its agent. Change the source here and regenerate; never hand-edit the generated files.

> **Never Pull this extension into the Developer Instance, and never save it there.** The Developer Instance does not keep `reports/`: its next save to dev deletes the templates. Change it only here, then publish from dev in Admin Center.

## Design

- **One template per platform per report.** The host hydrates every binding on open and allows at most 12 bindings, and one platform's report already needs most of them, so each report (Wave 1: CRA-01 / CRA-05 / CRA-07; Wave 2: CRA-03 / CRA-04 / CRA-06 / CRA-11 / CRA-15) ships as `client-xero-…`, `client-myob-…` and `client-quickbooks-…`. Same layout, sections, checks and controls on all three. The exception is CRA-14 (Ledger User Activity): it has no templates at all — it is a skill-only router to the QuickBooks and MYOB Reporting Studios' own export-based audit-log skills, because Xero has no org-wide audit log to report on in the first place.
- **The `workspace` built-in report server.** CRA-15 (Workspace User Activity) is the first report in this kit to bind to `{ mcp: 'workspace', name: 'workq_activity' }` instead of a Xero/MYOB/QuickBooks connector tool — the platform's own non-connector report data source (`REPORT_BUILTIN_SERVERS` in `report-bindings.ts`). Its exact production tool/param contract has no other usage anywhere in this repo to copy from, so the binding here (`from`/`to` date params only) is a first-cut best effort, flagged in code comments as unverified against the live platform. Client matching is done client-side by name against the item, not a platform-side per-client filter.
- **Built on the platform kits, not copies of them.** `engines.js` assembles each document from that platform's own skeleton, stylesheet and engine in `scripts/{xero,myob,quickbooks}-reporting-kit/` (read in place; for Xero, pruned with its `kit-prune.js` and stamped with its self-check sum). The output is byte-identical to what each kit's `build.js` produces for the same config. So a Client Report Analytics report behaves exactly like the platform's library reports: client picker (LIB-002), presets, refetch of only the affected bindings, 429 retry, checks banner, snapshot mode, dark theme, Excel / PDF, `bundle.inputs`. The house style defaults to mySMB (Prompt Library v1.1, Branding tab); the platform styling stays under Customise.
- **The agent never writes report code.** Skills tell it to call `artifact_from_template` (myHubV2 dev and qa; not uat or master on 6 Oct 2026) with `plugin: "client-report-analytics"`, the slug and the inputs the request changes. `gen-ext.js` writes each skill's input table from the real manifests.
- **CRA-00 catalogue** (`catalogue/client-catalogue.js`) is a small standalone document: its only live data is the client list from the viewer's own connections. Boxes start from "Use this report" on a template or ask the agent (decision D5); there is no "latest saved instance" lookup, no sparkline and no client-portal toggle (Workspace has none).
- **CRA-16** routes to the three Reporting Studio extensions' templates (`libraries.json`, written by `mk-libraries.js` from `plugins/*-reporting-studio/reports`). Their client inputs are `org` (Xero) and `company_file` (MYOB); QuickBooks has none (one company per connection).

## Commands

```bash
npm install                 # once, here and in the three platform kits
node test.js [platform]     # every <platform>/*.test.js (catalogue, xero, myob, quickbooks)
node mk-libraries.js        # refresh libraries.json when a studio adds or renames a template
node gen.js                 # templates → plugins/client-report-analytics/reports
node gen-ext.js             # skills, agent (.md + content/agents/<originKey>.json with contentHash), plugin.json content
npx tsx check-reports.mts   # myHubV2's validators on every manifest, built document and template
cd ../.. && npx tsx scripts/validate.ts
```

Open a PR only when `node test.js`, `check-reports.mts` and `validate.ts` all pass.

## What is where

| File | What it is |
|---|---|
| `reports.js` | Every template: slug, title, description, tags, CRA id. The catalogue, skills and tests read it. |
| `engines.js` / `build.js` | Assemble `<platform>/<id>.cfg.js` with that platform's kit → `out/<platform>-<id>.html`. |
| `harness.js` | jsdom + a mock `MyHubReport` that behaves like the host (manifest params, defaults, unknown inputs rejected, `getData`, snapshot mode, a pinned clock per platform). Same contract as the platform kits' harnesses. |
| `<platform>/<id>.cfg.js` + `.manifest.json` + `.test.js` | One report: config, `dataBindings`, tests on the platform kit's fixtures / ledger (so ties hold by construction and tampering must fail). |
| `catalogue/` | CRA-00: builder, manifest, tests. |
| `gen.js` · `gen-ext.js` · `mk-libraries.js` | Generators (above). |
| `check-reports.mts` | myHubV2's own validators (the Xero kit's verbatim copy of `packages/shared/src/artifacts/report-bindings.ts`). |

## Platform facts relied on (verified 6 Oct 2026)

- Hydrate: every binding on open, 60 requests a minute per user, ≤ 12 bindings and ≤ 8 inputs per report (`apps/web/src/app/api/artifacts/[id]/hydrate/route.ts`, `report-bindings.ts`).
- `artifact_from_template` copies an installed extension's template and sets declared input defaults (`apps/web/src/lib/agent/tools/artifact-sdk-tools.ts`), on myHubV2 dev and qa.
- Connector tools on myhub-mcp-servers `origin/dev` = `origin/staging` (what QA calls): xero-accounting 126, myob-accounting 51 (with `myob_company_file_id`), quickbooks-accounting entity + report tools. master has fewer (Xero 120, MYOB 29, no MYOB company-file override), so MYOB per-file reports are not production-ready.
- QuickBooks is one company per connection.
