---
name: xero-bookkeeper-bill-coding
description: Read a supplier bill (PDF or photo) and propose its Xero coding with a source and confidence per line; then run the intake checks. Use in Supplier bill intake (extract, checks).
---

# Bill coding for Xero

Use with `bookkeeping-xero-foundation` (where settings, client files, rules and bill records live). Always pass the client's `xero_tenant_id` on every Xero call.

## Extract (step `extract`)

1. Read the document text. Capture: supplier name, ABN, invoice number, invoice date, due date, currency, line items (description, quantity, unit amount, line total, GST), subtotal, GST, total. A photo or scan with no readable text is `readable: false` (handled in `identify`).
2. Match the supplier: `xero.contacts.read` with `searchTerm` (name, then ABN). One exact match → use its `ContactID`. None → propose a new contact (`contact.is_new = true`, name, ABN, email) for `xero.contacts.upsert` on approval. Several → list them in `warnings` and pick the one with recent ACCPAY history.
3. Code each line, in this order, recording `source` and `reason`:
   - `rule`: `Bookkeeping/Rules/<client>.json` → `suppliers[ContactID]` or `suppliers["name:<normalised name>"]` → `account_code`, `tax_type`.
   - `history`: the supplier's last 10 ACCPAY bills (`xero.bills.read`, `where: Type=="ACCPAY" AND Contact.ContactID==Guid("…")`, `order: Date DESC`) → the most common account code and tax type.
   - `ai`: the chart of accounts (`xero.accounts.read`, `Status=="ACTIVE"`, expense and asset types) → the best fit by name and the line description. Confidence ≤ 0.6 unless the match is unambiguous.
4. Tax types: GST-registered client → `INPUT` (10% GST on expenses) when the line shows GST, `EXEMPTEXPENSES` when it shows none; client not GST-registered → `BASEXCLUDED`. Suspense codes in the client file are never proposed.
5. Build `proposal.xeroInvoice` exactly in the shape `xero.bill.draft_create` accepts: `Type: ACCPAY`, `Status: DRAFT`, `Contact.ContactID`, `InvoiceNumber`, `Date`, `DueDate`, `CurrencyCode`, `LineAmountTypes: Exclusive`, `LineItems[]` with `Description`, `Quantity`, `UnitAmount`, `AccountCode`, `TaxType`, and `Reference` = the job's external reference. Totals must reconcile to the document to the cent; if they do not, say so in `warnings` and lower `confidence`.
6. Draft `clientQueryEmail` (`to` = the client contact, `subject`, plain-text `body`, `requestRef`) asking the one question that would unblock coding; it is sent only if the reviewer chooses *Ask the client*.

Outputs: `proposal`, `supplier`, `total`, `currency`, `confidence` (lowest line confidence), `warnings[]`, `clientQueryEmail`.

## Checks (step `checks`)

Run every check; tag each warning `[CHK-id]`.

| Output | How |
|---|---|
| `duplicate`, `duplicateOf` | Same supplier and invoice number, or same supplier, total and date within `duplicateWindowDays`, among ACCPAY bills in any status except VOIDED/DELETED. `duplicate: true` ends the job as duplicate. [CHK-001] |
| `abnStatus` | ABN on the document vs the contact's `TaxNumber`; look it up when an ABR lookup is available. `missing`, `mismatch`, `cancelled`, `not_gst_registered` or `ok`. [CHK-012] |
| `rateVariance` | Unit amounts vs the supplier's last bills for the same description; flag above `rateVariancePct`. [CHK-031] |
| `bankDetailChanged` | Payment details on the document vs the fingerprint in `Bookkeeping/Checks/<client>.json`; never write the numbers anywhere. [CHK-056] |
| `blocking` | true when `abnStatus` is `cancelled` or `mismatch`, or `bankDetailChanged` is true: the reviewer sees it first. |
| `needsClientApproval` | `total` > `clientApprovalAbove` (from the job's variation points). |
| `checkTags` | the list of CHK ids raised. |

## Never

- Create, approve, authorise, void or delete anything in Xero from this skill; the proposal is an input to the reviewer's decision.
- Mix clients, or call Xero without the client's `xero_tenant_id`.
- Store bank account numbers.