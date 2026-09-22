# Taxable Payments Annual Report (Prompt ID M14 — Reporting › Reports › Business › Taxable payments annual report)

**This report is conditional on a live field check — do not assume it exists.** MYOB's real API is documented to carry an AU-specific `IsReportable` flag on `Purchase/Bill`, but this connector's `list_bills`/`get_bill` just proxy MYOB's raw JSON through unmodified — the field has never been confirmed present in this connector's actual output. Before building anything else, call `list_bills` (or `get_bill` on one real bill) during the generation turn and check whether `IsReportable` appears on a returned item.

**If `IsReportable` is present:** use `list_bills` (`status: "All"`, financial-year date range) and filter to `IsReportable === true`. Aggregate total payments by `Supplier.UID`/`Supplier.Name` for the year. Present one row per reportable supplier with their total, plus a grand total. Disclose plainly that real TPAR lodgement also requires each supplier's ABN to be complete and correct in MYOB — this report gives the aggregated payment figures, not a lodgement-ready ATO file, and does not itself validate ABN completeness.

**If `IsReportable` is NOT present (or the field check is ambiguous):** do not build a substitute or guess which bills might be reportable — there is no reliable proxy for this AU-specific compliance flag (unlike GST/BAS, where a genuine partial substitute existed). Say plainly that this report cannot be built from currently available data, and point to the MYOB export fallback: Reporting › Reports › Business › Taxable payments annual report › Export → Excel. Do not ship a report that silently omits the reportable-flag filtering — that would misrepresent which bills are actually contractor payments.

Validate (only if built): the sum of per-supplier totals equals the grand total.

## Interactivity

* Declare `persona` per the foundation skill.
* Declare `from_date`/`to_date` inputs defaulting to the current AU financial year (Jul 1 – Jun 30), mapped 1:1 to `list_bills`' date params.

## Sources & limitations

Tool used (if buildable): `list_bills` (`/Purchase/Bill`), filtered on `IsReportable` — confirm this field's presence live at generation time, do not assume. Not a lodgement-ready ATO file even when built; supplier ABN completeness is not validated here.
