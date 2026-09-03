# Cash Summary

Use `get_cash_position` and `get_profit_and_loss`; request a Xero Bank Summary export if opening, closing, or category movements are not exposed.

Present Cash Received and Cash Spent by category, Net Cash Flows, and optional investing/financing/equity sections. For multi-month requests use monthly columns plus a total.

Validate net cash movement = cash received - cash spent and closing balance = opening balance + net movement whenever balances are available. Flag that the workbook's exact Xero column layout was not live-verified.
## Interactivity

Declare a `period` enum input controlling the months window. Month columns sort client-side.
