# Receivables Reconciliation Exceptions

Prompt ID M34 · Reporting › Reports › Sales › Receivables reconciliation exceptions. MYOB's description: "Compares the total balance of your customers' outstanding invoices to the current balance of the linked receivables category." This reuses Receivables Reconciliation (with Tax)'s logic verbatim — same two tool calls, same tie-out math — but renders **only** the summary comparison: no per-invoice list, no tax-code breakdown.

Use `list_invoices` (`status: "Open"`, `page_size: 1000`), sum `TotalAmount` for the subledger total. Use `get_balance_sheet` (as at the selected date, matching basis), match `AccountsBreakdown` by name pattern `/debtor|receivable/i` against `Account.Name`, sum matched `AccountTotal` for the control-account total. Compute `diff` and `tie` the same way. Render as a two-card comparison plus a Pass/Fail badge — nothing else.

Carry over unchanged: the point-in-time-limitation banner (invoices reflect *right now*, not the selected date), the "do not infer a cause on mismatch" rule, and the "control account not identified" fallback when no AR account matches.

## Interactivity

* Declare `date` (as-at, mapped to `get_balance_sheet`) and `basis` (accrual/cash). No drill-down inputs — this report is summary-only by design.

## Sources & limitations

Same as Receivables Reconciliation (with Tax): `list_invoices` (status=Open) for the subledger, `get_balance_sheet` for the control account. This report differs from that one only in what it renders, not in what it queries or computes.
