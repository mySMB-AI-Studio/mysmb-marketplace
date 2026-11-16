---
name: client-report-analytics-tax-by-type
description: CRA-05 Summary of Tax Amounts by Type for one client (Xero, MYOB or QuickBooks) as a live, validated report. Use when the user asks for the summary of tax amounts by type of a client, GST by tax type by month, a BAS preparation review.
---

# CRA-05 Summary of Tax Amounts by Type

Use when the user asks for the Summary of Tax Amounts by Type (CRA-05) of one client: GST by tax type for each month of the period, with period totals reconciled to the GST figures (BAS preparation review).

## Rules for every client report

- **Confirm the inputs first (never assume):** the client (from the user's own connections: one client per report), the period or as-at date, cash or accrual where offered, and the persona (Owner, Bookkeeper, Executive or Client). Ask once for anything missing; offer the defaults (last complete quarter for tax reports, this financial year to date for the overview).
- **Find the client's platform and id** with one discovery call: Xero `list_connections` (xero-accounting), MYOB `list_company_files` (myob-accounting), QuickBooks `qbo_query` with `SELECT * FROM CompanyInfo` (quickbooks-accounting). If the user names a client that none of their connections expose, say so and list the ones they can use. Never put another client's id in a report.
- **Create the report with `artifact_from_template`**: `plugin` = `client-report-analytics`, `slug` from the table below, `title` = "<Report name> — <client name> — <period>", and `inputs` = only the declared inputs the request changes (exact names from the table; dates as `YYYY-MM-DD`). You write no HTML and no figures: the report fetches live data every time it opens and recomputes its checks.
- **The period is set by the `display` input's `p` key as well as the dates.** When a report opens it re-sets `from_date` / `to_date` from `p` unless `p` is `custom` (and `as_at` from `a` unless `a` is `custom`). So:
  - **Specific dates** (for example "1 July to 30 September 2026"): set `from_date` and `to_date` **and** `display` = the template's default display string from the table below with only `"p":"custom"` changed. For a specific as-at date, set `as_at` and change `"a":"custom"` too.
  - **A named period** ("last quarter", "this financial year to date", "last month"): set only `display` with `p` = `this_month`, `last_month`, `this_quarter`, `last_quarter`, `this_fy`, `this_fy_td`, `last_fy` or `last_12m`, and leave the dates alone.
  - Copy the default display string exactly and change only `p` (and `a`): a key left out falls back to a generic look. If the period is the template's default, don't set `display` at all.
  - Never put a period in the title that the report won't show: the title's dates must match what the report runs for.
- **If `artifact_from_template` is not available or returns template_not_found**, say the Client Report Analytics extension is not installed or not up to date in this workspace; do not hand-write a report instead.
- **Reply** with the report button the tool returns, one line on what it shows, and: "The banner at the top shows the validation checks; a red line means a figure did not tie and should not be relied on." Never quote figures you did not read from a tool result. Unsourced items are "N/A — not in source".
- **Errors:** `needs_connection` → "Connect <platform> (Settings → Connections)". A tool error → show it word for word; do not retry more than once.

## Templates

| Platform | Template slug | Client input |
|---|---|---|
| Xero | `client-xero-tax-by-type` | the organisation id (`tenantId` from `list_connections`) |
| MYOB | `client-myob-tax-by-type` | the company file id (`Id` from `list_company_files`) |
| QuickBooks | `client-quickbooks-tax-by-type` | none: QuickBooks is the one connected company |

### Xero Summary of Tax Amounts by Type (`client-xero-tax-by-type`)

| Input | Label | Type | Default |
|---|---|---|---|
| `from_date` | From | date | `2026-04-01` |
| `to_date` | To | date | `2026-06-30` |
| `prev_end` | Day before the period | date | `2026-03-31` |
| `date_where` | Period filter | string | `Date>=DateTime(2026,04,01) AND Date<=DateTime(2026,06,30)` |
| `inv_ids` | Paid invoice ids | string | `` |
| `org` | Organisation | string | `` |
| `page` | Page | number | `1` |
| `display` | Display settings | string | `{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"last_quarter","a":"custom","c":"none","v":"gst","o":"b=org"}` |

### MYOB Summary of Tax Amounts by Type (`client-myob-tax-by-type`)

| Input | Label | Type | Default |
|---|---|---|---|
| `from_date` | From | date | `2026-04-01` |
| `to_date` | To | date | `2026-06-30` |
| `basis` | Accounting method | enum (Accrual / Cash) | `Accrual` |
| `company_file` | Client (MYOB company file) | string | `` |
| `persona` | View as | enum (Client / Bookkeeper / Practitioner / Executive) | `Bookkeeper` |
| `display` | Display settings | string | `{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"last_quarter","a":"custom","c":"none","v":"gst"}` |
| `m_from` | Month from | date | `2026-04-01` |
| `m_to` | Month to | date | `2026-04-30` |

### QuickBooks Summary of Tax Amounts by Type (`client-quickbooks-tax-by-type`)

| Input | Label | Type | Default |
|---|---|---|---|
| `start_date` | From | date | `2026-04-01` |
| `end_date` | To | date | `2026-06-30` |
| `bs_from` | GST account opening month | date | `2026-03-01` |
| `txn_where` | Transaction date filter | string | `TxnDate >= '2026-04-01' AND TxnDate <= '2026-06-30'` |
| `basis` | Accounting method | enum (Accrual / Cash) | `Accrual` |
| `agency_id` | Tax agency | string | `` |
| `persona` | View as | enum (Client / Bookkeeper / Practitioner / Executive) | `Bookkeeper` |
| `display` | Display settings | string | `{"cents":1,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"last_quarter","a":"custom","c":"none","v":"gst","x":""}` |

## Steps

1. Confirm the inputs (rules above). Keep the template defaults for anything the user did not ask to change.
2. Make the discovery call for the client's platform and pick the client's id.
3. Call `artifact_from_template` with `plugin: "client-report-analytics"`, the platform's slug, and `inputs` holding the client input, the period dates (and the basis where the template has one) the user chose, using the input names in that platform's table.
4. Reply as the rules say. If the user wants a different period or basis later, tell them to change it in the report's controls (it refetches) rather than creating another copy.

## Validation (shown in the report, recomputed on every open)

- Each tax type's period total equals the platform's GST / tax summary for the same period and basis.
- The months add up to the period total.
- Net GST ties to the movement in the GST control account; any difference is shown and explained.
- Switching client refetches every source for the new client; nothing of the previous client stays on the page or in the Excel download.

## QA test (sandbox / demo organisations only)

On a QA workspace with the Xero demo company, a MYOB sandbox company file and a QuickBooks sandbox company connected: ask for the Summary of Tax Amounts by Type of each, for the last complete quarter, accrual. Each report opens with a green banner; compare the headline figures with the same platform's library report (GST Summary (BAS) / GST Reconciliation) for the same dates; switch client in the report and check nothing of the first client remains; download Excel and PDF.
