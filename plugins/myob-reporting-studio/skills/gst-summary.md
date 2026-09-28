---
name: MYOB GST Summary
description: Generate a MYOB GST Summary by Tax Code — sales, purchases, tax collected/paid per code. Not a BAS.
---

# GST Summary by Tax Code

Use `get_gst_summary` with `from_date`/`to_date` and `reporting_basis`.

State plainly, in the report itself, that this is not a BAS (Business Activity Statement) — do not let the title, header, or framing imply otherwise, even if the request that triggered this was phrased as "generate my BAS." MYOB's API has no BAS-box mapping (G1, 1A, 1B, W1/W2, etc.) and does not reflect consolidated tax codes even when the company file groups them for BAS purposes in the MYOB UI. If asked specifically for a BAS, say directly that this tool can supply the underlying tax-code figures a BAS is built from, but cannot produce a lodgeable BAS itself — recommend MYOB's own BAS preparation feature, or a professionally reviewed code-to-box mapping, for the actual lodgement document. Do not attempt to guess which tax codes map to which BAS boxes.

Present one row per tax code: code, rate, sales total, purchases total, tax collected, tax paid, and net tax position (collected − paid) per code. Show a grand total row across all codes for each column. If the date range crosses more than one financial year, MYOB's P&L endpoint enforces a single-FY constraint that isn't explicitly documented for this endpoint — if the call fails for a wide range, don't retry blindly; narrow the range and say why.

Validate:
* Sum of per-code tax collected minus sum of per-code tax paid equals the displayed net tax position
* Grand totals equal the sum of their respective columns

Disclose in Sources & limitations: the exact tool and params used, the BAS-box-mapping limitation stated above (repeated here, not just in the report body, since this is the single most important caveat on this report), and the consolidated-tax-code limitation (figures reflect unconsolidated codes as MYOB's API returns them, which may not match a consolidated view shown elsewhere in MYOB).

## Interactivity

* Declare `from_date`/`to_date` inputs with a client-side preset picker (this month, this quarter, YTD). 
* Declare `reporting_basis` as its own input (Accrual/Cash). 
* Table sortable by any column, filterable by tax code.
