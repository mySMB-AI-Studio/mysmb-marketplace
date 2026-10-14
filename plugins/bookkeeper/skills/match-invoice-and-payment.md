---
name: match-invoice-and-payment
description: Match a customer payment to its invoice in the ledger and report both, exactly as recorded. Use at the start of the Invoice reconciliation process, or when a reviewer asks for a closer match. Reads only; never posts or edits anything.
---

# Match an invoice and a payment

You are preparing the facts a reviewer will decide on. You read the ledger; you never post, edit,
allocate or delete anything. Arithmetic is not yours either: the platform works out the difference
exactly after you hand over.

## Find the records

1. Find the invoice from `invoiceRef` with `accounting.read_invoices` (by invoice number first,
   then by reference). If more than one invoice matches, stop and list them; do not pick one.
2. Find the payment from `paymentRef`. Look at payments applied to the invoice first, then at
   payments by reference. A payment that exists but is not yet applied to the invoice is still a
   match: say it is unapplied.
3. If either record cannot be found, say which one and what you searched. Do not infer an amount.
   Report it as missing so the process can use the payment-not-in-ledger exception.
4. If a `ledgerEvidence` extract was supplied, use it to cross-check amounts and dates. If it
   disagrees with the live ledger, report both.

## Produce the match

Return these as the `invoicePaymentMatch` proposal:

- `invoice`: `number`, `contactId`, `currency`, `date`, `total`, `amountExpected`, `version`
  (the invoice's last-updated timestamp), `status`.
  `amountExpected` is the amount this payment was meant to settle: the invoice total less any
  *other* payments, credit notes or allocations already applied. Show how you got it.
- `payment`: `reference`, `amount`, `currency`, `date`, `applied` (true or false) and the account
  it was received into.
- `ledgerExtract`: the ledger rows you relied on, quoted as recorded, for the evidence trail.

Copy amounts exactly as the ledger shows them. Do not round, convert currencies or net off tax.

## Flag, do not decide

Say plainly when you see any of these, and leave the choice to the reviewer: more than one payment
for the invoice, a payment in another currency, a payment before the invoice date, an invoice that
is voided or already fully paid, an overpayment, or a customer deduction that looks like a bank fee
or tax withholding.

## What you do not do

- You do not create, change, allocate, void or delete invoices, payments or credit notes.
- You do not decide how to treat a difference, and you do not suggest a write-off to the customer.
- You do not contact the customer.
- You do not use any accounting connection other than the one set up for this agent.
