# Bookkeeping kit: source, generator and tests

This folder is the source for `plugins/bookkeeping-xero` ("Bookkeeping for Xero") and the two checks-only packs, `plugins/bookkeeping-myob` ("Bookkeeping checks for MYOB") and `plugins/bookkeeping-quickbooks` ("Bookkeeping checks for QuickBooks"), in this repo. The extensions are **generated** from here: change the source and regenerate, never hand-edit the plugin files (a hand edit is overwritten the next time anyone regenerates). The design pack (blueprints, gap analysis, build plan) is kept outside the repo.

## Layout

| Path | What |
|---|---|
| `src/flows.js` | The automations: triggers, params, scopes, node wiring (bindings), forms each one uses |
| `src/automations/<key>/<node>.py` | Node code, one file per node |
| `src/lib/util.py`, `src/lib/xero.py` | Shared helpers and the Xero adapter. The generator inlines only the functions each node calls (transitively), so scopes and code stay minimal. **Every Xero call passes `xero_tenant_id`.** |
| `src/lib/checks.py`, `src/lib/myob.py`, `src/lib/qbo.py` | The ledger checks (ledger-neutral rules over a snapshot) and the MYOB and QuickBooks adapters that build that snapshot (`bk_ledger(client, …)`; each adapter also has one for Xero in `xero.py`). An adapter's `na` map lists the checks its ledger can't answer: they aren't run, and the Checks item lists them as not checked. **Every MYOB call passes `myob_company_file_id`**; a QuickBooks connection reaches one company, so the QuickBooks pack checks a client only while it's the connected one. |
| `src/forms/*.json` | The forms |
| `src/agents/`, `src/skills/` | Bookkeeping Coordinator (Xero) + `bookkeeping-xero-foundation` |
| `src/README.md`, `src/assets/logo.svg` | The plugin README and store logo (`README.<ledger>.md`, `logo-<ledger>.svg` for the checks packs) |
| `gen-ext.js` | Writes a plugin (`node gen-ext.js <root> [xero|myob|quickbooks]`): deterministic originKeys, `@form:` → sourceIds + `dependencies`, contentHash, plugin.json, `.mcp.json`, and the marketplace entry (only when missing, inserted without reformatting the file). The checks packs' originKeys are their own (`bookkeeping:<ledger>:…`): two extensions shipping one originKey would share a single copy in the workspace, each install overwriting the other's. They share Knowledge with Bookkeeping for Xero (settings, clients, findings); each client file says its `ledger`, and a client is in one ledger only. |
| `check.mts` | myHubV2's own schemas (copied into `.myhub/` from `origin/dev`): Flow IR shape and semantics, form schema, content envelopes, contentHash, scope coverage, marketplace entry |
| `pycheck.mts` | Validation stage 3 locally: pyright (basic, py3.12) against the platform's generated stubs, exactly as the Developer Instance runs it |
| `tests/` | `harness.py` executes the **generated** IR (bindings, if-nodes, outputs, import allowlist, keyword-only api) against a fake workspace and a fake Xero with 3 orgs (`fakes_ledgers.py`: fake MYOB and QuickBooks connectors, shaped like myhub-mcp-servers returns them). `test_flows.py` and the other `test_*.py` files are the scenarios (`test_ledgers.py` for the checks packs); `test_static.py` holds the AST checks |

## Commands

Run from this folder (`scripts/bookkeeping-kit`):

```bash
npm ci                                               # once: zod, croner, tsx, pyright
python -m pip install --user pypdf fpdf2 pillow      # once: for the tests
npm run gen                                          # regenerate plugins/bookkeeping-xero, -myob and -quickbooks (+ marketplace entries if missing)
npm run check                                        # platform schemas + semantics (all three packs)
npm run pycheck                                      # pyright stage (all three packs)
npm test                                             # the scenario tests, against the generated plugin
cd ../.. && npx tsx scripts/validate.ts              # the repo gate
```

After `npm run gen`, `git diff plugins/bookkeeping-xero` shows exactly what your source change did to the extension. Commit the kit change and the regenerated plugin together.

**Without payroll.** Payroll stays in the extension (dev and QA), but UAT and production mustn't have it until its privacy sign-off. `node gen-ext.js <checkout of the uat branch> --without-payroll` writes the same extension without its payroll automations, forms and texts. Every accounts payable component keeps its originKey, and only *Start setup* and *Apply setup* differ, because they lose their payroll parts. Use it to open the PR into `uat` instead of AI Studio's *Promote to UAT*, which would copy payroll across from QA. The build is marked in the source:
- `payrollOnly(...)` / `payrollOnly: true` in `src/flows.js`;
- `PAYROLL_FORMS`;
- `# >>> payroll` … `# <<< payroll` blocks in node code;
- `<!-- >>> payroll -->` / `<!-- >>> no-payroll -->` blocks in the README and skill.

The default build drops only the markers, so it is unchanged. `tests/test_without_payroll.py` builds it and runs the AP scenarios on it.

Refresh `.myhub/` from myHubV2 `origin/dev` when the platform changes (`git archive origin/dev <paths> | tar -x -C .myhub`; `stubs.ts` needs its three `@myhub/shared` imports rewritten to relative paths). The commit used is in `.myhub/REV`.

## Knowledge layout (org level; Knowledge allows at most 2 folder levels)

`Bookkeeping/settings.json` · `Bookkeeping/Clients/<client>.json` · `Bookkeeping/Rules/<client>.json` · `Bookkeeping/Bills/<review item id>.json` · `Bookkeeping Inbox/<client>/` · `Bookkeeping Processed/<client>/` · `Bookkeeping Failed/<client>/`

## What the tests don't prove

The harness is not the Pyodide sandbox, and the fake Xero is not Xero. Before relying on it, confirm these on a QA tenant with a real Xero login that sees at least two organisations:

- Knowledge upload events fire for files dragged in through the UI, with `scope: "org"`.
- `api.ai.extract` returns the invoice shape reliably on real bills. This needs the sample pack.
- The Xero write tools honour `xero_tenant_id`. This is myhub-mcp-servers PR #558, and it must reach `staging`.
- `upload_attachment` succeeds without the `accounting.attachments` scope. If it doesn't, bills still post; the attachment error shows on the review item.
- Xero accepts `Status: DELETED` on a draft bill, and the `Date` / `DueDate` format.
- The Developer Instance dry run passes for all five automations.

## Test samples

`qa-samples/` holds the sample bills for a manual QA run. The email test packs (`email-pack`, `email-pack-60`) and their generators are kept outside the repo, because they carry a real mailbox address and contact names from the QA Xero organisation. Ask the extension owner for them.
