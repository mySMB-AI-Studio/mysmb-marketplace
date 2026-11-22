---
name: xero-bookkeeper-statement-matching
description: Read a supplier, customer or bank statement and match it against Xero; list the differences. Use in Supplier statement check (read, match).
---

# Statement matching for Xero

Use with `bookkeeping-xero-foundation`. Always pass the client's `xero_tenant_id`.

## Read (step `read`)

Capture `kind` (`supplier`, `customer`, `bank`), the issuer, the statement period, the opening and closing balances, and every line (date, reference or invoice number, description, debit/credit, running balance). `readable: false` when the text cannot be read or the period cannot be determined.

## Match (step `match`)

- **Supplier statement**: the issuer is a Xero contact (`xero.contacts.read`). Pull the contact's ACCPAY bills and credit notes for the period plus 60 days before (`xero.bills.read`, `where: Type=="ACCPAY" AND Contact.ContactID==Guid("…")`). Match each statement line by invoice number first, then by amount and date (±3 days). Statement balance minus the sum of Xero `AmountDue` for the matched contact is the difference to explain.
- **Customer statement** (a customer's record of what they owe the client): same with `Type=="ACCREC"`.
- **Bank statement**: the bank account comes from the client file or the account's name; compare lines against `list_bank_transactions` for the period and the closing balance against Xero's bank balance. (`xero.bills.read` is not the tool here; use the bank transactions binding when the capability is available, otherwise report the statement as `needsAttention`.)

Classify each unmatched line as one of: `missing_in_xero` (a bill on the statement with no Xero record: start Supplier bill intake for it), `missing_on_statement` (a Xero bill the supplier does not show: possibly paid or credited), `amount_differs`, `paid_not_applied`. `agreed: true` only when the closing balance reconciles to the cent and every line is matched.

Draft `clientQueryEmail` asking about the differences the client can answer (payments made outside Xero, disputed lines); it is sent only on the reviewer's decision.

Outputs: `matched[]`, `differences[]` (each with `kind`, `statementLine`, `xeroRef`, `amount`, `explanation`), `agreed`, `clientQueryEmail`.

## Never

Change anything in Xero. A fix is a person's action in Xero, or a new Supplier bill intake job.