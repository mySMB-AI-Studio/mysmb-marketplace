---
name: xero-cash-flow-manager
description: Build a live Xero short-term cash flow view — today's bank balance, projected receipts and payments over the next 30 days, and runway. Use for "cash flow", "cash forecast", "cash projection", "runway", "will we have enough cash".
---
# Cash Flow Manager

Use `get_bank_summary` for current balances (one binding with `fromDate` = `toDate` = the `now.date` context gives today's Closing balance, Cash received and Cash spent per bank account; a second binding over a trailing range gives the burn history). Projections require open invoices and bills — `list_invoices` with `where: Type=="ACCREC"` / `Type=="ACCPAY"`, `statuses: AUTHORISED`, `order: DueDate ASC`, using `DueDate` and `AmountDue` — plus user-confirmed expected receipts/payments; never treat due dates as guaranteed cash dates without saying so. Actual daily cash in/out for the chart comes from `list_bank_transactions` (`order: Date DESC`, filtered to the window client-side). There is no cash-flow statement or forecast endpoint.

Show today’s balance and movement, next 1–7 days, next 8–30 days, a daily actual/projected cash-in/out chart with a today divider, projected closing balance, and runway with the stated method.

Validate projected balance = today’s balance + projected inflows − projected outflows, all KPI windows match the daily series, and runway follows the disclosed burn method.
## Interactivity

Period controls follow the foundation date-input pattern (`from_date` / `to_date` → `get_bank_summary`'s `fromDate` / `toDate`), plus `organisation` and `page` per the foundation. Sections are client-side tabs; sortable tables throughout.
