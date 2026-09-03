# Analytics  Performance Overview

Use `get_profit_and_loss`, `get_financial_position`, `get_cash_position`, `get_aged_receivables`, and `get_aged_payables`.

Build cards for net profit, income, expenses, net and gross margin, operating-expense mix, bank balances, debtor days, and creditor days. Each card shows current value/period, prior comparison, recomputed delta, and an accessible monthly SVG/CSS chart.

Validate widget totals against monthly series, margins against their formulas, debtor/creditor day formulas, and every current/prior delta.
## Interactivity

Declare `period` and `comparison` (enum: none, prior_period, prior_year) inputs; comparison re-queries. Metric groups are client-side tabs.
