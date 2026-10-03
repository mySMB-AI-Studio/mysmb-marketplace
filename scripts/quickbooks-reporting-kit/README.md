# QuickBooks reporting kit — source and tests

This folder is the source for `plugins/quickbooks-reporting-studio`. The skills, the agent and the report templates are generated from it, so change the source here and regenerate rather than editing the generated files by hand. **Never Pull this extension into the Developer Instance**: change it here, then publish it from dev.

- `qb-kit.js` holds the report kit: the `QB.app` controller, the QuickBooks report walker, presets, tables, charts and the .xlsx writer. `qb.css` is the stylesheet and `skeleton.html` is the page.
- `reports/<id>.manifest.json` and `reports/<id>.cfg.js` hold each family's `dataBindings` and report config.
- `families.js` (with `families-w2.js` … `families-w4.js`) holds the skill prose for each family (triggers, members, checks, golden-set figures).
- `fixtures.js` contains QuickBooks-shaped fixtures, and `specs.js` holds the test expectations for each report.
- `gen-ext.js` writes the extension: the foundation skill, a skill per family, the agent and its blueprint, `plugin.json`, and **a report template per kit family** (`reports/<skill>/report.json` + `report.html`). A template is the same document the copy path assembles (skeleton + stylesheet + kit + config) with the family's `dataBindings`. The agent creates reports from it with `artifact_from_template`, and the workspace lists it under Reports → From your plugins (**Use this report**). The custom report builder has no template, because the agent picks its QuickBooks report tool.

## Platform facts the kit relies on

- **`bundle.inputs`.** A template copy keeps the template's document, so its config `defaults` are the template's own, while its manifest defaults carry the copy's inputs (and the host hydrates with those). myHubV2 sends the input values each whole bundle ran at as `bundle.inputs`, and the kit adopts them before rendering. Without that, the controls, the header and every later request would follow the template's defaults. `test-conformance.js` checks this for every template.
- The host hydrates every binding at once with the manifest defaults; follow-up requests use `MyHubReport.getData` with the declared input names.

## Commands

Run `npm i` once in this folder, then:

```bash
npm test             # kit unit tests, every report end to end (live, every control, snapshot, needs_connection, Excel),
                     # Wave 4 behaviour, P&L, catalogue, audit log, template conformance (bundle.inputs)
npm run gen          # regenerate the catalogue data, ap.cfg.js and the extension (skills, agent + hash, plugin.json, templates)
npm run roundtrip    # before a PR: extract the code from the generated skills, re-run the tests on it, build every report,
                     # run myHubV2's validators, check every template equals its skill, and check the skill size limits
```

`check-reports.mts` runs myHubV2's own validators (`npx tsx check-reports.mts <dir>`): every manifest with `reportDataBindingsSchema` and `resolveHydrateInputs`, every built document and every template with `validateReportDocument`, and every `report.json` with the strict template metadata schema. `platform/report-bindings.ts` is a verbatim copy of myHubV2 `packages/shared/src/artifacts/report-bindings.ts`; refresh it when that file changes.

The tests pin the report clock to 25 September 2026, the date the fixtures are built around, so rolling presets give the same dates on any day.

Other helpers: `gen-variants.js` (the inventory and projects overview configs from their family configs), `fix-manifest-format.js` (re-formats manifests in the house style), `demo.js <report>` (a standalone demo page backed by the fixtures).
