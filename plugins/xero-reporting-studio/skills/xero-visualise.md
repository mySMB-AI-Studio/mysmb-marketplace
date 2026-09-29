---
name: xero-visualise
description: Build live Xero charts for profitability, cash, accounts and KPIs, with period controls, series toggles and tooltips. Use for "visualise", "chart", "graph my Xero data", "trend", "show me a chart of".
---
# Visualise

Use the relevant combination of `get_profit_and_loss`, `get_bank_summary`, `get_balance_sheet`, `get_executive_summary`, and `list_invoices`.

Ask which mode: Profitability, Cash, Accounts, External data, KPIs, or Industry benchmarks.

- Profitability: `get_profit_and_loss` with `periods` / `timeframe` for the trend.
- Cash: `get_bank_summary` (one call per period, per the foundation's fan-out rule) for cash in/out and closing balances; `get_balance_sheet` with `periods` / `timeframe` for the month-end bank trend. There is no single "cash position" tool.
- Accounts: `get_balance_sheet` for the point-in-time position, plus `list_invoices` (`where: Type=="ACCREC"` / `Type=="ACCPAY"`, `statuses: AUTHORISED`, bucketed by `DueDate`) for receivables/payables composition — the same method as the Aged Receivables / Aged Payables skills.
- KPIs: `get_profit_and_loss` and `get_balance_sheet` for margins and ratios; `get_executive_summary` for Xero's debtor and creditor days. Show N/A when a ratio's denominator is zero or negative.
- External data / Industry benchmarks: no tool call — N/A — not in source unless the user supplies them with a cited source; never invented or estimated.

Provide responsive inline charts, period controls, series toggles, legends, tooltips, and grounded insight prompts.

Validate every plotted series from source data, disclose benchmark provenance, and show formulas for KPI ratios.
## Interactivity

Period controls follow the foundation date-input pattern, mapped only onto the chosen mode's tool parameters, plus `organisation` (and `page` when `list_invoices` is used) per the foundation. Series toggles and mode tabs are client-side.
