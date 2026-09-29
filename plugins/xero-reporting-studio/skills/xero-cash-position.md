---
name: xero-cash-position
description: Build a live Xero cash position analysis — bank balances and monthly trend, cash in versus cash out, and receivables and payables ageing composition. Use for "cash position", "cash analytics", "cash trend", "bank balances".
---
# Analytics — Cash Position

Use `get_bank_summary` for current bank balances and for monthly cash in/out (one call per month across the trend window, per the foundation's fan-out rule — it has no periods param), `get_balance_sheet` with `periods` / `timeframe: MONTH` for the month-end bank balance trend in one call, and `list_invoices` (`where: Type=="ACCREC"` / `Type=="ACCPAY"`, `statuses: AUTHORISED`, bucketed by `DueDate`) for receivables and payables ageing composition — the same method as the Aged Receivables / Aged Payables skills. There is no single "cash position" tool, and Xero Analytics widgets have no endpoint.

Show cash balance and monthly trend, cash in versus cash out, net cash flow, receivables ageing composition, and payables ageing composition. Use accessible donut/bar alternatives and clearly label connector gaps.

Validate cash balance equals the sum of bank accounts, ageing segments equal their totals, and cash in/out reconciles to the `get_bank_summary` figures for each month (Closing = Opening + Cash received − Cash spent per account). Flag that the source workbook’s live widget set was only partially captured.
## Interactivity

Declare `as_at_date` (date, default "today") mapped 1:1 to `get_balance_sheet`'s `date`, and `from_date` / `to_date` (date) mapped to `get_bank_summary`'s `fromDate` / `toDate`; the monthly windows are computed client-side back from the as-at date and fetched with `getData`. Plus `organisation` and `page` per the foundation. Bank-account filter is client-side; recompute displayed totals over the filtered accounts, labelled as filtered.
