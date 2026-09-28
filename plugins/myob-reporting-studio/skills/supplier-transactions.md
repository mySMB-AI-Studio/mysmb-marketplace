---
name: MYOB Supplier Transactions
description: All bills and supplier payments within a date range, per supplier.
---

# Supplier Transactions

Prompt ID M45. Menu: Reporting › Reports › Purchases › Supplier transactions.

Use `list_bills` (status=All, `page_index: 0` for all pages, date-ranged) and `list_supplier_payments` (date-ranged, `page_size: 1000`), merged into one chronological transaction list per supplier (bill = charge, payment = credit). Mirrors `myob-reporting-studio:customer-transactions`' pattern with `list_bills`/`list_supplier_payments` in place of `list_invoices`/`list_payments`. `list_supplier_payments` returns a single page only: if exactly 1000 payments come back, show a visible "payments may be truncated at 1000" warning, mark the reconciliation check N/A, and suggest a narrower date range.

Disclose explicitly that MYOB supplier debit notes/adjustments (the "debits" MYOB's own description mentions) have no confirmed tool in this connector beyond what `list_bills` returns as negative bills — only bills and supplier payments are shown; do not invent a debit-note field or tool call. Validate that per-supplier running totals reconcile against `list_bills`' open-balance data (`BalanceDueAmount`) where available.

## Interactivity

* Declare `from_date`/`to_date` inputs mapped to both tools' date params.
* Declare a `supplier` optional `string` UID input (maxLength 36), a presentation filter over the unfiltered bindings — fill its dropdown from the suppliers in the returned rows and filter client-side. For "all", the bindings omit `supplier_uid`; never pass `""`. If payments were truncated, you may add filtered bindings (`supplier_uid` on both tools) called with `getData` only once a real supplier UID is chosen.
* `persona` and `company_file` inputs per the foundation skill.

## Sources & limitations

Tools used: `list_bills`, `list_supplier_payments` (one page of up to 1000; the `supplier_uid` filter is the connector's documented param, but verify it filters correctly on first live use). Supplier debit notes are out of scope — not built, not guessed.
