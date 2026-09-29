---
name: xero-business-overview
description: Build a live Xero business overview dashboard — bank balances, invoices owed, bills to pay, cash in and out, YTD profit and an account watchlist. Use for "business overview", "dashboard", "how is the business going", "snapshot of the business".
---
# Business Overview

Use `get_organisation` (name, base currency, financial year end), `get_bank_summary` (bank balances and cash in/out), `list_invoices` with `where: Type=="ACCREC"` for invoices owed and `where: Type=="ACCPAY"` for bills to pay (both `statuses: AUTHORISED`, aggregated client-side the same way as the Aged Receivables / Aged Payables skills), `list_payments` (`where: PaymentType=="ACCRECPAYMENT"`, `order: Date DESC`) for recent invoice payments, and `get_profit_and_loss` for YTD income, expenses and net profit. There is no single "cash position" or all-contacts ageing tool.

Create a responsive two-column dashboard with bank account cards (Closing balance per account from `get_bank_summary`); invoices owed with count, overdue amount and ageing bars; bills to pay with the same structure; actionable tasks (derived from the overdue invoices and bills already loaded, not a separate data source); recent invoice payments; six-month cash in/out and difference (`get_bank_summary` called once per month, per the foundation's fan-out rule); YTD net profit with income and expenses (YTD start from the organisation's financial year end); and an account watchlist (accounts the user names, values from the `get_profit_and_loss` account rows). Bank-feed statement balances have no endpoint — label them N/A — not in source.

Validate receivables and payables totals against ageing buckets, cash difference = cash in − cash out, and net profit = income − expenses.
## Interactivity

Declare `organisation` per the foundation, `page` (number) for the invoice/bill/payment lists, plus date inputs matching each tool's real date parameters (`from_date` / `to_date` → `fromDate` / `toDate`), driven by one client-side preset picker. Section switching is client-side tabs.
