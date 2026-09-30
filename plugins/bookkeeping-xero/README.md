# Bookkeeping for Xero

Supplier bills and sales invoices from email or PDF into Xero, for bookkeeping practices that keep the books for many client businesses. **Invoice capture** records the sales invoices a client issued outside Xero (Word, Excel, a job app) as *Awaiting payment*, without emailing the customer again. Bills arriving in the bookkeeper's Outlook or Gmail inbox are picked out by AI and filed under the right client, or you can drop a PDF into a client's inbox folder. Each bill is read, checked and coded. It's created as a draft bill in **that client's own Xero organisation**, with the PDF attached, and sent to the reviewer in WorkQ. The reviewer's decision is applied in Xero, and coding corrections are remembered for next time. A weekly digest shows what's waiting for each client.

> Generated from `bookkeeping-kit` (gen-ext.js). Change the kit source and regenerate; don't hand-edit these files.

## What's in the box

- **Connector:** `xero-accounting` (the mySMB Xero connector). Email intake uses `m365-mail-read` (Microsoft 365 extension) or `google-workspace-gmail` (Google Workspace extension).
- **Automations (7):**
  - *Bookkeeping: Start setup* (run by hand): creates the setup items.
  - *Bookkeeping: Apply setup (Xero)*: saves the setup answers and matches each client to its Xero organisation.
  - *Bookkeeping: Process bill or invoice (Xero)*: runs when a PDF lands in `Bookkeeping Inbox/<client>/`. It works out whether it's a supplier bill (addressed to the client) or a sales invoice (issued by the client, matched on the client's Xero organisation name and ABN).
  - *Bookkeeping: Apply bill or invoice review (Xero)*: runs when a Bill review, Invoice review or Client bill approval form is submitted.
  - *Bookkeeping: Weekly AP digest (Xero)*: Mondays at 8am.
  - *Bookkeeping: Email intake (Outlook)* and *Bookkeeping: Email intake (Gmail)*: every 15 minutes, read the owner's inbox, have AI pick out supplier bills (emails with a PDF that is a bill to pay), work out which client each bill is addressed to, and save it into that client's `Bookkeeping Inbox/<client>/` folder. Other emails are left untouched: nothing in the mailbox is changed. Bills it can't place with a client become exception items. Publish the one(s) for the mailbox you use.
- **Forms (5):** Bookkeeping setup, Client bookkeeping settings, Bill review, Invoice review, Client bill approval.
- **Agent (1):** Bookkeeping Coordinator (Xero). It answers status questions, explains coding and exceptions, drafts client emails, and can build a live Aged Payables, Purchases Overview, Exceptions Dashboard or GST Reconciliation Detail report on request. It never approves or sends anything.
- **Skill (1):** `bookkeeping-xero-foundation`. Also reuses four report skills from `xero-reporting-studio` (`xero-report-foundation`, `xero-aged-payables`, `xero-purchases-overview`, `xero-exceptions-dashboard`, `xero-gst-reconciliation-detail`) — **`xero-reporting-studio` must be installed on the same workspace** for these to resolve; without it, the agent simply won't have them available.

## Configuration

No configuration variables are required. Settings are collected by the setup forms and stored in Knowledge (`Bookkeeping/settings.json`, `Bookkeeping/Clients/<client>.json`).

**Requires** `myhub-mcp-servers` with `xero_tenant_id` support on write tools (PR #558). Without it, every bill is written to the connection's default Xero organisation. Email intake also needs the mail attachment tools (`list_email_attachments` / `get_email_attachment` for Outlook, `get_attachment` for Gmail).

## After installing

1. **Automations are on** for the workspace (`features.automations`).
2. **Connect Xero** as the person who will own the automations. Use a Xero login that can see every client organisation. The automations run as that person and use their Xero connection.
3. **Publish the four forms** in Forms (they install as drafts).
4. **Publish the automations.** They install as drafts; publishing shows the permissions each one asks for. Publish *Start setup* and *Apply setup (Xero)* first.
5. **Run *Bookkeeping: Start setup*** and fill in the Bookkeeping setup form on the item it creates.
6. **Run it again with your client business names** (one per line), and fill in each client's settings form. Enter the Xero organisation name exactly as it appears in Xero.
7. **Publish** *Process bill or invoice*, *Apply bill or invoice review* and *Weekly AP digest*.
8. **For bills by email:** install the Microsoft 365 or Google Workspace extension, connect Outlook or Gmail as the automations' owner, and publish *Email intake (Outlook)* or *Email intake (Gmail)*. The first run looks back 24 hours.
9. **Try it:** email a supplier bill PDF to that inbox, or drop one into `Bookkeeping Inbox/<client>/` in Knowledge.

After every extension update, publish the updated automation drafts again. Updates arrive as drafts, and the previous version keeps running until you do.

## How a bill flows

1. **Read:** the PDF's text is read and AI extracts the supplier, ABN, invoice number, dates, lines, GST and total. Scanned PDFs and photos can't be read yet; they become exception items.
2. **Check:** totals, GST at 10%, the ABN checksum, and duplicates (same supplier and invoice number already in Xero).
3. **Code:** a saved rule for the supplier comes first, then the supplier's recent bills in Xero, then an AI suggestion from the chart of accounts. Every line shows where its coding came from.
4. **Draft:** a DRAFT bill is created in the client's Xero organisation with the PDF attached. For new suppliers, the contact and bill are only created once the bill is approved.
5. **Review:** the reviewer gets a WorkQ item with the Bill review form and chooses Approve, Approve with changes (in plain words, e.g. "line 1 account 449"), Reject, or Ask the client.
6. **Apply:** approved bills become *Awaiting approval* or *Approved* in Xero (you choose in setup). Rejected drafts are deleted. Bills over the client-approval limit get a follow-up item with a draft email for the business owner; the bookkeeper records the reply in the Client bill approval form. Clients never need Workspace access.
7. **Learn:** coding changes (or "Remember this coding") are saved as a rule for that supplier.

Small bills from known suppliers can skip review when the AI is fully confident and the setup allows it (the skip-review amount is 0 by default, so everything is reviewed).

## How a sales invoice flows (invoice capture)

The same inbox, the same steps, the other side of the ledger:

1. **Direction:** a PDF issued by the client (its Xero organisation's name, legal name or ABN at the top) is a sales invoice; the customer it's addressed to becomes the Xero contact.
2. **Check:** totals, GST and the ABN, plus duplicates: a sales invoice number already used anywhere in the organisation. An invoice that says it's paid is flagged, so the payment is matched in bank reconciliation, not recorded twice.
3. **Code:** a saved rule for the customer, then the customer's recent invoices in Xero, then AI from the **revenue** accounts with GST on income.
4. **Review:** always, on the **Invoice review** form. The client-approval limit is for spending, so it doesn't apply.
5. **Apply:** approved sales invoices are **Awaiting payment** in Xero, with the PDF attached. Nothing is emailed to the customer; they already have the invoice.

## Limits

- One Xero connection covers all clients. The connection owner's Xero login must include every client organisation. If an organisation is added later, reconnect Xero.
- One invoice per PDF. Credit notes, statements and receipts are sent to exceptions.
- Invoice capture records invoices that were already issued. Raising and sending new invoices from a client's request is not built yet.
