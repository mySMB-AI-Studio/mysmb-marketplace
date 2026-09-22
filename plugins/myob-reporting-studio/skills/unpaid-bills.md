# Unpaid Bills

Prompt ID M40 · Reporting › Reports › Purchases › Unpaid bills. Mirrors `myob-unpaid-invoices`' pattern for the payables side.

Use `get_aged_payables` (optional `report_date`, `contact_uid`) rather than re-deriving ageing from `list_bills` directly — it already aggregates open bills into the same bucket structure (`current`/`1-30`/`31-60`/`61-90`/`90+`) server-side from `Purchase/Bill`, and reusing it avoids a second, possibly inconsistent ageing implementation. Trust its output directly; there is no separate raw shape to discover.

Present one row per supplier: `total`, per-bucket breakdown from `bucket_totals`, and a grand total row across all suppliers (`grand_total`). Use `parties[].items` (`number`, `due_date`, `amount`, `days_overdue`, `bucket`) for the expandable bill-level drill-down under each supplier row — no separate tool call needed.

Validate:
* For each supplier, `bucket_totals` sums to their `total`
* Across all suppliers, each bucket's sum ties to the top-level `bucket_totals`
* Sum of all supplier totals ties to `grand_total`

Show any discrepancy prominently — a mismatch here indicates a bug in the tool's aggregation, since the tie-out is guaranteed by construction.

## Interactivity

* Declare a `report_date` (as-at date) input driven by a client-side preset picker (today, month-end, quarter-end) — re-query `get_aged_payables` with the new date on change.
* Declare `supplier` as an optional enum input mapped to `contact_uid`.
* Supplier rows expand/collapse client-side using the already-returned `items`.

## Sources & limitations

Tool used: `get_aged_payables` (same aggregation `myob-aged-payables` uses — this report and Aged Payables share one tool and one ageing implementation, differing only in framing: this one leads with the supplier list, Aged Payables leads with bucket totals).
