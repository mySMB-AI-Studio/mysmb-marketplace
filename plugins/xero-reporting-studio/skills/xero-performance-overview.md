---
name: xero-performance-overview
description: Build a live Xero performance overview — net profit, income, expenses, margins, expense mix, bank balances, debtor and creditor days with monthly trends. Use for "performance overview", "business performance", "KPIs", "margins", "debtor days".
---
# Analytics — Performance Overview

Use `get_profit_and_loss` and `get_balance_sheet`, each with `periods` / `timeframe: MONTH` for the trailing monthly trend in one call; bank balances and Accounts Receivable / Accounts Payable totals come from `get_balance_sheet`. Use `get_executive_summary` (`date`) for Xero's own debtor and creditor days for the month, shown beside the recomputed formula. No ageing buckets are needed here; Xero Analytics widgets have no endpoint.

Build cards for net profit, income, expenses, net and gross margin, operating-expense mix, bank balances, debtor days, and creditor days. Debtor days = Accounts Receivable ÷ sales for the period × days in period; creditor days = Accounts Payable ÷ purchases (cost of sales, or the disclosed purchases measure) for the period × days in period — state that total sales/purchases stand in for credit sales/purchases. Show N/A when a denominator is zero or negative; a days figure is never negative. Each card shows current value/period, prior comparison, recomputed delta, and an accessible monthly SVG/CSS chart.

Validate widget totals against monthly series, margins against their formulas, debtor/creditor day formulas (and against `get_executive_summary`, informational), and every current/prior delta.
## Interactivity

Period and comparison controls follow the foundation date-input pattern (`from_date` / `to_date` → P&L `fromDate` / `toDate`, `as_at_date` → balance-sheet and executive-summary `date`, `periods` as a number input, `timeframe` static `MONTH`), mapped only onto parameters the tool exposes, plus `organisation` per the foundation. Metric groups are client-side tabs.
