---
name: bookkeeping-xero-foundation
description: How the Bookkeeping for Xero extension stores its settings, client folders, bill records and WorkQ items, and how to answer status, explain, exception and client-email questions safely. Use before any bookkeeping, supplier bill, bill review, AP status or client query task.
---

# Bookkeeping for Xero: how it works

Use when someone asks about supplier bills, bill reviews, exceptions, what's waiting for a client, or asks you to draft a client email about a bill.

## Where things live (Knowledge, org level)

| Path | What it is |
|---|---|
| `Bookkeeping/settings.json` | Practice settings: `mode`, `timezone`, `reviewer_id`, `exceptions_owner_id`, `digest_recipient_ids`, `approved_status` (`SUBMITTED` = awaiting approval, `AUTHORISED` = approved), `auto_approve_below`, `client_approval_above` |
| `Bookkeeping/Clients/<client>.json` | One file per client business: `name`, `slug`, **`xero_tenant_id`**, `xero_org_name`, `gst_registered`, `reviewer_id`, `client_approval_above`, `contact_name`, `contact_email`, `notes` (coding notes) |
| `Bookkeeping/Rules/<client>.json` | Saved coding rules: `suppliers` (bills) and `customers` (sales invoices), each keyed by Xero ContactID and by `name:<normalised name>` → `account_code`, `tax_type` |
| `Bookkeeping/Bills/<review item id>.json` | One record per bill or sales invoice (`proposal.doc_type` is `ACCPAY` for a bill, `ACCREC` for a sales invoice): `status` (`in_review`, `awaiting_client`, `waiting_client`, `approved`, `rejected`, `auto_approved`), `bill_id` (Xero InvoiceID), `proposal` (supplier, dates, lines with `account_code`, `tax_type`, `source`, `reason`, `confidence`), `warnings`, `blocking`, `file`, `history`. A record with only `link` points to the original record. |
| `Bookkeeping Inbox/<client>/` | Drop bill PDFs here. Each new PDF is processed automatically. Email intake saves emailed bills here too (file names start with the date and a short tag). |
| `Bookkeeping/Mail/<outlook or gmail>.json` | Email intake's ledger: every email it has looked at (`seen`, with the outcome: `filed`, `unmatched`, `not_a_bill`, `no_pdf`, `failed`) and when intake started (`since`). |
| `Bookkeeping Failed/unmatched/` | Emailed bills that couldn't be matched to a client |
| `Bookkeeping Processed/<client>/` | PDFs that became review items |
| `Bookkeeping Failed/<client>/` | PDFs that became exception items |

## WorkQ labels

Every item has `bookkeeping` plus one of: `bill-review` (review a bill), `invoice-review` (review a sales invoice the client issued), `bill-exception` (something went wrong), `client-approval` (get the business owner's OK), `client-query` (ask the client a question), `setup`. Exceptions from email intake also carry `email-intake`. The client's slug is also a label, so filter by it to answer "what's waiting for <client>".

## Answering questions

1. **Find the client**: list `Bookkeeping/Clients/` and match the name. If two match or none does, ask.
2. **Xero calls**: always pass `xero_tenant_id` from the client's file. Bills are `list_invoices` with `where: Type=="ACCPAY"`; sales invoices are `Type=="ACCREC"` (awaiting payment is `Status=="AUTHORISED"`). Put the status **inside the same `where`**, never in `statuses` alongside `where`, because Xero silently returns nothing for that combination. For example: `where: Type=="ACCPAY" AND Status=="DRAFT"` (drafts waiting for review), `…Status=="SUBMITTED"` (awaiting approval), `…Status=="AUTHORISED"` (approved; unpaid when `AmountDue > 0`). Query one status at a time.
3. **"Why was this coded like that?"**: read the bill record. `source` is `rule` (a saved rule for this supplier), `history` (the supplier's recent bills), `ai` (suggested from the chart of accounts), or `reviewer` (changed in review). Quote the `reason`.
4. **Exceptions**: the item description holds the problem. Common fixes:
   - *No client settings for the folder*: run **Bookkeeping: Start setup** with the business name and submit its settings form, then move the PDF into the folder it names.
   - *No readable text*: it's a scan or photo. Key it by hand; the automation can't read scans yet.
   - *Several invoices in one PDF*: split it and drop each back into the inbox.
   - *Which client is this bill for?* (email intake): the AI couldn't tell who the bill is addressed to. Ask which client, then upload the PDF from `Bookkeeping Failed/unmatched/` into that client's inbox folder.
   - *Did an email come through?*: look it up in `Bookkeeping/Mail/<outlook or gmail>.json`. An email marked `not_a_bill` was judged not to be a bill and left in the mailbox as it was.
   - *Duplicate*: the bill is already in Xero; complete the item.
   - *Xero didn't accept the bill*: quote the Xero error. A locked period or an archived account are common causes.
5. **Client emails**: draft them for the bookkeeper to send. Use the client's `contact_name`, the supplier, invoice number and total from the record. Never send anything yourself.

## Never

- Approve, authorise, delete or void bills, or change coding in Xero. Decisions go through the **Bill review** form on the item.
- Use Xero without `xero_tenant_id` for client work.
- Mix clients: one client's numbers never go into another client's item or conversation.
