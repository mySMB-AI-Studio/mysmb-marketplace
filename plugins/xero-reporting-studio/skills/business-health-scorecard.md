# Business Health Scorecard

Use `get_profit_and_loss` and `get_balance_sheet` directly. For receivables and payables ageing, aggregate from `list_invoices` (Type=="ACCREC" and Type=="ACCPAY" respectively, AUTHORISED status) the same way the standalone Aged Receivables/Aged Payables summary skills do — there is no single-call all-contacts ageing tool in Xero's API, and this scorecard must compute its own figures rather than assume another skill's output is available.

Targets must come from the user; if absent, offer clearly labeled directional comparisons rather than inventing benchmarks.

Score at minimum: net profit, net margin, gross margin, revenue growth, debtor days, creditor days, and current ratio. Debtor days = (Accounts Receivable ÷ total sales for the period) × days in period; creditor days = (Accounts Payable ÷ total purchases/COGS for the period) × days in period, using total sales/purchases as a proxy for credit sales/purchases since Xero's P&L doesn't separate the two. Show N/A for either figure whenever its denominator (that period's sales, or purchases/COGS) is zero or negative — a credit note or reversal can make a period's income delta negative, and a days-to-pay metric must never render as a negative number.

Show overall score and achieved-target count, pinned KPI cards, insight commentary grounded in computed data, and a grouped table containing metric, formula, actual, target, status, change, and importance.

Validate score = achieved targets / applicable targets, recompute every status from actual versus target direction, and display each ratio formula.