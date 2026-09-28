---
name: MYOB Dashboard
description: Generate a MYOB Dashboard — a one-page snapshot combining P&L, cash position, and receivables/payables at a glance.
---

# Dashboard

This report combines multiple data sources into one overview — declare a separate binding per source, exactly as the foundation skill's mapping law requires (one binding, one tool call, one declared purpose):

* `get_profit_and_loss_3m` (`from_date`/`to_date` — month to date by default, FY to date on the toggle) plus `list_accounts` — revenue, expenses, net profit. The P&L tool returns no totals: sum `AccountsBreakdown` per `Classification` via `list_accounts`, exactly as `myob-reporting-studio:profit-and-loss` does. `get_profit_and_loss_3m` is used because an FY-to-date or custom range can cross 1 July.
* `get_balance_sheet` (`date` = today via `{"kind":"context","source":"now.date"}`) — total assets/liabilities/equity, and the balance-check status (don't hide a FAIL here — if the Balance Sheet doesn't tie out, the dashboard must say so, not silently show a number)
* `list_accounts` rows with `Type` `Bank` (and `CreditCard`) — cash snapshot from `CurrentBalance` (today), excluding `IsHeader` accounts
* `get_aged_receivables` / `get_aged_payables` (as at today) — total outstanding each way, and how much sits in 61+ day buckets specifically, since that's the figure that actually needs attention
* `list_invoices` (`status=Open`, `page_index: 0`) — count and value (`BalanceDueAmount`) of open invoices, as a quick top-line figure distinct from the full aging breakdown

Present as a card-grid overview: Net Profit (current period), Cash/Assets snapshot, Receivables outstanding (with overdue portion called out), Payables outstanding (with overdue portion called out). Each card should be a genuine at-a-glance figure, not a full table — this is a summary, not a replacement for the underlying reports. Reference which full report each card summarizes (`myob-reporting-studio:profit-and-loss`, `myob-reporting-studio:balance-sheet`, `myob-reporting-studio:aged-receivables`, `myob-reporting-studio:aged-payables`, `myob-reporting-studio:unpaid-invoices`) rather than duplicating that report's full table here.

Don't re-derive what a tool already totals: use the aged tools' `grand_total`/`bucket_totals` directly. The P&L is the exception — its tool returns no totals, so sum it per classification as `myob-reporting-studio:profit-and-loss` does — and the Balance Sheet totals and equation are built the way `myob-reporting-studio:balance-sheet` builds them. If one binding errors (see the foundation's error contract, including `data[id].__error`), show that specific card as unavailable rather than failing the whole dashboard, and never show $0 in its place.

Validate (0.01 tolerance):
* Each card's figure matches what its underlying tool actually returned, or the classification sum built from it — this catches a rendering bug, not a data bug. A card whose source failed is N/A, not Pass.
* Balance sheet: Total Assets = Total Liabilities + Total Equity.

Disclose in Sources & limitations that this is a summary view built from the other report tools, that ageing uses today's open items, and that anyone wanting full detail should open the corresponding individual report.

## Interactivity

* Declare `from_date`/`to_date` date inputs mapped to the P&L binding. Their defaults can only be fixed or today, so on load compute month to date client-side (1st of this month → today) and re-query with `MyHubReport.getData`; a Month to date / FY to date toggle (FY starts 1 July) recomputes both and re-queries. Keep everything else current-state (as at today).
* Declare `basis` (enum `Accrual` / `Cash`) for the P&L and Balance Sheet bindings, and `persona` and `company_file` per the foundation skill.
* A **Refresh** button re-pulls all bindings at once.
