---
name: whatsapp-messaging
description: Send and manage WhatsApp customer messages using send_text, send_template, list_templates, mark_read and download_media. Use when the user asks to message, reply to, or follow up with a customer on WhatsApp.
---

# Message customers on WhatsApp

## What this covers

WhatsApp Business messages go to real customers from the business's own number, and Meta bills template messages to the business. Treat every send as customer-visible and, for templates, as a cost.

## The 24-hour rule

- A customer's inbound message opens a 24-hour window.
- Inside the window, use `send_text` for free-form replies.
- Outside the window, `send_text` fails with Meta error `131047`. Use `send_template` with an approved template instead. Templates are billed by Meta.
- If you do not know whether the window is open, check the time of the customer's last inbound message. If it is more than 24 hours ago or unknown, plan on a template.

## Choosing a template

1. Call `list_templates` and only consider templates with status `APPROVED`.
2. Match the template's language to the customer, and fill every variable in `components`.
3. If no approved template fits, tell the user. Do not invent a template name or send a near match that changes the meaning.

## Before you send

- Always show the user the exact recipient, the message text (or template name and filled variables), and whether it is billable, then wait for an explicit yes. Never send to a customer without that confirmation.
- Use E.164 digits with the country code (`61400000999`), not local `04...` formats.
- Never promise the customer an unattended or automatic reply, a response time, or that anyone is monitoring the conversation. Do not write messages such as "we will reply within the hour" unless the user states it.

## Uncertain sends: never retry

- If a send returns `deliveryUnknown: true`, or the outcome is `sent-not-recorded`, the message may already have reached the customer. Do not retry or resend, and do not try a different send tool as a workaround. Tell the user the delivery is unknown and let them check the conversation.
- Only a clear failure that states the message was not sent (for example a validation error before any Meta call) may be corrected and re-attempted, and only after confirming with the user again.
- If a tool returns `needsReconnect`, stop and tell the user a tenant admin must reconnect WhatsApp.

## Reading

- `mark_read` after the user has handled an inbound message.
- `download_media` for attachments; if it returns `tooLarge`, tell the user the file exceeds 25 MB.
