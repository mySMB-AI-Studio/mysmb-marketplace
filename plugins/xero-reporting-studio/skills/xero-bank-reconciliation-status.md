---
name: xero-bank-reconciliation-status
description: Build a live Xero bank transaction reconciliation status view — reconciled vs unreconciled counts and amounts per bank account. Use for "bank reconciliation status", "unreconciled transactions", "reconciliation status", "coding status".
---
# Bank Reconciliation Status

Use `list_bank_transactions` (`where`, `order`, `page`, `unitdp`), filtered with `where: IsReconciled==false` for unreconciled and `where: IsReconciled==true` for reconciled — two declared bindings, never one binding toggled by a boolean input, since `where` is a static string fixed at authoring. There is only Reconciled and Unreconciled on this field — do not invent a third "coded but not reconciled" state; Xero's bank-feed coding status (matched vs unmatched to a feed line) is not exposed by this connector.

Show, per bank account (`BankAccount.Name` / `AccountID` on each transaction), a reconciled count and total, an unreconciled count and total, and the oldest unreconciled transaction's date and age in days; plus an overall summary card. List unreconciled transactions with date, type (spend/receive money), contact, reference, and amount, sorted oldest first by default.

Validate that reconciled and unreconciled counts and totals per account are each the sum of their own fetched rows, and flag when paging was truncated (per the foundation's paging cap) so counts are shown as "at least" rather than exact — never a false completeness claim.
## Interactivity

Declare two bindings against `list_bank_transactions`: `where` static `"IsReconciled==false"` (id: `unreconciled`) and `where` static `"IsReconciled==true"` (id: `reconciled`), each with `order` static (e.g. `"Date ASC"`) and `unitdp` static `4`. Declare `page` (number, default `1`) per the foundation's paging rule and bind it to `page` on both — each loop tracks its own page counter internally via `getData` overrides, never `setInputs`. Plus `organisation` per the foundation. Bank-account filter box and sortable columns are client-side; recompute the summary cards over the filtered view, labelled as filtered.
