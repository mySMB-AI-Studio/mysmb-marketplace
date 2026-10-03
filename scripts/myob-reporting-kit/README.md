# MYOB reporting kit — source and tests

This folder is the source for the kit reports of `plugins/myob-reporting-studio`. The foundation skill, every kit report skill and the report templates are generated from it, so change the source here and regenerate rather than editing the generated files by hand. **Never Pull this extension into the Developer Instance**: change it here, then publish it from dev.

- `mk-kit.js` holds the report kit (`MK.app` controller, the MYOB account walker with the P&L and Balance Sheet layouts, presets, tables, charts, the .xlsx writer). `mk.css` is the stylesheet and `skeleton.html` is the page.
- `reports/<id>.manifest.json` and `reports/<id>.cfg.js` hold each kit report's `dataBindings` and report config.
- `families.js` holds the skill prose for each kit report (library M-id, triggers, members, checks, golden-set figures). Report skills not listed there are still written specifications; their rules come from `foundation-prose.md`.
- `fixtures.js` holds MYOB-shaped fixtures that mirror the live mySMB.com file (the P&L and Balance Sheet tests in `test-myob.js`).
- `ledger.js` is a MYOB company file as one set of books, with two company files: every response the reports read (P&L and Balance Sheet summaries at any dates, the chart of accounts with default tax codes, the tax codes, open and closed invoices and bills, journal transactions, the connector's ageing) is derived from the same transactions, so a report's ties must pass on it and a tampered response must fail. The books include pay runs (PAYG withholding and superannuation accrued, paid quarterly), a credit card and quarterly BAS payments. `test-wave1.js`, `test-wave1b.js` and `test-conformance.js` run on it.
- `mk-variants.js` writes the reports that are another kit report opening differently (Aged receivables = Unpaid invoices aged by due date; Customer sales = the Sales register's customer view).
- `gen-myob.js` writes the foundation (build recipe, tested kit and stylesheet, the rules for written-specification skills), each kit report skill, and **a report template per kit report** (`reports/<skill>/report.json` + `report.html`). A template is the same document the copy path assembles (skeleton + stylesheet + kit + config) with the report's `dataBindings`. The agent creates reports from it with `artifact_from_template`, and the workspace lists it under Reports → From your plugins (**Use this report**). The generator also declares `"reports": "reports"` in `plugin.json` and the catalogue entry, and keeps the agent's build step (and its blueprint `contentHash`) in line.

## Platform facts the kit relies on

- **`bundle.inputs`.** A template copy keeps the template's document, so its config `defaults` are the template's own, while its manifest defaults carry the copy's inputs (and the host hydrates with those). myHubV2 sends the input values each whole bundle ran at as `bundle.inputs`, and the kit adopts them before rendering. `test-conformance.js` checks this for every template.
- MYOB tool results can be `{"__error": "…"}` instead of throwing; the kit treats those as failed sources. A report can declare a source `optional` (the dashboards' tax codes): if it fails, the report says what it used instead and the banner does not count it as a failed check.
- `list_tax_codes` ignores `myob_company_file_id` on the connector today (it always reads the connection's default file). The reports still send it, and only use a tax code's accounts when their UIDs are in the chosen file's chart, so another file's codes can never pick its accounts.

## Commands

Run `npm i` once in this folder, then:

```bash
npm test             # P&L and Balance Sheet on the live-shaped fixtures (test-myob.js), the other kit reports on the ledger
                     # (test-wave1.js; the dashboards in test-wave1b.js), and conformance on every report (test-conformance.js): LIB-002 company-file isolation and
                     # template copies opened on another company file and dates
npm run gen          # the variants, then the foundation, the kit report skills, the templates and the manifest keys
npm run roundtrip    # before a PR: extract the code from the generated skills, re-run the tests on it, build every kit report,
                     # run myHubV2's validators, check every template equals its skill, and check the skill size limits and that
                     # each report document + dataBindings is at most 35,000 tokens (the copy path writes both in one call)
```

`check-reports.mts` runs myHubV2's own validators (`npx tsx check-reports.mts <dir>`). `platform/report-bindings.ts` is a verbatim copy of myHubV2 `packages/shared/src/artifacts/report-bindings.ts`; refresh it when that file changes.

The tests pin the report clock to 28 September 2026, the date the fixtures are built around, so rolling presets give the same dates on any day.
