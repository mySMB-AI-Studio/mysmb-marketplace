# MYOB reporting kit — source and tests

This folder is the source for the kit reports of `plugins/myob-reporting-studio`. The foundation skill, every kit report skill and the report templates are generated from it, so change the source here and regenerate rather than editing the generated files by hand. **Never Pull this extension into the Developer Instance**: change it here, then publish it from dev.

- `mk-kit.js` holds the report kit (`MK.app` controller, the MYOB account walker with the P&L and Balance Sheet layouts, presets, tables, charts, the .xlsx writer). `mk.css` is the stylesheet and `skeleton.html` is the page.
- `reports/<id>.manifest.json` and `reports/<id>.cfg.js` hold each kit report's `dataBindings` and report config.
- `families.js` holds the skill prose for each kit report (library M-id, triggers, members, checks, golden-set figures). Report skills not listed there are still written specifications; their rules come from `foundation-prose.md`.
- `fixtures.js` holds MYOB-shaped fixtures that mirror live responses.
- `gen-myob.js` writes the foundation (build recipe, tested kit and stylesheet, the rules for written-specification skills), each kit report skill, and **a report template per kit report** (`reports/<skill>/report.json` + `report.html`). A template is the same document the copy path assembles (skeleton + stylesheet + kit + config) with the report's `dataBindings`. The agent creates reports from it with `artifact_from_template`, and the workspace lists it under Reports → From your plugins (**Use this report**). The generator also declares `"reports": "reports"` in `plugin.json` and the catalogue entry, and keeps the agent's build step (and its blueprint `contentHash`) in line.

## Platform facts the kit relies on

- **`bundle.inputs`.** A template copy keeps the template's document, so its config `defaults` are the template's own, while its manifest defaults carry the copy's inputs (and the host hydrates with those). myHubV2 sends the input values each whole bundle ran at as `bundle.inputs`, and the kit adopts them before rendering. `test-conformance.js` checks this for every template.
- MYOB tool results can be `{"__error": "…"}` instead of throwing; the kit treats those as failed sources.

## Commands

Run `npm i` once in this folder, then:

```bash
npm test             # the kit reports end to end (test-myob.js) and template conformance (test-conformance.js)
npm run gen          # regenerate the foundation, the kit report skills, the templates and the manifest keys
npm run roundtrip    # before a PR: extract the code from the generated skills, re-run the tests on it, build every kit report,
                     # run myHubV2's validators, check every template equals its skill, and check the skill size limits
```

`check-reports.mts` runs myHubV2's own validators (`npx tsx check-reports.mts <dir>`). `platform/report-bindings.ts` is a verbatim copy of myHubV2 `packages/shared/src/artifacts/report-bindings.ts`; refresh it when that file changes.

The tests pin the report clock to 28 September 2026, the date the fixtures are built around, so rolling presets give the same dates on any day.
