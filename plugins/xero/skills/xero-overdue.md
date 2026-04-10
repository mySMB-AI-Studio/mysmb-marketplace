---
name: xero:overdue
description: List overdue invoices, sorted most urgent first.
---

# /xero:overdue

Show every invoice that is currently past its due date and still unpaid,
ordered from most overdue to least.

## Instructions

1. Call `list_invoices` with `status="AUTHORISED"` and `limit=100`.
2. Filter the response to invoices where:
   - `amount_due > 0`, AND
   - `due_date < today` (use the session's current date).
3. For each remaining invoice compute `days_late = today - due_date`.
4. Sort descending by `days_late`. Break ties by `amount_due` descending.
5. Render one row per invoice with these fields in this order:
   contact name, invoice number, amount due, currency code, days late.
6. Cap the table at 20 rows. If there are more, add a single trailing line:
   `... and <N> more overdue invoices not shown.`
7. Above the table, print a one-line headline:
   `<N> overdue invoices, <TOTAL> <CURRENCY> past due.`
   If multiple currencies are present, print one headline per currency.

## Rules

- Every figure must come from the `list_invoices` response in this turn.
- Use the `currency_code` returned by Xero. Do not assume USD.
- Short tables only. No prose, no commentary, no emojis.
- If nothing is overdue, say exactly:
  `Nothing is overdue. Every authorised invoice is either paid or not yet due.`

## When to use

Trigger on questions like "what's overdue", "who's late", "any late
invoices", "past due report". For a fuller AR picture including current
receivables, prefer `/xero:who-owes-me`.
