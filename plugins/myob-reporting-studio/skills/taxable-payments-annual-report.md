---
name: MYOB Taxable Payments Annual Report
description: Aggregate reportable contractor payments by supplier for TPAR — if the underlying data is actually available; otherwise say so and point to export.
---

# Taxable Payments Annual Report (Prompt ID M14 — Reporting › Reports › Business › Taxable payments annual report)

**TPAR is based on payments MADE in the financial year, not bills dated in it.** A bill dated in June and paid in July belongs to the next year's TPAR; a bill from last year paid this year belongs to this one. Build from supplier payments, then use the bills they pay to decide which payments are reportable.

**This report is conditional on a live field check — do not assume it exists.** MYOB's real API is documented to carry an AU-specific `IsReportable` flag on `Purchase/Bill`, but this connector's `list_bills`/`get_bill` just proxy MYOB's raw JSON through unmodified — the field has never been confirmed present in this connector's actual output. Before building anything else, call `list_bills` (or `get_bill` on one real bill) during the generation turn and check whether `IsReportable` appears on a returned item. Also call `list_supplier_payments` once and confirm how each payment links to the bills it pays (e.g. a `Lines[]` entry per bill with the bill's UID and the amount applied) — `get_supplier_payment` shows the full shape.

**If `IsReportable` is present and payments link to bills:**
* `list_supplier_payments` for the FY (`from_date`/`to_date`, `page_size: 1000`). It returns a single page only — if exactly 1000 come back, split the FY client-side (e.g. by quarter, re-calling the same binding with `getData`) and say so.
* `list_bills` (`status: "All"`, `page_index: 0`) with a `from_date` early enough to include older bills paid this year (e.g. the start of the previous FY) and `to_date` = FY end.
* For each payment line, look up the bill it pays; the payment amount applied to a bill with `IsReportable === true` is reportable. Aggregate reportable payments by `Supplier.UID`/`Supplier.Name` for the year. Present one row per reportable supplier with their total paid, plus a grand total.
* A payment line whose bill isn't in the fetched bills is "unmatched": show the unmatched count and total in its own row — never drop it or guess.

Disclose plainly that real TPAR lodgement also requires each supplier's ABN to be complete and correct in MYOB — this report gives the aggregated payment figures, not a lodgement-ready ATO file, and does not itself validate ABN completeness.

**If `IsReportable` is NOT present, payments don't link to bills, or the field check is ambiguous:** do not build a substitute or guess which payments might be reportable — there is no reliable proxy for this AU-specific compliance flag (unlike GST/BAS, where a genuine partial substitute existed). Say plainly that this report cannot be built from currently available data, and point to the MYOB export fallback: Reporting › Reports › Business › Taxable payments annual report › Export → Excel. Do not ship a report that silently omits the reportable-flag filtering, and never total bills dated in the year as if they were payments.

Validate (only if built, 0.01 tolerance): the sum of per-supplier totals equals the grand total; every payment line in the FY is classified as reportable, not reportable, or unmatched (the three totals sum to all payments). Any unmatched lines, or truncated payments, make the completeness check Fail or N/A — never Pass.

## Interactivity

* Declare `persona` and `company_file` per the foundation skill.
* Declare `from_date`/`to_date` inputs defaulting to the current AU financial year (1 Jul – 30 Jun, computed client-side on load), mapped 1:1 to `list_supplier_payments`' date params. The bills binding's wider range is derived from the same FY (a separate pair of date inputs, or static dates set at authoring — say which).

## Sources & limitations

Tools used (if buildable): `list_supplier_payments` (payments made in the FY — the TPAR basis) and `list_bills` (`/Purchase/Bill`, to read `IsReportable` on the bills those payments settle) — confirm the flag and the payment-to-bill link live at generation time, do not assume. Not a lodgement-ready ATO file even when built; supplier ABN completeness is not validated here.
