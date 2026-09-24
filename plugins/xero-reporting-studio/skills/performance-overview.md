# Analytics — Performance Overview

Use `get_profit_and_loss` and `get_balance_sheet`, each with `periods`/`timeframe: MONTH` for the trailing monthly trend in a single call. No other tools are needed: bank balances and Accounts Receivable/Accounts Payable totals come from `get_balance_sheet`; there is no separate "cash position" or all-contacts ageing tool, and none is required here since only AR/AP totals (not ageing buckets) are needed.

Build cards for net profit, income, expenses, net and gross margin, operating-expense mix, bank balances, debtor days, and creditor days. Debtor days = (Accounts Receivable ÷ total sales for the period) × days in period; creditor days = (Accounts Payable ÷ total purchases/COGS for the period) × days in period — state explicitly that these use total sales/purchases as a proxy for credit sales/purchases, since Xero's P&L doesn't separate the two. Show N/A for either figure whenever its denominator (that period's sales, or purchases/COGS) is zero or negative — a credit note or reversal can make a period's income delta negative, and a days-to-pay metric must never render as a negative number.

Each card shows current value/period, prior comparison, recomputed delta, and an accessible monthly SVG/CSS chart.

Validate widget totals against monthly series, margins against their formulas, debtor/creditor day formulas, and every current/prior delta.