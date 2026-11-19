---
name: client-report-analytics-financial-overview
description: CRA-01 Financial Overview for one client (Xero, MYOB or QuickBooks) as a live, validated report. Use when the user asks for the financial overview of a client, a client dashboard, revenue / profit / bank / ageing overview. The client is a connected Xero organisation, MYOB company file or QuickBooks company, named in full or in part (for example "Irvine Jackson" for Irvine Jackson Pty Ltd); it is never a contact.
---

# CRA-01 Financial Overview

Use when the user asks for the Financial Overview (CRA-01) of one client: revenue, gross and net profit with margins against last year, bank balances and receivables / payables ageing, cash or accrual.

## Rules for every client report

- **Confirm the client first (never assume):** one client per report, from the user's own connections; ask if it isn't clear.
- **Period: use the default unless the user gives one.** If the user names no dates or period, don't ask: create the report with the template's default period (don't set `display` or the dates) and say in your reply which period it shows ("this financial year to date", or "the last complete quarter" for the tax and BAS reports) and that they can change it in the report's Report period control or ask you for other dates. Cash or accrual and the persona also keep their defaults unless the user asks.
- **Find the client's platform and id** with one discovery call: Xero `list_connections` (xero-accounting), MYOB `list_company_files` (myob-accounting), QuickBooks `qbo_query` with `SELECT * FROM CompanyInfo` (quickbooks-accounting). **The client is a connected organisation or company file, never a contact:** run the discovery calls first, even when the user gives only part of the name or no platform, and match the name against the organisation and company file names (case-insensitive, partial: "Irvine Jackson" matches "Irvine Jackson Pty Ltd"). Never search contacts, customers or suppliers to find the client. If more than one connection matches, ask which one. If the user names a client that none of their connections expose, say so and list the ones they can use. Never put another client's id in a report.
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
| Xero | `client-xero-financial-overview` | the organisation id (`tenantId` from `list_connections`) |
| MYOB | `client-myob-financial-overview` | the company file id (`Id` from `list_company_files`) |
| QuickBooks | `client-quickbooks-financial-overview` | none: QuickBooks is the one connected company |

### Xero Financial Overview (`client-xero-financial-overview`)

| Input | Label | Type | Default |
|---|---|---|---|
| `from_date` | From | date | `2026-07-01` |
| `to_date` | To | date | `today` |
| `prior_from` | Last year from | date | `2025-07-01` |
| `prior_to` | Last year to | date | `2025-09-25` |
| `basis` | Accounting method | enum (Accrual / Cash) | `Accrual` |
| `org` | Organisation | string | `` |
| `page` | Page | number | `1` |
| `display` | Display settings | string | `{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":""}` |

### MYOB Financial Overview (`client-myob-financial-overview`)

| Input | Label | Type | Default |
|---|---|---|---|
| `from_date` | From | date | `2026-07-01` |
| `to_date` | To | date | `2026-09-30` |
| `basis` | Accounting method | enum (Accrual / Cash) | `Accrual` |
| `company_file` | Client (MYOB company file) | string | `` |
| `persona` | View as | enum (Client / Bookkeeper / Practitioner / Executive) | `Bookkeeper` |
| `display` | Display settings | string | `{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"this_quarter","a":"custom","c":"none","v":""}` |
| `ly_from` | Last year from | date | `2025-07-01` |
| `ly_to` | Last year to | date | `2025-09-30` |

### QuickBooks Financial Overview (`client-quickbooks-financial-overview`)

| Input | Label | Type | Default |
|---|---|---|---|
| `start_date` | From | date | `2026-08-01` |
| `end_date` | To | date | `2026-08-31` |
| `compare_start` | Same period last year from | date | `2025-08-01` |
| `compare_end` | Same period last year to | date | `2025-08-31` |
| `trend_start` | Trend from | date | `2025-09-01` |
| `basis` | Accounting method | enum (Accrual / Cash) | `Accrual` |
| `persona` | View as | enum (Client / Bookkeeper / Practitioner / Executive) | `Practitioner` |
| `display` | Display settings | string | `{"cents":0,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"last_month","a":"custom","c":"prev_year","v":"","x":""}` |

## Steps

1. Confirm the inputs (rules above). Keep the template defaults for anything the user did not ask to change.
2. Make the discovery call for the client's platform and pick the client's id.
3. Call `artifact_from_template` with `plugin: "client-report-analytics"`, the platform's slug, and `inputs` holding the client input, the period dates and the basis the user chose, using the input names in that platform's table.
4. Reply as the rules say. If the user wants a different period or basis later, tell them to change it in the report's controls (it refetches) rather than creating another copy.

## Validation (shown in the report, recomputed on every open)

- Revenue, gross profit and net profit equal the platform's own Profit and Loss for the same client, period and basis; last year comes from a P&L for exactly the comparison dates.
- Bank balances total the balance sheet's bank accounts at the period end.
- Receivables and payables ageing totals tie to the balance sheet's receivables and payables (accrual).
- Switching client refetches every source for the new client; nothing of the previous client stays on the page or in the Excel download.

## QA test (sandbox / demo organisations only)

On a QA workspace with the Xero demo company, a MYOB sandbox company file and a QuickBooks sandbox company connected: ask for the Financial Overview of each, for the last complete quarter, accrual. Each report opens with a green banner; compare the headline figures with the same platform's library report (Profit and Loss and Balance Sheet) for the same dates; switch client in the report and check nothing of the first client remains; download Excel and PDF.
