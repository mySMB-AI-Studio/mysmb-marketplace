---
name: practice-report-analytics-purchases-summary
description: PRA-03 Purchases Summary Metrics across every client. Use when the user asks for purchases summary metrics for the practice, for all clients, or to compare clients on this metric.
---

# PRA-03 Purchases Summary Metrics

Use when the user asks for the Purchases Summary Metrics (PRA-03) across the practice: Outstanding and overdue bills, payment days (DPO) and supplier counts, per client.

## Rules for every practice report

- **Confirm the period/as-at and client scope first (never assume):** offer "all clients" as the default; ask only if the user wants to narrow to specific clients, and if so resolve their ids first (Xero `list_connections`, MYOB `list_company_files`) rather than guessing names.
- **Create the report with `artifact_from_template`**: `plugin` = `practice-report-analytics`, `slug` from the table below, `title` = "<Report name> — Practice — <period>", and `inputs` = only the declared inputs the request changes (exact names from the table; dates as `YYYY-MM-DD`). You write no HTML and no figures: the report fetches live data every time it opens and recomputes its checks.
- **If `artifact_from_template` is not available or returns template_not_found**, say the Practice Report Analytics extension is not installed or not up to date in this workspace; do not hand-write a report instead.
- **QuickBooks is excluded from every practice-wide report** (one company per connection — there is nothing to consolidate). Its one connected company has its own report in the Client Report Analytics agent; say so if asked.
- **Reply** with the report button the tool returns, one line on what it shows, and: "The banner at the top shows the validation checks; a red line means a figure did not tie and should not be relied on." Never quote figures you did not read from a tool result.
- **Errors:** `needs_connection` → "Connect <platform> (Settings → Connections)". A tool error → show it word for word; do not retry more than once.

## Template

| Template slug | Tool (per platform) |
|---|---|
| `practice-purchases-summary` | `get_practice_purchases_summary` on `xero-accounting` and `myob-accounting` |

| Input | Label | Type | Default |
|---|---|---|---|
| `from_date` | From | date | `2026-07-01` |
| `to_date` | To | date | `today` |

## Steps

1. Confirm the period (and client scope, if the user wants to narrow it) per the rules above.
2. Call `artifact_from_template` with `plugin: "practice-report-analytics"`, `slug: "practice-purchases-summary"`, and `inputs` holding whatever the user changed from the defaults.
3. Reply as the rules say.

## Validation (shown in the report, recomputed on every open)

- Every client row comes from `get_practice_purchases_summary`; a client that failed to load is named in a notice, not silently dropped from the totals.
- The totals row sums only the clients that loaded; switching the view or sorting never changes a row's source platform or client id (no cross-client leakage).
- Figures follow the same model as the matching Client Report Analytics report, per client — not a separate calculation.

## QA test (sandbox / demo organisations only)

On a QA workspace with the Xero demo company and a MYOB sandbox company file connected: ask for the Purchases Summary Metrics for the practice. The report opens with a green banner (or a named notice for whichever platform isn't connected); every client the connections expose appears as one row; the totals row matches summing the rows by hand.
