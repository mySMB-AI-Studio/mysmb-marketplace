# Bookkeeping for Xero

Supplier bills and sales invoices from email or PDF into Xero, for bookkeeping practices that keep the books for many client businesses. **Invoice capture** records the sales invoices a client issued outside Xero (Word, Excel, a job app) as *Awaiting payment*, without emailing the customer again. And when a client asks for an invoice to be raised ("please invoice Bayview for September"), it's drafted in Xero, approved in WorkQ and, if the reviewer says so, emailed to the customer by Xero. Bills arriving in the bookkeeper's Outlook or Gmail inbox are picked out by AI and filed under the right client, or you can drop a PDF into a client's inbox folder. Each bill is read, checked and coded. It's created as a draft bill in **that client's own Xero organisation**, with the PDF attached, and sent to the reviewer in WorkQ. The reviewer's decision is applied in Xero, and coding corrections are remembered for next time. A weekly digest shows what's waiting for each client.

> Generated from `bookkeeping-kit` (gen-ext.js). Change the kit source and regenerate; don't hand-edit these files.

## What's in the box

- **Connector:** `xero-accounting` (the mySMB Xero connector). Email intake uses `m365-mail-read` (Microsoft 365 extension) or `google-workspace-gmail` (Google Workspace extension).
- **Automations (13):**
  - *Bookkeeping: Start setup* (run by hand): creates the setup items.
  - *Bookkeeping: Apply setup (Xero)*: saves the setup answers and matches each client to its Xero organisation.
  - *Bookkeeping: Process bill, invoice or statement (Xero)*: runs when a PDF lands in `Bookkeeping Inbox/<client>/`.
    - **Supplier bill** (addressed to the client) or **sales invoice** (issued by the client, matched on its Xero organisation name and ABN): checked, coded and sent for review.
    - **Bank or credit card statement:** attached to its bank account in Xero (matched on the last four digits of the account or card, then the name). If Xero's balance at the period end already matches, that's all. Otherwise the transactions are read off the PDF and, when they add up from the opening to the closing balance, saved as a CSV in Xero's statement import format (`Bookkeeping Processed/<client>/`, also attached in Xero) with a WorkQ item to upload it (Bank accounts, Import a Statement, date format dd/mm/yyyy). Xero only lets bank feeds add statement lines directly, so that upload stays manual.
    - **Statement of account:** attached to the supplier or customer in Xero, with the amount owing and the listed invoices compared with what Xero shows open.
    - Statements are logged in `Bookkeeping/Statements/<client>.json`; a WorkQ item appears only for differences, an unknown account or contact, or an unreadable file.
  - *Bookkeeping: Apply bill or invoice review (Xero)*: runs when a Bill review, Invoice review or Client bill approval form is submitted.
  - *Bookkeeping: Draft requested invoice (Xero)*: runs when Email intake files a request in `Bookkeeping Requests/<client>/`, or by hand with the client's name and the request text (a phone request, say).
  - *Bookkeeping: Weekly AP digest (Xero)*: Mondays at 8am.
  - **Payroll** (Xero Payroll AU; reads only, so nothing in Xero Payroll changes without the payroll officer):
    - *Bookkeeping: Start pay runs (Xero Payroll)*: hourly on weekdays. Opens each client's pay run item on its preparation day, says when the timesheets are in Xero, and drafts a chase when Deputy timesheets are late.
    - *Bookkeeping: Check pay run (Xero Payroll + Deputy)* or *(Xero Payroll)*: publish one. Runs from the pay run item's form and lists:
      - Deputy vs Xero hours per employee per day;
      - missing starters;
      - salaried staff with timesheets;
      - penalty bands (early, late, Saturday, Sunday, public holiday, overtime) worked out from shift times;
      - rates against the client's pay guide;
      - this period's changes (junior birthdays, special arrangements ending, 1 July);
      - reimbursements against the draft pay run.

      Then it posts a report and one drafted query email.
    - *Bookkeeping: Build payroll review pack (Xero Payroll)*: the draft pay run's totals and payslips, the last check, the changes and the notes, sent to the internal reviewer.
    - *Bookkeeping: Apply payroll review*: internal approval → client approval item with a drafted email → done (or "post it" when the practice posts).
  - *Bookkeeping: Email intake (Outlook)* and *Bookkeeping: Email intake (Gmail)*: every 15 minutes, read the owner's inbox, have AI pick out supplier bills (emails with a PDF that is a bill to pay), work out which client each bill is addressed to, and save it into that client's `Bookkeeping Inbox/<client>/` folder. Other emails are left untouched: nothing in the mailbox is changed. Bills it can't place with a client become exception items. Publish the one(s) for the mailbox you use.
- **Forms (10):** Bookkeeping setup, Client bookkeeping settings, Bill review, Invoice review, Invoice to send, Client bill approval, Client payroll settings, Pay run, Payroll review, Client payroll approval.
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

## How a pay run flows

1. **Settings:** run *Start setup* with the business under *Client businesses to set up payroll for*. Fill in its **Client payroll settings**:
   - the pay calendar's name in Xero Payroll;
   - the preparation day and time;
   - where the hours come from;
   - the timesheet owner;
   - the payroll officer and the internal reviewer;
   - the client approvers;
   - who posts.

   A pay guide template appears in `Bookkeeping Payroll/<client>/pay-guide.xlsx`.
2. **Pay guide:** fill in its sheets and replace the EXAMPLE rows. The guide is the client's own rate sheet, from the Fair Work pay guides:
   - `rates`: award, classification, employment type, age range, band, rate and effective date;
   - `employees`: each employee's award, classification, state and any special arrangement with its end date;
   - `rules`: when the day starts and ends, and the daily overtime threshold and first-hours band;
   - `holidays`: public holidays by state;
   - `pay_items`: which band each Xero earnings rate pays.
3. **Pay run item:** opens on the preparation day, in the week of the pay day. When the timesheets are in Xero Payroll it says so; if Deputy timesheets are late it drafts a chase.
4. **Check:** choose *Run the checks* on the Pay run form, fix what the report lists in Xero Payroll, and run it again. Drop the period's reimbursement spreadsheet (*expense* or *reimburs* in the name) into `Bookkeeping Payroll/<client>/` first.
5. **Review pack:** choose *Ready for review* once the draft pay run is in Xero. The internal reviewer gets the pack and the **Payroll review** form.
6. **Client approval:** an approved review creates the client approval item with a drafted email. Record the answer on the **Client payroll approval** form. If the client posts the pay run, the pay run item completes; if the practice posts it, the item stays open until you post and file STP.

## How an invoice request flows

1. **Triage:** Email intake reads every new email, with or without attachments. A client asking the bookkeeper to raise an invoice is an *invoice request*.
2. **Client:** the sender's address is matched to each client's contact email in its settings; otherwise AI works it out, and an unclear one becomes a *Which client is this invoice request from?* item.
3. **Draft:** AI reads the customer and lines. Each line is priced from what the request says, then the matching Xero item; a line with no price must be priced by the reviewer. Coding comes from the Xero item, a saved customer rule, the customer's history, then AI over revenue accounts. An existing customer gets a DRAFT in Xero straight away (with its invoice number); a new customer's contact and invoice wait for approval.
4. **Approve:** the reviewer gets an *Invoice to raise* item with the request quoted and the **Invoice to send** form, including **"Once it's approved, should Xero email it to the customer?"**.
5. **Apply:** approved invoices are **Awaiting payment**. Xero emails the invoice to the contact's email address only when the reviewer ticked *yes*; otherwise send it from Xero when you're ready.

## Limits

- One Xero connection covers all clients. The connection owner's Xero login must include every client organisation. If an organisation is added later, reconnect Xero.
- One invoice per PDF. Credit notes, statements and receipts are sent to exceptions.
- Payroll checks read Xero Payroll AU and Deputy only; the officer makes every correction. Deputy is one connection per client business. Penalty rules beyond the day start/end, weekends, public holidays and a daily overtime threshold are not modelled yet.
- Gmail requests are read from the email's snippet (the first couple of lines): the Gmail connector doesn't return the full body. Outlook requests are read in full.
- A raised invoice uses the organisation's default branding theme and invoice numbering, and Xero's standard email template when it's emailed.
