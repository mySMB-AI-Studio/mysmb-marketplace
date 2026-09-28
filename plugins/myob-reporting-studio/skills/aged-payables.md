---
name: MYOB Aged Payables
description: Generate a MYOB Aged Payables report — outstanding supplier balances by aging bucket, as at a date.
---

# Aged Payables

Use `get_aged_payables` with the `report_date` parameter, and the optional `contact_uid` parameter when scoped to a single supplier. This tool computes the aging breakdown itself (from open bills, bucketed server-side) — it does not call a MYOB report endpoint, because no such endpoint exists in MYOB's API. Trust its output directly.

**Ageing always uses today's open items.** Balances and Open status are as of TODAY; `report_date` only changes how days overdue are bucketed. When `report_date` isn't today, show a visible banner saying "Balances are today's open bills, re-bucketed as at <date>".

The tool returns: `as_of_date`, `party_count`, `grand_total`, `bucket_totals` (`current`/`1-30`/`31-60`/`61-90`/`90+` across all suppliers), and `parties` — an array of `{ uid, name, total, bucket_totals, items }` per supplier, where `items` is the per-bill detail (`number`, `due_date`, `amount`, `days_overdue`, `bucket`). Amounts are outstanding balances (the bill's `BalanceDueAmount`), not bill totals.

Present one row per supplier with their total and per-bucket breakdown, plus a grand total row across all suppliers. Use `parties[].items` for the expandable bill-level drill-down — already returned, no separate call needed.

Validate (0.01 tolerance — `bucket_totals` are not rounded):
* For each supplier, `bucket_totals` sums to their total
* Across all suppliers, each bucket's sum ties to the top-level `bucket_totals`
* The sum of all supplier totals ties to `grand_total`

A mismatch here would indicate a bug in the tool, not a data-quality issue, since the tie-out is guaranteed by construction. Note in Sources & limitations that this is computed from today's open bills (MYOB's API has no native aging report), so it reflects the same `BalanceDueAmount` figures `list_bills` (status Open) would show.

## Interactivity

* Declare a `report_date` (as-at date) input driven by a client-side preset picker, with the banner above whenever it isn't today.
* Declare `supplier` as an optional `string` UID input (maxLength 36) — a presentation filter: fill its dropdown from `parties[].uid`/`name` and filter client-side. The binding omits `contact_uid`; never pass `""`.
* Declare `company_file` per the foundation skill.
* Supplier rows expand/collapse client-side using the already-returned `items`.
