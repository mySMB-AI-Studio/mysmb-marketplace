# Visualise

Ask which mode: Profitability, Cash, Accounts, External data, KPIs, or Industry benchmarks.

- Profitability: `get_profit_and_loss` with periods/timeframe for trend.
- Cash: `get_bank_summary` (per period) and `list_accounts` (`Type=="BANK"`) for balances. There is no single "cash position" tool.
- Accounts: `get_balance_sheet` for the point-in-time position, plus `list_invoices` (ACCREC/ACCPAY, AUTHORISED, aggregated by `DueDate`) for receivables/payables composition by customer/supplier — same method as the standalone Aged Receivables/Aged Payables summary skills.
- KPIs: `get_profit_and_loss` and `get_balance_sheet` for margin and debtor/creditor-day ratios — no aged data needed, since these use AR/AP totals already in the Balance Sheet. Debtor days = (Accounts Receivable ÷ total sales for the period) × days in period; creditor days = (Accounts Payable ÷ total purchases/COGS for the period) × days in period, using total sales/purchases as a proxy for credit sales/purchases since Xero's P&L doesn't separate the two. Show N/A for either figure whenever its denominator (that period's sales, or purchases/COGS) is zero or negative — a credit note or reversal can make a period's income delta negative, and a days-to-pay metric must never render as a negative number.
- External data / Industry benchmarks: no tool call. Metrics and benchmarks must be supplied by the user with a cited source — never invented or estimated.

Provide responsive inline charts, period controls, series toggles, legends, tooltips, and grounded insight prompts.

Validate every plotted series from source data, disclose benchmark provenance, and show formulas for KPI ratios.