# Cash Summary

Use `get_bank_summary` (per bank account, per month for multi-month requests) for opening balance, Cash Received, Cash Spent, and closing balance. There is no single "cash position" tool, and no Xero report exposes cash movement broken down by category — `get_bank_summary` gives account-level totals only.

Present total Cash Received and Cash Spent, Net Cash Flow, opening and closing balance. For multi-month requests use monthly columns plus a total. Do not attempt category-level (Operating/Investing/Financing/Equity) breakdown or invent categorization — state plainly that this would require classifying `list_journals` by account type, which this skill does not currently do.

Validate net cash movement = cash received − cash spent and closing balance = opening balance + net movement.