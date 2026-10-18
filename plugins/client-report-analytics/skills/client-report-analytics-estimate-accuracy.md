---
name: client-report-analytics-estimate-accuracy
description: CRA-13 Estimate Accuracy for one client (Xero or QuickBooks) as a live, validated report. Use when the user asks for the estimate accuracy of a client, estimate vs actual, how close task time estimates or estimates were to the time logged or the invoices raised.
---

# CRA-13 Estimate Accuracy

Use when the user asks for the Estimate Accuracy (CRA-13) of one client: estimated against actual: on Xero, each Xero Projects task's time estimate against the time logged and each project's estimate against its time and expenses; on QuickBooks, each estimate against the invoices raised from it, in dollars.

## Rules for every client report

- **Confirm the inputs first (never assume):** the client (from the user's own connections: one client per report), the period or as-at date, cash or accrual where offered, and the persona (Owner, Bookkeeper, Executive or Client). Ask once for anything missing; offer the defaults (last complete quarter for tax reports, this financial year to date for the overview).
- **Find the client's platform and id** with one discovery call: Xero `list_connections` (xero-accounting), MYOB `list_company_files` (myob-accounting), QuickBooks `qbo_query` with `SELECT * FROM CompanyInfo` (quickbooks-accounting). If the user names a client that none of their connections expose, say so and list the ones they can use. Never put another client's id in a report.
- **Create the report with `artifact_from_template`**: `plugin` = `client-report-analytics`, `slug` from the table below, `title` = "<Report name> — <client name> — <period>", and `inputs` = only the declared inputs the request changes (exact names from the table; dates as `YYYY-MM-DD`). You write no HTML and no figures: the report fetches live data every time it opens and recomputes its checks.
- **If `artifact_from_template` is not available or returns template_not_found**, say the Client Report Analytics extension is not installed or not up to date in this workspace; do not hand-write a report instead.
- **Reply** with the report button the tool returns, one line on what it shows, and: "The banner at the top shows the validation checks; a red line means a figure did not tie and should not be relied on." Never quote figures you did not read from a tool result. Unsourced items are "N/A — not in source".
- **Errors:** `needs_connection` → "Connect <platform> (Settings → Connections)". A tool error → show it word for word; do not retry more than once.

## Templates

| Platform | Template slug | Client input |
|---|---|---|
| Xero | `client-xero-estimate-accuracy` | the organisation id (`tenantId` from `list_connections`) |
| QuickBooks | `client-quickbooks-estimate-accuracy` | none: QuickBooks is the one connected company |

### Xero Estimate Accuracy (`client-xero-estimate-accuracy`)

| Input | Label | Type | Default |
|---|---|---|---|
| `org` | Organisation | string | `` |
| `project` | Project (set by the report, one per call: leave empty) | string | `` |
| `display` | Display settings | string | `{"cents":1,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,…` |

### QuickBooks Estimate Accuracy (`client-quickbooks-estimate-accuracy`)

| Input | Label | Type | Default |
|---|---|---|---|
| `start_date` | From | date | `2026-07-01` |
| `end_date` | To | date | `2026-09-30` |
| `txn_where` | Transaction filter | string | `TxnDate >= '2026-07-01' AND TxnDate <= '2026-09-30'` |
| `inv_where` | Invoices from | string | `TxnDate >= '2026-07-01'` |
| `persona` | View as | enum (Client / Bookkeeper / Practitioner / Executive) | `Practitioner` |
| `display` | Display settings | string | `{"cents":1,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,…` |

## Steps

1. Confirm the inputs (rules above). Keep the template defaults for anything the user did not ask to change.
2. Make the discovery call for the client's platform and pick the client's id.
3. Call `artifact_from_template` with `plugin: "client-report-analytics"`, the platform's slug, and `inputs` holding the client input, the period dates (and the basis where the template has one) the user chose, using the input names in that platform's table.
4. Reply as the rules say. If the user wants a different period or basis later, tell them to change it in the report's controls (it refetches) rather than creating another copy.

## Validation (shown in the report, recomputed on every open)

- Each variance = actual − estimated, and the totals add up.
- Xero: each Xero Projects task's time estimate against the time logged on it, and each project's estimate against its time and expenses to date; the task time must add up to each project's time logged. Needs the Xero Projects extension connected.
- QuickBooks: each estimate against the invoices raised from it, in dollars (QuickBooks has no time estimates).
- MYOB has no job budgets or quotes linked to invoices in its API: for a MYOB client, open MYOB Budget Management from the MYOB Reporting Studio (the file's budgets against actual) and say that is what it measures.
- Switching client refetches every source for the new client; nothing of the previous client stays on the page or in the Excel download.

## QA test (sandbox / demo organisations only)

On a QA workspace with the Xero demo company, a MYOB sandbox company file and a QuickBooks sandbox company connected: ask for the Estimate Accuracy of each, for the last complete quarter, accrual. Each report opens with a green banner; compare the headline figures with the same platform's library report (the estimates list and the invoices raised from them) for the same dates; switch client in the report and check nothing of the first client remains; download Excel and PDF.
