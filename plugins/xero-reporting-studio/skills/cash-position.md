# Analytics — Cash Position

Use `get_bank_summary` (called once per month across the trend window — no single call covers a multi-month trend, since this report has no `periods`/`timeframe` param) plus `list_accounts` (where `Type=="BANK"`) for current balance, `get_balance_sheet` for the point-in-time financial position, and `list_invoices` (`Type=="ACCREC"`/`Type=="ACCPAY"`, `AUTHORISED`, aggregated by `DueDate`) for receivables/payables ageing composition — same method as the standalone Aged Receivables/Aged Payables summary skills. There is no single "cash position" tool.

Show cash balance and monthly trend, cash in versus cash out, net cash flow, receivables ageing composition, and payables ageing composition. Use accessible donut/bar alternatives and clearly label connector gaps.

Validate cash balance equals the sum of bank accounts, ageing segments equal their totals, and cash in/out reconciles to the `get_bank_summary` figures for each month. Flag that the source workbook's live widget set was only partially captured.