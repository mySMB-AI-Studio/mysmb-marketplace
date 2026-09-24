# Activity Statement (BAS) — GST reproduction

Ask for the statement period and GST reporting basis (Accrual/Cash).

**This is not achievable as a lodgeable BAS.** Xero's Accounting API has no Activity Statement or BAS report endpoint — confirmed against the real Reports API surface (only ProfitAndLoss, BalanceSheet, TrialBalance, BankSummary, AgedReceivablesByContact, AgedPayablesByContact, BudgetSummary, and ExecutiveSummary exist). There is no G1/G2/G3/G10/G11/1A/1B/W1-W4/PAYG-instalment box mapping available from the API. Never ask the user to supply these figures manually and never invent them — that violates the no-substitution rule in the report foundation.

Instead, build a **GST Summary by Tax Rate** using `list_tax_rates` (for each rate's `ReportTaxType` — OUTPUT vs INPUT classification) joined against `list_invoices` and `list_bills` for the period, aggregating `TotalTax` and `Total` per tax rate. Present sales-side (OUTPUT) tax collected and purchases-side (INPUT) tax paid separately, with a net GST position.

PAYG withholding (W1-W4) and PAYG instalments require Xero Payroll AU data, a separate integration not always connected to this organisation. Omit these sections entirely unless payroll tools are confirmed available for this org — do not present placeholder or estimated figures for them.

Validate: net GST = sum(OUTPUT tax) − sum(INPUT tax) for the period, cross-checked against the GST/tax-payable account movement if traceable. Include an unmissable banner: "GST Summary by Tax Rate — not a Business Activity Statement. No BAS-box mapping exists in Xero's API. Not tax advice."