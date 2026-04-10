---
name: xero:who-owes-me
description: Summarise accounts receivable - how much is owed, by whom, and how old.
---

# /xero:who-owes-me

Show a plain-English summary of all money currently owed to the business,
broken down by age and by customer.

## Instructions

1. Call `list-invoices` scoped to authorised invoices. Pass whatever
   status / limit parameters the official Xero MCP server exposes -
   aim for at least 100 recent authorised invoices.
2. Filter the response to invoices where `amount_due > 0`. Authorised invoices
   with a zero balance are already settled and must be excluded.
3. For every remaining invoice, compute `days_overdue = today - due_date`
   (negative if not yet due). Use the session's current date as "today".
4. Bucket the invoices by `days_overdue`:
   - **Current** - not yet due (`days_overdue <= 0`)
   - **1-30 days**
   - **31-60 days**
   - **60+ days**
5. Sum `amount_due` within each bucket, and also compute a grand total.
6. Group the invoices by `contact.contact_id`, sum `amount_due` per contact,
   and pick the top 5 contacts by total owed.
7. Produce the output in this exact shape:
   - A one-line headline: `You are owed <TOTAL> <CURRENCY> across <N> open invoices.`
   - An aged-AR table with four rows (Current, 1-30, 31-60, 60+) and two
     columns (amount, invoice count).
   - A "Top debtors" table with up to 5 rows: contact name, amount owed,
     number of open invoices.
8. If there are multiple currencies in the result, group the headline and
   tables by currency - never mix currencies into a single total.

## Rules

- Every figure must come from the `list-invoices` response in this turn.
  Never carry numbers forward from a previous conversation.
- Use the `currency_code` returned by Xero. Do not assume USD.
- Short bullets and small tables only. No prose paragraphs. No emojis.
- If `list-invoices` returns zero matching invoices, say exactly:
  `No open authorised invoices found - nothing is outstanding right now.`

## When to use

Trigger on questions like "who owes me money", "what's my AR", "how much
am I owed", "accounts receivable summary". For only the overdue subset,
prefer `/xero:overdue`.
