---
name: xero-gst-reconciliation-detail
description: Build a live Xero GST reconciliation — GST collected and paid from invoice and bill tax lines, per tax rate, reconciled against the GST account's Balance Sheet balance. Not a lodgeable BAS. Use for "GST reconciliation", "GST detail", "reconcile GST account", "does the GST account balance match".
---
# GST Reconciliation Detail

There is no tax-return / BAS endpoint on this connector (the same gap as the Activity Statement skill) — this is a **GST reconciliation, not a lodgeable BAS**; show an unmissable banner saying so, pointing to Xero → Tax → Activity statements for lodgement, and stating this is not tax advice. Use `list_tax_rates` (`ReportTaxType`, `Name`, `EffectiveRate`) to label rates, `list_invoices` (`where: Type=="ACCREC"` for GST collected, `Type=="ACCPAY"` for GST paid, `statuses: AUTHORISED,PAID`, `order: Date DESC`, paged per the foundation, filtered to the period on `DateString`, summing `TotalTax` — and per-tax-rate line amounts where line items are returned) for the accrual-side movement, and `get_balance_sheet` (`date`) to read the GST account balance at the period start and end to reconcile against. Optionally net off `list_credit_notes` (`ACCRECCREDIT` / `ACCPAYCREDIT`, `TotalTax`).

Show, per tax rate: GST collected, GST paid, and net GST for the period, then a reconciliation block — opening GST account balance (Balance Sheet at the period start) plus net GST movement for the period, versus the closing GST account balance (Balance Sheet at the period end) — with the difference stated plainly. Common causes (BAS payments/refunds recorded outside invoices and bills, and any GST-account activity outside this connector's scope) are disclosed as possibilities, never asserted as the actual cause.

Validate net GST = GST collected − GST paid, that the per-tax-rate breakdown sums to the period totals, and — informational only, never Pass/Fail, because a real difference is expected and diagnostic rather than an error — closing GST balance minus opening GST balance versus the net GST movement. Completeness is N/A when paging was truncated.
## Interactivity

`list_invoices` has no date-range parameter, so the period is applied to the loaded rows client-side on `DateString` — not consumed there. Declare `period_start` / `period_end` (date) and map them 1:1 to two `get_balance_sheet` bindings' `date` param (`period_start` → the opening-balance binding, `period_end` → the closing-balance binding) — these ARE the declared inputs, and the same two dates drive the client-side invoice filter. Declare `page` (number) per the foundation's paging rule and `organisation`. Tax-rate filter and sortable tables are client-side.
