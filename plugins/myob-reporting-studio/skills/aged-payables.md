---
name: MYOB Aged Payables
description: Generate a MYOB Aged Payables report — outstanding supplier balances by aging bucket, as at a date.
---

# Aged Payables

Use `get_aged_payables` with the as-at `report_date` parameter, and the optional `contact_uid` parameter when scoped to a single supplier. This tool computes the aging breakdown itself (from open bills, bucketed server-side) — it does not call a MYOB report endpoint, because no such endpoint exists in MYOB's API. Trust its output directly.

The tool returns: `as_of_date`, `party_count`, `grand_total`, `bucket_totals` (`current`/`1-30`/`31-60`/`61-90`/`90+` across all suppliers), and `parties` — an array of `{ uid, name, total, bucket_totals, items }` per supplier, where `items` is the per-bill detail (`number`, `due_date`, `amount`, `days_overdue`, `bucket`).

Present one row per supplier with their total and per-bucket breakdown, plus a grand total row across all suppliers. Use `parties[].items` for the expandable bill-level drill-down — already returned, no separate call needed.

Validate:
* For each supplier, `bucket_totals` sums to their total
* Across all suppliers, each bucket's sum ties to the top-level `bucket_totals`
* The sum of all supplier totals ties to `grand_total`

A mismatch here would indicate a bug in the tool, not a data-quality issue, since the tie-out is guaranteed by construction. Note in Sources & limitations that this is computed from open bills (MYOB's API has no native aging report), so it reflects the same data `list_bills` would show.

## Interactivity

* Declare a `report_date` (as-at date) input driven by a client-side preset picker. 
* Declare `supplier` as an optional enum input mapped to `contact_uid`. 
* Supplier rows expand/collapse client-side using the already-returned `items`.
