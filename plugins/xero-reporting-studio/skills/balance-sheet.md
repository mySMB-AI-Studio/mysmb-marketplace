# Balance Sheet

Use `get_financial_position`.

Present bank accounts, current and non-current assets, total assets, current and non-current liabilities, total liabilities, and equity. Add a comparison date only when requested. Distinguish foreign-currency accounts and state conversion basis when available.

Validate Total Assets = Total Liabilities + Equity, Total Bank equals bank-account rows, and each section total equals its rows.
## Interactivity

Declare `as_at_date` (date, default "today") and `comparison` (enum: none, prior_period, prior_year) inputs; comparison re-queries with the offset date. Sections collapse/expand client-side.
