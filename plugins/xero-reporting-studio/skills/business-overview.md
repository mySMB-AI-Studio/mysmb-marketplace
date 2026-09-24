# Business Overview

Use `get_organisation`, `get_bank_summary`, `list_accounts` (where Type=="BANK"), `list_invoices` (aggregated for receivables/payables ageing, same method as the Aged Receivables/Aged Payables summary skills), `list_payments`, and `get_profit_and_loss`. There is no single "cash position" tool — `get_bank_summary` covers cash in/out/closing balance; account balances come from `list_accounts`.

Create a responsive two-column dashboard with bank account cards; invoices owed with count, overdue amount and ageing bars; bills to pay with the same structure; actionable tasks (derived from overdue invoices/bills already gathered, not a separate data source); recent invoice payments; six-month cash in/out and difference from `get_bank_summary`; YTD net profit with income and expenses from `get_profit_and_loss`; and an account watchlist. Clearly label bank-feed statement balances as unavailable when `get_bank_summary` doesn't expose them for an account (bank-feed reconciliation is a separate, often unconnected Xero feature).

Validate receivables and payables totals against ageing buckets, cash difference = cash in − cash out, and net profit = income − expenses.