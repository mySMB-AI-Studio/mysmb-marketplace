# Cash Summary

Use `get_cash_position` and `get_profit_and_loss`; request a Xero Bank Summary export if opening, closing, or category movements are not exposed.

Present Cash Received and Cash Spent by category, Net Cash Flows, and optional investing/financing/equity sections. For multi-month requests use monthly columns plus a total.

Validate net cash movement = cash received - cash spent and closing balance = opening balance + net movement whenever balances are available. Flag that the workbook's exact Xero column layout was not live-verified.
## Interactivity

Declare date/period inputs matching the tool's real parameters (months window via the tool's own periods parameter when available), preset picker client-side. Month columns sort client-side.
