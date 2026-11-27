# BAS readiness checks automation (source)

`bas_checks.py` is the Python step of *Client Reporting Agent: BAS readiness checks*. It's a line-for-line port of
myhub-mcp-servers `src/integrations/xero-accounting/api/bas-readiness-checks.ts` (origin/dev, 27 Nov 2026), which ran on
the retiring xero-accounting MCP server; it reads Xero through the Xero API connector (`xero-api`) instead.

- Edit `bas_checks.py`, then run `node build.mjs` (writes the automation JSON with a fresh contentHash).
- Differences from the original: reads run one at a time (the original ran 3 at once, so when several optional reads
  fail, `read.unread` lists them in call order rather than finishing order), and lists are read 100 rows a page
  (`xero-api` has no pageSize input; the original asked for 500), so up to 2,000 rows per list instead of 10,000.

Verified on 27 Nov 2026: the original TypeScript and this port were run on 2,000 generated Xero ledgers through the
same fake Xero data; all 2,000 results were identical (every rule fired in hundreds of them). The automation's flow
passes myHubV2's `flowIrSchema` and `validateFlowSemantics` with no issues.

**Sandbox rule (28 Nov 2026):** node code runs with a guarded `__import__`, and C-level calls that import a helper
module lazily go through it too. `datetime.strptime` (imports `_strptime`) failed every run on QA, so dates are parsed
and formatted by hand and there is no `functools` or `strftime`. Before shipping a change, run the step's code under the
same guard (allowed stdlib roots from myHubV2 `sandbox-bootstrap.py`, banned builtins removed): the 27 Nov version
failed 300/300 simulated runs, the fixed one passes 300/300 and still matches the TypeScript original on 2,000 ledgers.
