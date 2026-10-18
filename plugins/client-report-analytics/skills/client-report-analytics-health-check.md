---
name: client-report-analytics-health-check
description: CRA-09 Health Check for one client (Xero, MYOB or QuickBooks) as a live, validated report. Use when the user asks for the health check of a client, a health check, a one-page summary of a client's finances and data quality.
---

# CRA-09 Health Check

Use when the user asks for the Health Check (CRA-09) of one client: income, profit, bank, overdue receivables and payables, and the data quality findings, on one page.

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
| Xero | `client-xero-health-check` | the organisation id (`tenantId` from `list_connections`) |
| MYOB | `client-myob-health-check` | the company file id (`Id` from `list_company_files`) |
| QuickBooks | `client-quickbooks-health-check` | none: QuickBooks is the one connected company |

### Xero Health Check (`client-xero-health-check`)

| Input | Label | Type | Default |
|---|---|---|---|
| `from_date` | From | date | `2026-07-01` |
| `to_date` | To | date | `today` |
| `date_where` | Period filter | string | `Date>=DateTime(2026,07,01) AND Date<=DateTime(2026,09,25)` |
| `from12` | Start of the 12 months | date | `2025-09-26` |
| `org` | Organisation | string | `` |
| `page` | Page | number | `1` |
| `display` | Display settings | string | `{"cents":1,"k":0,"zeros":1,"neg":"paren","red":1,"hdr":1,…` |

### MYOB Health Check (`client-myob-health-check`)

| Input | Label | Type | Default |
|---|---|---|---|
| `from_date` | From | date | `2026-07-01` |
| `to_date` | To | date | `2026-09-28` |
| `company_file` | Company file | string | `` |
| `persona` | View as | enum (Client / Bookkeeper / Practitioner / Executive) | `Bookkeeper` |
| `display` | Display settings | string | `{"cents":1,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,…` |

### QuickBooks Health Check (`client-quickbooks-health-check`)

| Input | Label | Type | Default |
|---|---|---|---|
| `start_date` | From | date | `2026-07-01` |
| `end_date` | To | date | `2026-09-30` |
| `txn_where` | Transaction filter | string | `TxnDate >= '2026-07-01' AND TxnDate <= '2026-09-30'` |
| `persona` | View as | enum (Client / Bookkeeper / Practitioner / Executive) | `Practitioner` |
| `display` | Display settings | string | `{"cents":1,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,…` |

## Steps

1. Confirm the inputs (rules above). Keep the template defaults for anything the user did not ask to change.
2. Make the discovery call for the client's platform and pick the client's id.
3. Call `artifact_from_template` with `plugin: "client-report-analytics"`, the platform's slug, and `inputs` holding the client input, the period dates (and the basis where the template has one) the user chose, using the input names in that platform's table.
4. Reply as the rules say. If the user wants a different period or basis later, tell them to change it in the report's controls (it refetches) rather than creating another copy.

## Validation (shown in the report, recomputed on every open)

- The checks run on the client's ledger every time the report opens, with the rules of the overnight checks engine (Ledger checks, Bookkeeping for Xero). Findings by category add up to the total, and so does the $ at risk.
- Every check in scope is accounted for: run live, N/A on this platform with the reason (for example, MYOB doesn't say whether a transaction has an attachment), or "runs overnight" (register checks against the Australian Business Register, and checks that compare with the last run). None of those is ever shown as passed.
- A finding is not a failed report: the banner checks the report's own sums and sources; the findings are the content.
- Net profit = income − expenses from the platform's own Profit and Loss; receivables and payables overdue come from the open invoices and bills.
- Switching client refetches every source for the new client; nothing of the previous client stays on the page or in the Excel download.

## QA test (sandbox / demo organisations only)

On a QA workspace with the Xero demo company, a MYOB sandbox company file and a QuickBooks sandbox company connected: ask for the Health Check of each, for the last complete quarter, accrual. Each report opens with a green banner; compare the headline figures with the same platform's library report (the platform's own records for two or three of the findings (a bill with no attachment, a line coded to Suspense, a duplicate bill)) for the same dates; switch client in the report and check nothing of the first client remains; download Excel and PDF.
