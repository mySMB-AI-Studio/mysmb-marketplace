# Marketplace Consolidation Runbook

Merges the two legacy repos (`mysmb-marketplace` + `mysmb-marketplace-staging`)
into **one repo with branch tiers**. This repo (`mysmb-marketplace`) is the
survivor; the staging repo is archived at the end.

```
feature/* ──► dev ──► staging ──► main (production)
```

- `main` = today's production plugin set.
- `staging` / `dev` = the full superset (everything in the legacy staging repo),
  with all `.mcp.json` URLs normalized to the **production** host.
- URLs are environment-agnostic on every branch; per-env routing is myHub's
  `MCP_SERVERS_BASE_URL` rewrite. The validator enforces this.

> These steps create/push the `staging` and `dev` branches and rewrite content.
> Run them with maintainer permissions; CI (`validate`) must be green at each
> step. The tooling/docs (validator URL rule, CONTRIBUTING/ONBOARDING, promote +
> normalize scripts, PR template, CODEOWNERS, CI-on-all-tiers) ship first on the
> working branch and should land on every tier.

## Differences inventory (what diverged between the two repos)

| Area | Detail | Resolution |
|------|--------|------------|
| **MCP URL host** | prod `…thankfulcliff-9090ceed…`, staging `…orangesky-e321d350…`; staging was inconsistent (some plugins already prod, `xero-scheduler` on staging) | Normalize ALL to prod host (`scripts/normalize-mcp-urls.mjs`); validator blocks regressions |
| **Plugin set** | staging adds 14: `cliniko-{billing,clinical,patients,practice,scheduling}`, `sprout-{employee,hr-general,payroll,time-attendance}`, `talkdesk`, `talkdesk-demo`, `github`, `myob-accounting`, `xero-scheduler`. Prod-only: `circle` | Superset → `staging`/`dev`; decide `circle` (keep or retire) for `main` |
| **Versions/widgets** | `dataverse` v0.1.0 (prod) vs v0.2.0 (staging); newer widgets in `dataverse`, `microsoft-365`, `xero-accounting`, `deskcrm` | Take staging's newer versions onto `staging`/`dev`; promote to `main` when vetted |
| **Scaffolding templates** | `scripts/create-plugin/template/*` diverge (prod has `oauth-provider.mjs`, `main.css`, `stubs/`, `system-fallback/`; staging has updated `App.tsx`, `vite.config.ts`) | Reconcile to the superset; note per-file which won |
| **marketplace.json** | prod has a duplicate `quickbooks-accounting` entry | De-dup |

## Steps

### 0. Land tooling/docs on the working branch (done on this branch)
Validator URL rule, `normalize-mcp-urls.mjs`, `promote-plugin.mjs`,
CONTRIBUTING/ONBOARDING, PR template, CODEOWNERS, `validate.yml` on all tiers.
Merge this into `main` first so every tier inherits it.

### 1. Create `dev` and `staging` from `main`
```bash
git fetch origin
git checkout main && git pull
git checkout -b staging && git push -u origin staging
git checkout -b dev main && git push -u origin dev
```

### 2. Import the staging superset onto `staging`
Bring the legacy staging repo's content (the 14 extra plugins + newer
versions/widgets + reconciled templates) into a branch off `staging`, then:
```bash
node scripts/normalize-mcp-urls.mjs     # rewrite any staging host → prod host
# de-dup quickbooks-accounting in .claude-plugin/marketplace.json
npx tsx scripts/validate.ts             # must pass (incl. URL rule)
```
Open a PR into `staging`. Once green + reviewed, merge. Fast-forward `dev` from
`staging` (or merge `staging → dev`) so `dev` carries the superset too.

### 3. Keep `main` as the vetted set
Promote individual plugins from `staging` to `main` only when ready:
```bash
git checkout main
node scripts/promote-plugin.mjs <plugin> --from staging --to main
node scripts/normalize-mcp-urls.mjs
npx tsx scripts/validate.ts
git commit -am "feat: promote <plugin> staging -> main"
```

### 4. Branch protection (request from a repo admin)
- `main`, `staging`: protected; merges only from the tier below; CI green + 1 approval.
- `dev`: CI green required.
- Enable required status check: **validate**.

### 5. Point MyHub at the branches
In each environment's MyHub admin, set `MARKETPLACE_DEFAULT_REF`
(prod→`main`, staging→`staging`, dev→`dev`) and (re)register the marketplace so
its `ref` is stored. Existing registrations with empty `ref` track the default
branch — set the branch explicitly to pin them.

### 6. Archive the legacy staging repo
After parity is confirmed in MyHub staging:
- Add a README banner on `mysmb-marketplace-staging` pointing here (→ `staging`
  branch).
- GitHub → Settings → **Archive** the repo (do **not** delete — keep history).
- Update any docs/links that referenced the two-repo split.

## Verification
- `validate` green on `main`, `staging`, `dev`.
- `grep -r orangesky-e321d350 plugins/` returns nothing on any branch.
- In MyHub staging: install the marketplace `@staging`, install a staging-only
  plugin (e.g. `cliniko-scheduling`) on a test tenant, confirm it loads and its
  MCP host resolves to the staging servers via `MCP_SERVERS_BASE_URL`.
