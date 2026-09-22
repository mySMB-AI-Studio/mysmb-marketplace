# Payables Reconciliation (with Tax)

Prompt ID M41 · Reporting › Reports › Purchases › Payables reconciliation with tax. This is the exact payables mirror of the Receivables Reconciliation (with Tax) skill: `Purchase/Bill` in place of `Sale/Invoice`, an Accounts Payable control account in place of Accounts Receivable. Same tools, same tie-out mechanics, opposite side of the ledger.

Use `list_bills` (`status: "Open"`, `page_size: 1000`) for the subledger side, and `get_balance_sheet` (as at the selected date, matching basis) for the control-account side. Sum bill `TotalAmount` (inc-tax) across all open bills for the subledger total. On the Balance Sheet's `AccountsBreakdown`, identify the Accounts Payable control account(s) by name pattern (`/creditor|payable/i` against `Account.Name`) — do not hardcode a DisplayID, company files vary. Sum matched accounts' `AccountTotal` for the control-account total.

Compute `diff = subledgerTotal - controlTotal` and `tie = Math.abs(diff) < 0.01`. Render the comparison as a two-card layout (subledger total, control account total) plus a difference row, with a Pass/Fail badge.

**Do not infer a cause when the two sides don't tie.** A manual journal against the control account and a genuine timing difference look identical from this data — state plainly that a discrepancy exists and that this report cannot distinguish between them, rather than guessing.

**Point-in-time limitation — disclose with a visible banner, not just in Sources:** `list_bills` with `status: "Open"` reflects bills open *right now*; MYOB has no historical "open as at a past date" snapshot. If the selected Balance Sheet date is not today, the two sides are not for the same point in time — say so before showing the comparison, not just as a footnote.

If no account matches the AP naming pattern, render the control-account side as "not identified" rather than guessing an account, and skip the tie-out badge (render "control account not identified" instead of Pass/Fail).

## Interactivity

* Declare a `date` (as-at) input mapped to `get_balance_sheet`'s `date` param; `list_bills` has no date param for "open as at X" (see limitation above) so it always reflects current opens regardless of the selected date — the banner covers this.
* Declare `basis` (accrual/cash) mapped to `get_balance_sheet`'s `reporting_basis`.
* No per-bill drill-down is required by this report (that's Aged Payables' job) — keep this report to the subledger-vs-control-account comparison itself.

## Sources & limitations

Tools used: `list_bills` (status=Open, page_size 1000) for the subledger; `get_balance_sheet` (matching basis) for the GL control account, as at the selected date. Control account identified by name pattern, not a fixed DisplayID — flag if this company file's AP account doesn't match `/creditor|payable/i`. Point-in-time limitation applies whenever the selected date isn't today (see banner above).
