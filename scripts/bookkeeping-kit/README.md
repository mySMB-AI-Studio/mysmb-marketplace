# Bookkeeping kit: source, generator and tests

This folder is the source for `plugins/bookkeeping-xero` ("Bookkeeping for Xero") in this repo. The extension is **generated** from here: change the source and regenerate, never hand-edit the plugin files (a hand edit is overwritten the next time anyone regenerates). The design pack (blueprints, gap analysis, build plan) is kept outside the repo.

## Layout

| Path | What |
|---|---|
| `src/flows.js` | The automations: triggers, params, scopes, node wiring (bindings), forms each one uses |
| `src/automations/<key>/<node>.py` | Node code, one file per node |
| `src/lib/util.py`, `src/lib/xero.py` | Shared helpers and the Xero adapter. The generator inlines only the functions each node calls (transitively), so scopes and code stay minimal. **Every Xero call passes `xero_tenant_id`.** |
| `src/forms/*.json` | The forms |
| `src/agents/`, `src/skills/` | Bookkeeping Coordinator (Xero) + `bookkeeping-xero-foundation` |
| `src/README.md`, `src/assets/logo.svg` | The plugin README and store logo |
| `gen-ext.js` | Writes the plugin: deterministic originKeys (`bookkeeping:form:<key>` is shared across future ledger packs), `@form:` → sourceIds + `dependencies`, contentHash, plugin.json, `.mcp.json`, and the marketplace entry (only when missing) |
| `check.mts` | myHubV2's own schemas (copied into `.myhub/` from `origin/dev`): Flow IR shape and semantics, form schema, content envelopes, contentHash, scope coverage, marketplace entry |
| `pycheck.mts` | Validation stage 3 locally: pyright (basic, py3.12) against the platform's generated stubs, exactly as the Developer Instance runs it |
| `tests/` | `harness.py` executes the **generated** IR (bindings, if-nodes, outputs, import allowlist, keyword-only api) against a fake workspace and a fake Xero with 3 orgs. `test_flows.py` and the other `test_*.py` files are the scenarios; `test_static.py` holds the AST checks |

## Commands

Run from this folder (`scripts/bookkeeping-kit`):

```bash
npm ci                                               # once: zod, croner, tsx, pyright
python -m pip install --user pypdf fpdf2 pillow      # once: for the tests
npm run gen                                          # regenerate plugins/bookkeeping-xero (+ marketplace entry if missing)
npm run check                                        # platform schemas + semantics
npm run pycheck                                      # pyright stage
npm test                                             # the scenario tests, against the generated plugin
cd ../.. && npx tsx scripts/validate.ts              # the repo gate
```

After `npm run gen`, `git diff plugins/bookkeeping-xero` shows exactly what your source change did to the extension. Commit the kit change and the regenerated plugin together.

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
