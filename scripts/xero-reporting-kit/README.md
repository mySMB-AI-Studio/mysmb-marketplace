# Xero Reporting Studio — report kit (source, tests, generator)

This folder is the source of the **kit reports** in `plugins/xero-reporting-studio/skills/`. Each kit skill carries a `dataBindings` manifest and a report config. The foundation skill carries the kit (`xk-kit.js`), the stylesheet (`xk.css`) and the skeleton. The agent assembles them verbatim; it never writes report code.

**Never hand-edit the config or kit blocks in the skill `.md` files.** Change the files here, run the tests, then regenerate.

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
| `xk-kit.js` / `xk.css` / `skeleton.html` | The kit, stylesheet and page skeleton (one copy each; the foundation embeds them, with the kit minified for whitespace and comments only). |
| `reports/<id>.cfg.js` + `<id>.manifest.json` | One kit report: its config and its `dataBindings`. `aged.tpl.js` and `pipeline.tpl.js` are templates: `mk-aged.js` writes `ar` / `ap` and `mk-pipeline.js` writes `so` / `pu`. Edit the templates, not those four. |
| `families.js` | One entry per kit skill (skill file, title, trigger, discovery, dates, members, checks, golden set, file name). |
| `gen-xero.js` | Writes the foundation and every kit skill. The foundation's "Rules for report skills without a kit config" come from `foundation-written-spec.md`. That section is the guidance for the written-spec skills, so edit it there. |
| `harness.js` | Runs a built report in jsdom against a mock `MyHubReport` that behaves like the host: params come from the manifest, defaults are filled, unknown inputs are rejected, plus `getData`, snapshot mode and a fixed clock (25 Sep 2026). |
| `ledger.js` | A small double-entry set of books. **Every Xero response is derived from it:** P&L (accrual and cash, `periods`/`timeframe`), Balance Sheet, Bank Summary, Trial Balance, and lists with statuses, `where` and 100-row paging. Cross-report ties therefore hold by construction, and a tampered value must fail. |
| `fixtures.js` | The original P&L / Balance Sheet fixtures used by `test-xero.js`. |
| `test-ledger.js` · `test-xero.js` · `test-dash.js` | The tests. Run `node test-dash.js <group>` to run one group (`aged`, `pipe`, `bo`, `pf`, `cp`, `hs`, `vz`, `cs`, `cf`, `gst`, `rc`, `tb`, `me`). |
| `check-reports.mts` + `platform/` | The platform's own validators. `report-bindings.ts` is a verbatim copy of myHubV2 `packages/shared/src/artifacts/report-bindings.ts`. |
| `roundtrip.js` | The pre-PR check described above. |
| `demo.js` | `node demo.js <id> [light|dark] [xero|mysmb]` writes `out/<id>…demo.html`, which runs offline on the ledger. Open it in a browser to look at a report. |

## What every report's tests cover

1. **Happy path:** figures equal the ledger, and every check passes with a green banner.
2. **Tampering:** each source is tampered in turn and the right check must fail. Confirm a new test fails without the fix, so it isn't vacuous.
3. **Failures:** a failed binding turns the banner red and never shows $0 with a tick. HTTP 429 is retried one call at a time. Lists over 100 rows load page 2, and the 20-page cap is reported.
4. **Controls:** every control, snapshot mode, branding (Xero default, mySMB under Customise), dark theme and the Excel download.

## Platform facts the kit relies on

- **Inputs:** at most 8 per report, of type string, date, enum or number (no boolean). Boolean tool params such as `paymentsOnly` are static, so a switchable cash/accrual basis needs two bindings.
- **Bindings:** at most 12. The host hydrates all of them at once and Xero allows 5 calls in progress per organisation, so the kit retries 429s sequentially.
- **Opening a report:** the host hydrates with the **manifest** defaults. The kit compares the dates in Xero's report title with its controls and refetches if they differ.
- **Skill limits:** markdown up to 128 × 1024 characters and a description of at most 500 characters (myHubV2 developer skills). The generator enforces both.
- **The save check** is a plain text match on `MyHubReport.onData`. The kit calls it in full.
- **Bindings from other connectors** (e.g. `xero-payroll-au`, `xero-assets`) work like any other binding. Declare them in `cfg.sources` (`{ bindingId: { name: 'Xero Payroll AU', optional: true } }`):
  - a missing connection then names that connector;
  - only the main Xero connection raises the top "Connect Xero" banner;
  - an optional source that fails is an N/A line, not a red banner.

  Both connectors accept `xero_tenant_id`. Bind the organisation input to them too, or a report could mix two organisations' data.
- **A report config owns its body.** Statements use `XK.statement`; dashboards and task lists (e.g. `me.cfg.js`) build their own layout from the kit pieces. Findings such as month-end tasks are content, not checks; the banner is for data-integrity ties.
