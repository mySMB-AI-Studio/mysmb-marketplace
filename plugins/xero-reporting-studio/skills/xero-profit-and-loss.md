---
name: xero-profit-and-loss
description: Build a live Xero Profit and Loss (income statement) with period presets, accrual/cash basis and comparison columns. Use for "profit and loss", "P&L", "income statement", "net profit", "how much did we make".
---
# Profit and Loss

Use `get_profit_and_loss`. For financial-year boundaries and YTD presets, use `get_organisation` (`FinancialYearEndMonth` / `FinancialYearEndDay`) — there is no separate financial-year tool.

Present Trading Income, Cost of Sales, Gross Profit, Other Income, Operating Expenses, and Net Profit in that order, parsed from the report's sections as the foundation describes. Support user-requested previous-period or prior-year comparison columns and variance amounts/percentages: adjacent periods come from the tool's own `periods` / `timeframe` params in one call; a prior-year comparison of a custom range is a second binding with `fromDate` / `toDate` shifted back a year. Preserve account detail and bold subtotal/total rows.

Validate Gross Profit = Trading Income − Cost of Sales, Net Profit = Gross Profit + Other Income − Operating Expenses, and every section total equals its account rows.
## Interactivity

Declare `from_date` and `to_date` (date) inputs mapped 1:1 to the tool's `fromDate` / `toDate`, driven by a client-side preset picker (this month, last month, this quarter, YTD, last financial year → the picker computes the two dates from the organisation's financial year end and calls getData with the declared names). Declare `cash_basis` (boolean, default false) mapped to `paymentsOnly`. Comparison controls only through parameters the tool exposes — `periods` (number input) and `timeframe` (enum `MONTH` | `QUARTER` | `YEAR`) — each as its own declared input. Plus `organisation` per the foundation. Account sections expand/collapse client-side.
