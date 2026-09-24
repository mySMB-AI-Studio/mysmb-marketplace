# Supplier Purchases (Detail)

Prompt ID M44 · Reporting › Reports › Purchases › Supplier purchases (detail). Line-level counterpart to `myob-supplier-purchases`, mirroring the sales-side detail report's approach to the same open question.

Use `list_bills` (`status: "All"`, date-ranged) for the bill list. Before assuming line-level detail is available, call `get_bill` once for a sample bill during generation and check for a `Lines` array — this is NOT confirmed in the current connector schema (`list_bills`/`get_bill` are typed as raw pass-through responses, so whatever MYOB's `/Purchase/Bill/{uid}` actually returns is what's available, unverified until checked). If `Lines` is present, fetch it per bill (N+1 calls — one per bill in the period; say so plainly if the period contains a large number of bills, since this means one call per bill, not one call total) and render account, description, quantity, unit price, and tax code per line. If `Lines` is not present or the shape differs, disclose this honestly in Sources & limitations and fall back to bill-level summary (same fields as Supplier Purchases) rather than guessing a line shape.

Group by bill: header row (supplier, date, bill number, total) with expandable line rows beneath.

Validate:
* Sum of a bill's line amounts equals that bill's `TotalAmount` (when lines are available)
* Sum of all bill totals equals the period grand total

## Interactivity

* Declare `from_date`/`to_date` inputs with the standard preset picker.
* Declare `supplier` as an optional enum input mapped to `supplier_uid`.
* Bill rows expand/collapse client-side to reveal lines — no new call needed once lines are hydrated.

## Sources & limitations

Tools used: `list_bills` (status=All) + `get_bill` per bill for line detail. State plainly whether this test/production company file's bills actually returned a `Lines` array — if not, this report degrades to bill-level summary and should say so rather than silently matching Supplier Purchases with no added detail.
