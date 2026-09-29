---
name: xero-exceptions-dashboard
description: Build a live Xero exceptions dashboard — draft and overdue sales invoices and bills only, the items needing action rather than the full pipeline. Use for "exceptions", "what needs attention", "draft and overdue", "action items", "exception report".
---
# Exceptions Dashboard

Reuse the same `list_invoices` data the Sales Overview and Purchases Overview skills use — `where: Type=="ACCREC"` and `where: Type=="ACCPAY"`, paged per the foundation — but filter down to only Draft (`Status` `DRAFT` or `SUBMITTED`) and Overdue (`Status` `AUTHORISED` with `DueDate` before today) rows; never show the full Awaiting-payment or Paid pipeline here — that is the Overview skills' job.

Show four cards — Draft sales, Draft bills, Overdue sales, Overdue bills — each with count and total, and a combined exceptions table (type, customer/supplier, date, due date, days overdue, amount) sorted most-overdue first. Highlight items overdue more than 30/60/90 days distinctly.

Validate that every listed row is genuinely Draft or Overdue per the rule above (no Awaiting-payment or Paid row leaks in), that card totals equal the sum of their own rows, and mark completeness N/A when paging was truncated.
## Interactivity

Declare two bindings against `list_invoices`: `where` static `"Type==\"ACCREC\""` and `where` static `"Type==\"ACCPAY\""`, each `statuses` static `"DRAFT,SUBMITTED,AUTHORISED"` (Draft and Overdue are both filtered client-side from this one status set — AUTHORISED rows are kept only when `DueDate` is before today), `order` static `"DueDate ASC"`, and a shared `page` (number) per the foundation's paging rule. Plus `organisation`. Days-overdue thresholds and the type/customer filter box are client-side; recompute card totals over the filtered view, labelled as filtered.
