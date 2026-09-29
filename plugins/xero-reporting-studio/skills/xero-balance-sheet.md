---
name: xero-balance-sheet
description: Build a live Xero Balance Sheet (statement of financial position) as at a date, with optional comparison columns. Use for "balance sheet", "financial position", "net assets", "assets and liabilities".
---
# Balance Sheet

Use `get_balance_sheet` (`date`; optional `periods` / `timeframe` for comparison columns in one call).

Present bank accounts, current and non-current assets, total assets, current and non-current liabilities, total liabilities, and equity, parsed from the report's sections as the foundation describes. Add a comparison date only when requested. Distinguish foreign-currency accounts and state conversion basis when available.

Validate Total Assets = Total Liabilities + Equity, Total Bank equals bank-account rows, and each section total equals its rows.
## Interactivity

Declare `as_at_date` (date, default "today") mapped 1:1 to the tool's `date` parameter. Comparison columns only through parameters the tool actually exposes — `periods` (number input) and `timeframe` (enum `MONTH` | `QUARTER` | `YEAR`) — each as its own declared input with a client-side preset picker. Optional `cash_basis` (boolean) mapped to `paymentsOnly`. Plus `organisation` per the foundation. Sections collapse/expand client-side.
