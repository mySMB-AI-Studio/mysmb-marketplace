---
name: MYOB Aged Receivables
description: Generate a MYOB Aged Receivables report — outstanding customer balances by aging bucket, as at a date.
---

# Aged Receivables

Use `get_aged_receivables` with the `report_date` parameter, and the optional `contact_uid` parameter when scoped to a single customer. This tool computes the aging breakdown itself (from open invoices, bucketed server-side) — it does not call a MYOB report endpoint, because no such endpoint exists in MYOB's API. Trust its output directly; there is no separate raw shape to discover here.

**Ageing always uses today's open items.** Balances and Open status are as of TODAY; `report_date` only changes how days overdue are bucketed. A past `report_date` is not a historical aged-receivables report — when `report_date` isn't today, show a visible banner saying "Balances are today's open invoices, re-bucketed as at <date>".

The tool returns: `as_of_date`, `party_count`, `grand_total`, `bucket_totals` (`current`/`1-30`/`31-60`/`61-90`/`90+` across all customers), and `parties` — an array of `{ uid, name, total, bucket_totals, items }` per customer, where `items` is the per-invoice detail (`number`, `due_date`, `amount`, `days_overdue`, `bucket`). Amounts are outstanding balances (the invoice's `BalanceDueAmount`), not invoice totals.

Present one row per customer with their total and per-bucket breakdown, plus a grand total row across all customers. Use `parties[].items` for the expandable invoice-level drill-down under each customer row — no separate tool call needed, it's already there.

Validate (0.01 tolerance — `bucket_totals` are not rounded):
* For each customer, `bucket_totals` sums to their total
* Across all customers, each bucket's sum ties to the top-level `bucket_totals`
* The sum of all customer totals ties to `grand_total`

Show any discrepancy prominently — a mismatch here would indicate a genuine bug in the tool's aggregation, not a data-quality quirk, since the tie-out is guaranteed by construction. Note in Sources & limitations that this is computed from today's open invoices (not a native MYOB aging report, since MYOB's API has none), so it reflects the same `BalanceDueAmount` figures `list_invoices` (status Open) would show.

## Interactivity

* Declare a `report_date` (as-at date) input driven by a client-side preset picker (today, month-end, quarter-end) — re-query the tool with the new date on change, and show the banner above whenever it isn't today.
* Declare `customer` as an optional `string` UID input (maxLength 36) — a presentation filter over the unfiltered result: fill its dropdown from `parties[].uid`/`name` and filter client-side. The binding omits `contact_uid`; never pass `""`.
* Declare `company_file` per the foundation skill.
* Customer rows expand/collapse client-side using the already-returned `items` — never a new data call for this.
