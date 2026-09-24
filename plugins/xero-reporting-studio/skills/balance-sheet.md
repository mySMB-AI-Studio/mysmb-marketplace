# Balance Sheet

Use `get_balance_sheet`.

Present bank accounts, current and non-current assets, total assets, current and non-current liabilities, total liabilities, and equity. Add a comparison date only when requested (`periods`/`timeframe` params). Distinguish foreign-currency accounts and state conversion basis when available.

Validate Total Assets = Total Liabilities + Equity, Total Bank equals bank-account rows, and each section total equals its rows.

One thing worth confirming as we go: your memory note also flagged `get_organisation_info`, `get_organisation_financial_year`, `get_top_customers_by_revenue`, and `get_cash_position` as other invented names across the 16 skills — none of those showed up in the four we've fixed so far (foundation, BAS, aged payables, aged receivables, balance sheet). Keep pasting them in whatever order you have them; I'll flag each as we hit it rather than trying to guess which skill still has those.