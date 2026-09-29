---
name: xero-business-health-scorecard
description: Build a live Xero business health scorecard that scores profitability, liquidity and working-capital KPIs against user-supplied targets. Use for "business health", "health check", "scorecard", "KPI targets", "how healthy is the business".
---
# Business Health Scorecard

Xero's own Business Health Scorecard has no endpoint; build the scorecard from source data. Use `get_profit_and_loss` and `get_balance_sheet` (margins, growth, current ratio, AR/AP totals), `get_executive_summary` for Xero's debtor and creditor days, and `list_invoices` (`where: Type=="ACCREC"` / `Type=="ACCPAY"`, `statuses: AUTHORISED`) aggregated client-side for overdue receivables and payables — the same method as the Aged Receivables / Aged Payables skills. Targets must come from the user; if absent, offer clearly labeled directional comparisons rather than inventing benchmarks. Industry benchmarks are N/A — not in source.

Show overall score and achieved-target count, pinned KPI cards, insight commentary grounded in computed data, and a grouped table containing metric, formula, actual, target, status, change, and importance. Show N/A for any ratio whose denominator is zero or negative.

Validate score = achieved targets / applicable targets, recompute every status from actual versus target direction, and display each ratio formula.
## Interactivity

Period controls follow the foundation date-input pattern (client-side preset picker filling declared date inputs), plus `organisation` and `page` per the foundation. Metric drill-downs are client-side tabs — no extra bindings.
