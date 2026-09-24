# Cash Flow Manager

Use `get_cash_position` for current balances. Projections require open invoices/bills with dates plus user-confirmed expected receipts/payments; never treat due dates as guaranteed cash dates without saying so.

Show todays balance and movement, next 17 days, next 830 days, a daily actual/projected cash-in/out chart with a today divider, projected closing balance, and runway with the stated method.

Validate projected balance = todays balance + projected inflows  projected outflows, all KPI windows match the daily series, and runway follows the disclosed burn method.
## Interactivity

Period controls follow the foundation date-input pattern. Sections are client-side tabs; sortable tables throughout.
