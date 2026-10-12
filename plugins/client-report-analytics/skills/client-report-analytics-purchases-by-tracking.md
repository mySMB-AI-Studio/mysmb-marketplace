---
name: client-report-analytics-purchases-by-tracking
description: CRA-04 Purchases by Tracking Category for one client (Xero, MYOB or QuickBooks) as a live, validated report. Use when the user asks for the purchases by tracking category of a client, purchases or spend by tracking category, class, job or department.
---

# CRA-04 Purchases by Tracking Category

Use when the user asks for the Purchases by Tracking Category (CRA-04) of one client: purchases and spend split by one tracking category / class / job at a time, with each option's share of the total, tied to the platform's own purchases figure.

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
| Xero | `client-xero-purchases-by-tracking` | the organisation id (`tenantId` from `list_connections`) |
| MYOB | `client-myob-purchases-by-tracking` | the company file id (`Id` from `list_company_files`) |
| QuickBooks | `client-quickbooks-purchases-by-tracking` | none: QuickBooks is the one connected company |

### Xero Purchases by Tracking Category (`client-xero-purchases-by-tracking`)

| Input | Label | Type | Default |
|---|---|---|---|
| `from_date` | From | date | `2026-07-01` |
| `to_date` | To | date | `today` |
| `basis` | Accounting method | enum (Accrual / Cash) | `Accrual` |
| `tracking` | Tracking category | string | `` |
| `org` | Organisation | string | `` |
| `display` | Display settings | string | `{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,…` |

### MYOB Purchases by Tracking Category (`client-myob-purchases-by-tracking`)

| Input | Label | Type | Default |
|---|---|---|---|
| `from_date` | From | date | `2026-07-01` |
| `to_date` | To | date | `2026-09-30` |
| `company_file` | Client (MYOB company file) | string | `` |
| `persona` | View as | enum (Client / Bookkeeper / Practitioner / Executive) | `Bookkeeper` |
| `display` | Display settings | string | `{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,…` |

### QuickBooks Purchases by Tracking Category (`client-quickbooks-purchases-by-tracking`)

| Input | Label | Type | Default |
|---|---|---|---|
| `start_date` | From | date | `2026-08-01` |
| `end_date` | To | date | `2026-08-31` |
| `persona` | View as | enum (Client / Bookkeeper / Practitioner / Executive) | `Practitioner` |
| `display` | Display settings | string | `{"cents":0,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,…` |

## Steps

1. Confirm the inputs (rules above). Keep the template defaults for anything the user did not ask to change.
2. Make the discovery call for the client's platform and pick the client's id.
3. Call `artifact_from_template` with `plugin: "client-report-analytics"`, the platform's slug, and `inputs` holding the client input, the period dates and the basis the user chose, using the input names in that platform's table.
4. Reply as the rules say. If the user wants a different period or basis later, tell them to change it in the report's controls (it refetches) rather than creating another copy.

## Validation (shown in the report, recomputed on every open)

- Options (or jobs / classes), including an Unassigned / No job / Unclassified bucket, add up to the total.
- The total ties to the same platform's own Profit and Loss for the same period, without a tracking split (a separate call).
- One tracking category / dimension at a time, to avoid double counting.
- Switching client refetches every source for the new client; nothing of the previous client stays on the page or in the Excel download.

## QA test (sandbox / demo organisations only)

On a QA workspace with the Xero demo company, a MYOB sandbox company file and a QuickBooks sandbox company connected: ask for the Purchases by Tracking Category of each, for the last complete quarter, accrual. Each report opens with a green banner; compare the headline figures with the same platform's library report (Profit and Loss by tracking category / job / class) for the same dates; switch client in the report and check nothing of the first client remains; download Excel and PDF.
