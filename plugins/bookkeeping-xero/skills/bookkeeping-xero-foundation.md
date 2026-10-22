---
name: bookkeeping-xero-foundation
description: How the Bookkeeping for Xero extension stores its settings, client folders, bill records, ledger checks findings and WorkQ items, and how to answer status, explain, exception, check finding and client-email questions safely. Use before any bookkeeping, supplier bill, bill review, AP status, ledger check or client query task.
---

# Bookkeeping for Xero: how it works

Use when someone asks about supplier bills, bill reviews, exceptions, ledger checks findings, what's waiting for a client, or asks you to draft a client email about a bill.

## Where things live (Knowledge, org level)

| Path | What it is |
|---|---|
| `Bookkeeping/settings.json` | Practice settings: `mode`, `timezone`, `reviewer_id`, `exceptions_owner_id`, `digest_recipient_ids`, `approved_status` (`SUBMITTED` = awaiting approval, `AUTHORISED` = approved), `auto_approve_below`, `client_approval_above`, `checks_owner_id` (who follows up ledger checks findings) |
| `Bookkeeping/Clients/<client>.json` | One file per client business: `name`, `slug`, **`xero_tenant_id`**, `xero_org_name`, `gst_registered`, `reviewer_id`, `client_approval_above`, `contact_name`, `contact_email`, `notes` (coding notes), `checks_enabled`, `checks_owner_id`, `tpar` (lodges a TPAR), `suspense_codes` |
| `Bookkeeping/Rules/<client>.json` | Saved coding rules: `suppliers` (bills) and `customers` (sales invoices), each keyed by Xero ContactID and by `name:<normalised name>` → `account_code`, `tax_type` |
| `Bookkeeping/Bills/<review item id>.json` | One record per bill or sales invoice (`proposal.doc_type` is `ACCPAY` for a bill, `ACCREC` for a sales invoice): `status` (`in_review`, `awaiting_client`, `waiting_client`, `approved`, `rejected`, `auto_approved`; a *Which client is this for?* item's record is `needs_client`, then `filed`, `not_ours` or `asked_again`, with `needs` saying who it's addressed to and `file` where the PDF waits), `bill_id` (Xero InvoiceID), `proposal` (supplier, dates, lines with `account_code`, `tax_type`, `source`, `reason`, `confidence`), `warnings`, `blocking`, `checks` (catalogue IDs of the intake checks raised, also tagged `[CHK-…]` at the end of each warning), `file`, `history`. A record with only `link` points to the original record. |
| `Bookkeeping Inbox/<client>/` | Drop bill PDFs here. Each new PDF is processed automatically. Email intake saves emailed bills here too (file names start with the date and a short tag). |
| `Bookkeeping/Mail/<outlook, outlook-shared, hotmail or gmail>.json` | Email intake's ledger: every email it has looked at (`seen`, with the outcome: `filed`, `unmatched`, `not_a_bill`, `no_attachment`, `nothing_filed`, `failed`) and where each folder carries on from (`cursors`). |
| `Bookkeeping/Mail/origins.json` | Where each emailed document came from, by file name (`from`, `subject`, `received`, `mailbox`, `why` it went to that client and `how`: `matched`, `folder`, `only client` or `decided`). Process bill shows it on the review item. |
| `Bookkeeping/Mail/routing.json` | What email intake has learned: `names` (a name a document was addressed to, mapped to the client slug, taught by filing an unmatched document) and `senders` (sender to the clients their documents were for). `unmatched.json` lists documents still waiting for a client. |
| `Bookkeeping Split/<client>/` | Parts of a PDF that held several invoices or statements, on their way into the client's inbox folder (*File split documents* moves them). |
| `Bookkeeping Failed/unmatched/` | Emailed bills that couldn't be matched to a client |
| `Bookkeeping/Payroll/<client>.json` | Payroll settings: `calendar` (Xero pay calendar name), `prep_day`, `prep_time`, `timesheets` (`deputy`, `xero`, `emailed`, `none`), `ts_owner`, `ts_email`, `officer_id`, `reviewer_id`, `approvers`, `who_posts` (`client` or `practice`) |
| `Bookkeeping/PayRuns/<client>-<period start>.json` | One record per pay run: `status` (`open`, `checked`, `in_review`, `changes`, `client_approval`, `approved`, `done`, `cancelled`), `period_start`, `period_end`, `payment_date`, `item_id`, `last_check` (`open_items`, `summary`, `changes`, `url`), `notes`, `pack_url`. A file named after a WorkQ item id holds only `link` |
| `Bookkeeping Payroll/<client>/` | The client's `pay-guide.xlsx` (rates, employees, rules, holidays, pay_items) and each period's reimbursement spreadsheet |
| `Bookkeeping/Statements/<client>.json` | Every statement filed: `kind` (bank, supplier, customer), `filed_to` (the bank account or contact in Xero), `period`, `closing_balance`, `issues` (balance or invoice differences), `problem` |
| `Bookkeeping Requests/<client>/` | Invoice requests Email intake filed (`from`, `subject`, `received`, `text`). Each new file is drafted by *Draft requested invoice*, then moved to `Bookkeeping Processed/<client>/` |
| `Bookkeeping/Checks/<client>.json` | The client's ledger checks findings file: `todo_id` (its open Checks item), `findings` keyed by `<CHK id>:<record ids>`, each with `check`, `name`, `category`, `severity`, `amount`, `text`, `link`, `status` (`open`, `dismissed`, `snoozed`), `first_seen`, `last_seen`; `dismissed` and `snoozed` (who, when, note, snooze `until`); `last_daily`, `last_weekly`; `snapshot` (keyed fingerprints of contact bank details, never the numbers; the lock date) |
| `Bookkeeping/Checks/<client>-intake.json` | What Process bill's intake checks remember: file fingerprints, ABNs seen per supplier, and sales invoices it captured |
| `Bookkeeping/Checks/<client>-abr.json` | What *Register lookups (ABR)* last found on the Australian Business Register for the client's ABNs (`abns`: status, cancelled date, GST from/to, DGR) and name searches for suppliers with no ABN (`names`), with `refreshed` |
| `Bookkeeping/Checks/_items.json`, `_report.json`, `_key.json` | Which Checks item belongs to which client; when the weekly report was last published; the key for the bank-detail fingerprints (never quote or change it) |
| `Bookkeeping Processed/<client>/` | PDFs that became review items |
| `Bookkeeping Failed/<client>/` | PDFs that became exception items |

## WorkQ labels

Every item has `bookkeeping` plus one of: `bill-review` (review a bill), `invoice-review` (review a sales invoice the client issued), `invoice-request` (approve an invoice raised from a client's request; `proposal.origin` is `request`), `bill-exception` (something went wrong), `client-approval` (get the business owner's OK), `client-query` (ask the client a question), `setup`, `payroll` (a pay run), `payroll-review` (internal review of a pay run), `payroll-approval` (record the client's approval), `statement-check` (a filed statement that doesn't agree with Xero), `checks` (the client's ledger checks item: one open item per client, titled `Checks: <client>`). Exceptions from email intake also carry `email-intake`. The client's slug is also a label, so filter by it to answer "what's waiting for <client>".

## Answering questions

1. **Find the client**: list `Bookkeeping/Clients/` and match the name. If two match or none does, ask.
2. **Xero calls**: always pass `xero_tenant_id` from the client's file. Bills are `list_invoices` with `where: Type=="ACCPAY"`; sales invoices are `Type=="ACCREC"` (awaiting payment is `Status=="AUTHORISED"`). Put the status **inside the same `where`**, never in `statuses` alongside `where`, because Xero silently returns nothing for that combination. For example: `where: Type=="ACCPAY" AND Status=="DRAFT"` (drafts waiting for review), `…Status=="SUBMITTED"` (awaiting approval), `…Status=="AUTHORISED"` (approved; unpaid when `AmountDue > 0`). Query one status at a time.
3. **"Why was this coded like that?"**: read the bill record. `source` is `rule` (a saved rule for this supplier), `history` (the supplier's recent bills), `ai` (suggested from the chart of accounts), or `reviewer` (changed in review). Quote the `reason`.
4. **Exceptions**: the item description holds the problem. Common fixes:
   - *No client settings for the folder*: run **Bookkeeping: Start setup** with the business name and submit its settings form, then move the PDF into the folder it names.
   - *No readable text* or *the AI couldn't read the image*: key it by hand.
   - *Several invoices in one PDF*: PDFs of up to 20 pages are split automatically; a longer one must be split by hand and each part dropped back into the inbox.
   - *An iPhone photo in Apple's HEIC format*: email it to the bookkeeping inbox (email intake converts it) or save it as JPEG and drop it in again.
   - *Bill with nothing to read attached* (email intake): the email only links to the bill online, or attaches a Word or Excel file. Download the bill as a PDF and drop it into the client's inbox folder.
   - *Check this email* (email intake): it looked like a bill, but none of its attachments did (or a photo couldn't be converted). Look at the email and drop the bill in by hand if there is one.
   - *Which client is this bill for?* (email intake): the AI couldn't tell who the bill is addressed to. Ask which client, then upload the PDF from `Bookkeeping Failed/unmatched/` into that client's inbox folder.
   - *Did an email come through?*: look it up in `Bookkeeping/Mail/<outlook or gmail>.json`. An email marked `not_a_bill` was judged not to be a bill and left in the mailbox as it was.
   - *Duplicate*: the bill is already in Xero; complete the item.
   - *Xero didn't accept the bill*: quote the Xero error. A locked period or an archived account are common causes.
5. **Ledger checks findings** ("why is Acme flagged?", "what's open in checks for Bayview?"): read `Bookkeeping/Checks/<client>.json`. Each line on a Checks item is `severity — CHK-id name — $ at risk — what was found [Open in Xero] · ref`. Explain the finding from its `text` and `link`, and the fix: change it in Xero (it drops off on the next check), or, when it isn't a problem, tick its line on the item (hidden until its details change) or use the **Check findings** form to snooze it. Fraud and duplicate checks run every night; GST, attachment, reconciliation, lock date and housekeeping checks weekly. Severities are the checks catalogue's defaults. Register checks (cancelled ABNs, GST registration, DGR) come from `Bookkeeping/Checks/<client>-abr.json`; quote the register date. CHK-003, CHK-005, CHK-009, CHK-056, CHK-129 and CHK-133 are heuristic readings still to be confirmed, so say so. Bank details are never stored: if asked what an account changed to, point to the contact in Xero.
6. **Client emails**: draft them for the bookkeeper to send. Use the client's `contact_name`, the supplier, invoice number and total from the record. Never send anything yourself.

## Never

- Approve, authorise, delete or void bills, or change coding in Xero. Decisions go through the **Bill review** form on the item.
- Use Xero without `xero_tenant_id` for client work.
- Mix clients: one client's numbers never go into another client's item or conversation.
- Edit a Checks item's description by hand or the files under `Bookkeeping/Checks/`: the automation rewrites the item each run, and dismissals go through a tick or the Check findings form.
