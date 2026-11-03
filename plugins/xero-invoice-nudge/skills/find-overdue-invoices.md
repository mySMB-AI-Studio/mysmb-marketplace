# Find overdue invoices

1. Call the `xero.invoices.list_overdue` capability.
2. Keep invoices whose DueDate is at least `{{minDaysOverdue}}` days before today and whose AmountDue is more than 0.
3. Return these outputs:
   - `hasOverdue`: true if at least one invoice qualifies, otherwise false.
   - `overdueList`: one entry per invoice with InvoiceID, InvoiceNumber, contact name and email, AmountDue and days overdue, sorted by days overdue (oldest first). Empty when nothing qualifies.
   - `chase`: the invoice to chase today, which is the oldest one in `overdueList`, as `{ invoiceId, invoiceNumber, contactEmail, amountDue, note, idempotencyKey }`. `note` is one short line for the Xero history, for example "Chased by Invoice Nudge on 2026-11-03". `idempotencyKey` is `chase-<invoiceId>-<today's date>`. Leave it out when nothing qualifies.
   - `chaseSummary`: one sentence, for example "3 invoices, $2,140 overdue, oldest 34 days", or "Nothing overdue today".

Never email a client or change anything in Xero from this skill. It only reads.