---
name: xero:chase
description: Draft polite follow-up messages for customers with overdue invoices. Drafts only - the plugin does not send email.
---

# /xero:chase

Draft one follow-up email per customer who has at least one overdue invoice.
**The plugin does not send email.** Every output is a draft the user can copy
into their own mail client.

## Instructions

1. Call `list-invoices` scoped to authorised invoices, pulling at least
   100 recent ones.
2. Filter to invoices where `amount_due > 0` AND `due_date < today`.
3. Group the overdue invoices by `contact.contact_id`.
4. Sort the contacts by total overdue amount, descending. Take at most the
   top 5 contacts per invocation - chasing more than five people at once
   produces too much output to review.
5. For each selected contact, call `list-contacts` with a filter for
   that contact id to retrieve the email address and first name. If
   the server does not support id filtering, fall back to one
   `list-contacts` call and match client-side.
6. Split the selected contacts into two lists:
   - **With email on file** - contacts where `list-contacts` returned a
     non-empty email. Draft a follow-up message for each (see template below).
   - **No email on file** - contacts with no email. Do NOT draft a message;
     list them under a clearly labelled section so the user knows to
     contact them another way.
7. For each draft, produce:
   - A `To:` line with the email address.
   - A `Subject:` line of the form
     `Friendly reminder: <N> overdue invoice(s) totaling <AMOUNT> <CURRENCY>`.
   - A body using the template below, with every placeholder filled in
     from real data.

## Draft body template

```
Hi <first_name or contact name>,

I hope you are well. Our records show the following invoice(s) are now
past their due date:

  - Invoice <number>: <amount> <currency>, due <due_date> (<days_late> days late)
  - ...

Could you let me know when we can expect payment, or flag any issue with
the invoice so we can sort it out? Happy to resend copies if that helps.

Thanks,
```

The signature line is intentionally blank - the user fills in their own
name when they copy the draft.

## Rules

- **Never claim the message has been sent.** Always present output as a
  draft. The plugin has no email capability.
- Every figure in every draft must come from the `list-invoices` response
  in this turn. Use the `currency_code` returned by Xero.
- Tone: polite, firm, professional. No guilt-tripping, no threats, no
  emojis.
- If a contact's only contact method is phone or post, do not invent an
  email; put them in the "No email on file" list.
- If no invoices are overdue, say exactly:
  `Nothing to chase - no overdue invoices found.` and stop.

## When to use

Trigger on requests like "chase overdue customers", "draft follow-up
emails", "remind people who owe us money", "write reminder emails". If
the user only wants a list without drafts, prefer `/xero:overdue`.
