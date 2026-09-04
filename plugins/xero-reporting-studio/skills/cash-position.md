# Analytics  Cash Position

Use `get_cash_position`, `get_financial_position`, `get_aged_receivables`, and `get_aged_payables`.

Show cash balance and monthly trend, cash in versus cash out, net cash flow, receivables ageing composition, and payables ageing composition. Use accessible donut/bar alternatives and clearly label connector gaps.

Validate cash balance equals bank accounts, ageing segments equal their totals, and cash in/out reconciles to available bank-summary data. Flag that the source workbooks live widget set was only partially captured.
## Interactivity

Declare `as_at_date` (date, default "today") mapped 1:1 to the tool's date parameter. Bank-account filter is client-side; recompute displayed totals over the filtered accounts, labelled as filtered.
