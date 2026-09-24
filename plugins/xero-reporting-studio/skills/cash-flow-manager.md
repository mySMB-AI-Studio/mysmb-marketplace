# Cash Flow Manager

Use `get_bank_summary` scoped to today (`fromDate=toDate=today`) for today's balance and movement, and `list_accounts` (where `Type=="BANK"`) to label accounts. There is no single "cash position" tool.

Projections require open invoices/bills — `list_invoices` with `Type=="ACCREC"` or `Type=="ACCPAY"`, `AUTHORISED` status, with `DueDate` and `AmountDue` — plus user-confirmed expected receipts/payments. Never treat due dates as guaranteed cash dates without saying so.

Show today's balance and movement, next 1–7 days, next 8–30 days, a daily actual/projected cash-in/out chart with a today divider, projected closing balance, and runway with the stated method.

Validate projected balance = today's balance + projected inflows − projected outflows, all KPI windows match the daily series, and runway follows the disclosed burn method.