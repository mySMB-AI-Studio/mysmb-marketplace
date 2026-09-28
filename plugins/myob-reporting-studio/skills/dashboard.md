---
name: MYOB Dashboard
description: Generate a MYOB Dashboard — a one-page snapshot combining P&L, cash position, and receivables/payables at a glance.
---

# Dashboard

This report combines multiple already-built data sources into one overview — declare a separate binding per source, exactly as the foundation skill's mapping law requires (one binding, one tool call, one declared purpose):

* `get_profit_and_loss` (current month and/or YTD) — revenue, expenses, net profit
* `get_balance_sheet` (as at today) — total assets/liabilities/equity, and the balance-check status (don't hide a FAIL here — if the underlying Balance Sheet doesn't tie out, the dashboard must say so, not silently show a number)
* `get_aged_receivables` / `get_aged_payables` (as at today) — total outstanding each way, and how much sits in 61+ day buckets specifically, since that's the figure that actually needs attention
* `list_invoices` (`status=Open`) — count and value of open invoices, as a quick top-line figure distinct from the full aging breakdown

Present as a card-grid overview: Net Profit (current period), Cash/Assets snapshot, Receivables outstanding (with overdue portion called out), Payables outstanding (with overdue portion called out). Each card should be a genuine at-a-glance figure, not a full table — this is a summary, not a replacement for the underlying reports. Link/reference which full report each card summarizes (e.g. "see Aged Receivables for detail") rather than duplicating that report's full table here.

Don't recompute anything already validated elsewhere. Trust each underlying tool's own numbers directly — this skill's job is presentation and aggregation, not re-deriving figures. If one binding errors (e.g. `needs_connection` on a source that isn't actually possible here since they all share one connector, but handle it generically anyway), show that specific card as unavailable rather than failing the whole dashboard.

Validate:
* Each card's figure matches what its underlying tool actually returned (a straightforward pass-through check, not a new calculation) — this catches a rendering bug, not a data bug.

Disclose in Sources & limitations that this is a summary view built from the other report tools, and that anyone wanting full detail should open the corresponding individual report.

## Interactivity

* No date-range picker needed beyond each card's own natural default (current period for P&L, as-at-today for balance/aging) — keep this simple and current-state-focused, since that's what a dashboard is for. 
* A **Refresh** button re-pulls all bindings at once.
