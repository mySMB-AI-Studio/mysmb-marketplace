---
name: MYOB Aged Receivables
description: Generate a MYOB Aged Receivables report — outstanding customer balances by aging bucket, as at a date.
---

# Aged Receivables

Use `get_aged_receivables` with the as-at `report_date` parameter, and the optional `contact_uid` parameter when scoped to a single customer. This tool computes the aging breakdown itself (from open invoices, bucketed server-side) — it does not call a MYOB report endpoint, because no such endpoint exists in MYOB's API. Trust its output directly; there is no separate raw shape to discover here.

The tool returns: `as_of_date`, `party_count`, `grand_total`, `bucket_totals` (`current`/`1-30`/`31-60`/`61-90`/`90+` across all customers), and `parties` — an array of `{ uid, name, total, bucket_totals, items }` per customer, where `items` is the per-invoice detail (`number`, `due_date`, `amount`, `days_overdue`, `bucket`).

Present one row per customer with their total and per-bucket breakdown, plus a grand total row across all customers. Use `parties[].items` for the expandable invoice-level drill-down under each customer row — no separate tool call needed, it's already there.

Validate:
* For each customer, `bucket_totals` sums to their total
* Across all customers, each bucket's sum ties to the top-level `bucket_totals`
* The sum of all customer totals ties to `grand_total`

Show any discrepancy prominently — a mismatch here would indicate a genuine bug in the tool's aggregation, not a data-quality quirk, since the tie-out is guaranteed by construction. Note in Sources & limitations that this is computed from open invoices (not a native MYOB aging report, since MYOB's API has none), so it reflects the same data `list_invoices` would show.

## Interactivity

* Declare a `report_date` (as-at date) input driven by a client-side preset picker (today, month-end, quarter-end) — re-query the tool with the new date on change. 
* Declare `customer` as an optional enum input when scoping to one customer, mapped to `contact_uid`. 
* Customer rows expand/collapse client-side using the already-returned `items` — never a new data call for this.
