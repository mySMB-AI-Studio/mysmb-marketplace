---
name: xero-cash-summary
description: Build a live Xero cash summary — opening balance, cash received, cash spent and closing balance per bank account, by month. Use for "cash summary", "cash received and spent", "cash movement", "bank summary".
---
# Cash Summary

Use `get_bank_summary` (per bank account: Opening balance, Cash received, Cash spent, Closing balance) — one call per month for multi-month requests, per the foundation's fan-out rule. Xero's own Cash Summary report has no endpoint, so do not ask for an export; build it from `get_bank_summary`. Income and expense categories may be added from `get_profit_and_loss` with `paymentsOnly: true`, labelled as a cash-basis P&L — it excludes balance-sheet movements (GST, loans, transfers, asset purchases), so show the gap as a derived "Other (balance-sheet) movements" line = net cash movement − cash-basis net profit, never as an invented category split.

Present Cash Received and Cash Spent (by category where the cash-basis P&L supplies it), Net Cash Flows, and opening and closing balance. Investing/financing/equity sections are N/A — not in source. For multi-month requests use monthly columns plus a total.

Validate net cash movement = cash received − cash spent and closing balance = opening balance + net movement for every account and month. Flag that the workbook’s exact Xero column layout was not live-verified.
## Interactivity

Declare `from_date` / `to_date` (date) mapped to `fromDate` / `toDate` on both bindings; the months window is computed client-side and `get_bank_summary` is fetched per month. The category binding sends a static `paymentsOnly: true` (a JSON boolean). Plus `organisation` per the foundation; preset picker client-side. Month columns sort client-side.
