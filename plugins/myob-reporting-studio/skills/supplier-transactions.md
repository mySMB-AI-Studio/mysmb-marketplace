# Supplier Transactions

Prompt ID M45. Menu: Reporting › Reports › Purchases › Supplier transactions.

Use `list_bills` (status=All, date-ranged) and `list_supplier_payments` (date-ranged), merged into one chronological transaction list per supplier (bill = charge, payment = credit). Mirrors `myob-customer-transactions.md`'s pattern with `list_bills`/`list_supplier_payments` in place of `list_invoices`/`list_payments`.

Disclose explicitly that MYOB supplier debit notes/adjustments (the "debits" MYOB's own description mentions) have no confirmed tool in this connector — only bills and supplier payments are shown; do not invent a debit-note field or tool call. Validate that per-supplier running totals reconcile against `list_bills`' open-balance data where available.

## Interactivity

* Declare `from_date`/`to_date` inputs mapped to both tools' date params.
* Declare a `supplier` enum input mapped to `supplier_uid` on both bindings.
* `persona` input per the foundation skill.

## Sources & limitations

Tools used: `list_bills`, `list_supplier_payments` (calls `Purchase/SupplierPayment` — new to this connector; the `Supplier/UID` server-side filter is applied by analogy to `list_payments`' `Contact/UID` filter on the sibling `Sale/ReceivePayment` endpoint and isn't independently documented, so verify it filters correctly on first live use). Supplier debit notes are out of scope — not built, not guessed.
