# Bookkeeping for Xero

Supplier bills and sales invoices from email or PDF into Xero, for bookkeeping practices that keep the books for many client businesses. **Invoice capture** records the sales invoices a client issued outside Xero (Word, Excel, a job app) as *Awaiting payment*, without emailing the customer again. And when a client asks for an invoice to be raised ("please invoice Bayview for September"), it's drafted in Xero, approved in WorkQ and, if the reviewer says so, emailed to the customer by Xero. Bills arriving in the bookkeeper's Outlook or Gmail inbox are picked out by AI and filed under the right client, or you can drop a PDF (or a photo of a bill) into a client's inbox folder. Each bill is read, checked and coded. It's created as a draft bill in **that client's own Xero organisation**, with the PDF attached, and sent to the reviewer in WorkQ. The reviewer's decision is applied in Xero, and coding corrections are remembered for next time. A weekly digest shows what's waiting for each client, and overnight **ledger checks** look over each client's whole Xero file, however the entries got there, and keep one WorkQ checklist per client of what needs fixing.

> Generated from `scripts/bookkeeping-kit` in this repo (gen-ext.js). Change the kit source and regenerate; don't hand-edit these files.

## What's in the box

- **Connector:** `xero-accounting` (the mySMB Xero connector). Email intake uses `m365-mail-read` (Microsoft 365 extension) or `google-workspace-gmail` (Google Workspace extension).
- **Automations (14):**
  - *Bookkeeping: Start setup* (run by hand): creates the setup items.
  - *Bookkeeping: Apply setup (Xero)*: saves the setup answers and matches each client to its Xero organisation.
  - *Bookkeeping: Process bill, invoice or statement (Xero)*: runs when a PDF lands in `Bookkeeping Inbox/<client>/`. A PDF dropped into `Bookkeeping Inbox` itself is matched to its client by AI (with one client, it's that client); if that isn't clear, it waits in `Bookkeeping Failed/unmatched/` with a *Which client is this for?* item.
    - **Supplier bill** (addressed to the client) or **sales invoice** (issued by the client, matched on its Xero organisation name and ABN): checked, coded and sent for review.
    - **Bank or credit card statement:** attached to its bank account in Xero (matched on the last four digits of the account or card, then the name). If Xero's balance at the period end already matches, that's all. Otherwise the transactions are read off the PDF and, when they add up from the opening to the closing balance, saved as a CSV in Xero's statement import format (`Bookkeeping Processed/<client>/`, also attached in Xero) with a WorkQ item to upload it (Bank accounts, Import a Statement, date format dd/mm/yyyy). Xero only lets bank feeds add statement lines directly, so that upload stays manual.
    - **Statement of account:** attached to the supplier or customer in Xero, with the amount owing and the listed invoices compared with what Xero shows open.
    - Statements are logged in `Bookkeeping/Statements/<client>.json`; a WorkQ item appears only for differences, an unknown account or contact, or an unreadable file.
  - *Bookkeeping: Apply bill or invoice review (Xero)*: runs when a Bill review, Invoice review or Client bill approval form is submitted.
  - *Bookkeeping: Draft requested invoice (Xero)*: runs when Email intake files a request in `Bookkeeping Requests/<client>/`, or by hand with the client's name and the request text (a phone request, say).
  - *Bookkeeping: Weekly AP digest (Xero)*: Mondays at 8am.
  - *Bookkeeping: Ledger checks (Xero)*: every 30 minutes from midnight to 5:30am, checking each client once a day (see *How the ledger checks work*). Also runs when a Check findings form is submitted, or by hand with a client's name to check it now.
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
  - *Bookkeeping: Email intake (Outlook)* and *Bookkeeping: Email intake (Gmail)*: every 15 minutes, read the owner's inbox, have AI pick out supplier bills (emails with a PDF, or a photo of one, that is a bill to pay), work out which client each bill is addressed to, and save it into that client's `Bookkeeping Inbox/<client>/` folder. Other emails are left untouched: nothing in the mailbox is changed. Bills it can't place with a client become exception items. An email moved out of the inbox and back isn't filed again (Outlook gives it a new id, so it's recognised by its sender, subject and time received). Publish the one(s) for the mailbox you use.
- **Forms (11):** Bookkeeping setup, Client bookkeeping settings, Bill review, Invoice review, Invoice to send, Client bill approval, Client payroll settings, Pay run, Payroll review, Client payroll approval, Check findings.
- **Agent (1):** Bookkeeping Coordinator (Xero). It answers status questions, explains coding and exceptions, drafts client emails, and can build a live Aged Payables, Purchases Overview, Exceptions Dashboard or GST Reconciliation Detail report on request. It never approves or sends anything.
- **Skill (1):** `bookkeeping-xero-foundation`. Also reuses four report skills from `xero-reporting-studio` (`xero-report-foundation`, `xero-aged-payables`, `xero-purchases-overview`, `xero-exceptions-dashboard`, `xero-gst-reconciliation-detail`) — **`xero-reporting-studio` must be installed on the same workspace** for these to resolve; without it, the agent simply won't have them available.

## Configuration

No configuration variables are required. Settings are collected by the setup forms and stored in Knowledge (`Bookkeeping/settings.json`, `Bookkeeping/Clients/<client>.json`).

**Requires** `myhub-mcp-servers` with `xero_tenant_id` support on write tools (PR #558). Without it, every bill is written to the connection's default Xero organisation. Email intake also needs the mail attachment tools (`list_email_attachments` / `get_email_attachment` for Outlook, `get_attachment` for Gmail). Reading scanned PDFs and photos needs the myHubV2 version where `api.ai` accepts a file (myHubV2 #1769).

## After installing

1. **Automations are on** for the workspace (`features.automations`).
2. **Connect Xero** as the person who will own the automations. Use a Xero login that can see every client organisation. The automations run as that person and use their Xero connection.
3. **Publish the four forms** in Forms (they install as drafts).
4. **Publish the automations.** They install as drafts; publishing shows the permissions each one asks for. Publish *Start setup* and *Apply setup (Xero)* first.
5. **Run *Bookkeeping: Start setup*** and fill in the Bookkeeping setup form on the item it creates.
6. **Run it again with your client business names** (one per line), and fill in each client's settings form. Enter the Xero organisation name exactly as it appears in Xero.
7. **Publish** *Process bill or invoice*, *Apply bill or invoice review*, *Weekly AP digest* and *Ledger checks*.
8. **For bills by email:** install the Microsoft 365 or Google Workspace extension, connect Outlook or Gmail as the automations' owner, and publish *Email intake (Outlook)* or *Email intake (Gmail)*. The first run looks back 24 hours.
9. **Try it:** email a supplier bill PDF to that inbox, or drop one into `Bookkeeping Inbox/<client>/` in Knowledge.

After every extension update, publish the updated automation drafts again. Updates arrive as drafts, and the previous version keeps running until you do.

## How a bill flows

1. **Read:** the PDF's text is read and AI extracts the supplier, ABN, invoice number, dates, lines, GST and total. A scanned PDF or a photo (JPG or PNG; a photo becomes a one-page PDF first) has no text, so the AI reads its first 10 pages from the image instead. Bills read that way are always reviewed, with a reminder to check them against the image.
2. **Check:** totals, GST at 10%, the ABN checksum, and duplicates (same supplier and invoice number already in Xero). Plus the checks catalogue's intake checks, as warnings tagged with their IDs (never blocks, since the AI can misread a PDF): bank details on the PDF that differ from the supplier's in Xero (CHK-020), a new supplier whose bank details are only on the invoice (CHK-060), an ABN on the PDF that isn't the contact's (CHK-089) or isn't the one on its earlier bills (CHK-090), more than one ABN on the PDF (CHK-091), GST on the PDF but coded GST-free (CHK-092) or the reverse (CHK-124), and the exact same file processed before (CHK-130).
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

## How the ledger checks work

The checks are the mySMB checks catalogue's release 1 checks that need nothing but the ledger. They read Xero and change nothing in it.

1. **Which clients:** every client set up in the extension, unless its Client bookkeeping settings say *No* to the ledger checks. Clients are checked one after another until a run has used about 13 minutes; the next run carries on.
2. **Every night (fraud and duplicates):** supplier bank details changed (CHK-017) and changed before a payment is due or made (CHK-057); contacts sharing an ABN, a name (CHK-006) or a bank account (CHK-018); duplicate bills (CHK-055, CHK-079) and duplicate bills paid (CHK-080); duplicate sales invoices (CHK-028) and both paid (CHK-035); spend money that looks like a bill (CHK-087); a new supplier paid a lot or fast (CHK-056). These look at the last 35 days, plus every approved bill still to pay.
3. **Once a week (the rest):** GST claimed from contacts with no ABN (CHK-008); TPAR details missing (CHK-007, clients that lodge a TPAR); last month's spend money and bills over $82.50 with nothing attached (CHK-021, CHK-086); unreconciled bank transactions (CHK-022); sales invoices never sent (CHK-024, except invoices this extension captured) or still in draft (CHK-033); GST on sales when not registered (CHK-031); GST on accounts that normally have none (CHK-058) or that isn't the rate's share, or mixed tax codes for one supplier and account (CHK-059); suspense balances 30 days old (CHK-125); GST accounts with mostly GST-free lines (CHK-129); nothing entered for 30 days (CHK-132); a monthly journal missing (CHK-133); no recent lock date (CHK-134) or one moved back (CHK-135); income over the GST registration threshold (CHK-136); unused profit and loss accounts (CHK-138). CHK-056, CHK-129 and CHK-133 are heuristic readings until the content owner confirms them.
4. **The checklist:** one *Checks: <client>* item per client in WorkQ (labels `bookkeeping`, `checks` and the client), assigned to the client's checks owner (else the practice's, else the reviewer). Each line shows the catalogue's default severity, the check, the amount at risk, what was found with a link into Xero, and a ref. The item is rewritten each run with what's still open, comments only when something changed, takes the highest severity as its priority (never urgent), and completes itself when nothing is open.
5. **Not an issue?** Tick the line: it stays hidden until that finding's details change. To snooze findings to a date, or add a note, fill in the **Check findings** form with their refs. A form can only be submitted once per item, so the checklist then moves to a fresh item.
6. **Weekly report:** once a week, after every client is checked, a *Ledger checks* HTML artifact lists the open findings by business, with the client queries (receipts, ABNs, TPAR details) separate, and the checks owner is notified. It's as of the last run, not live.

Findings are kept in `Bookkeeping/Checks/<client>.json`. Supplier bank details are never stored: change detection keeps a keyed fingerprint of each account instead.

## How an invoice request flows

1. **Triage:** Email intake reads every new email, with or without attachments. A client asking the bookkeeper to raise an invoice is an *invoice request*.
2. **Client:** the sender's address is matched to each client's contact email in its settings; otherwise AI works it out, and an unclear one becomes a *Which client is this invoice request from?* item.
3. **Draft:** AI reads the customer and lines. Each line is priced from what the request says, then the matching Xero item; a line with no price must be priced by the reviewer. Coding comes from the Xero item, a saved customer rule, the customer's history, then AI over revenue accounts. An existing customer gets a DRAFT in Xero straight away (with its invoice number); a new customer's contact and invoice wait for approval.
4. **Approve:** the reviewer gets an *Invoice to raise* item with the request quoted and the **Invoice to send** form, including **"Once it's approved, should Xero email it to the customer?"**.
5. **Apply:** approved invoices are **Awaiting payment**. Xero emails the invoice to the contact's email address only when the reviewer ticked *yes*; otherwise send it from Xero when you're ready.

## Limits

- One Xero connection covers all clients. The connection owner's Xero login must include every client organisation. If an organisation is added later, reconnect Xero.
- One invoice per PDF. Credit notes and receipts are sent to exceptions.
- Photos must be JPG or PNG (an iPhone's HEIC isn't read; email or export it as JPG). By email, photos are taken only from emails with no PDF, and only those over 30 KB, so logos and signature images are left alone.
- A scanned bank statement is read one page at a time from the image, and a scanned page holds about 40 transactions at most. When a page has more, the lines don't add up and the statement is flagged rather than imported.
- Payroll checks read Xero Payroll AU and Deputy only; the officer makes every correction. Deputy is one connection per client business. Penalty rules beyond the day start/end, weekends, public holidays and a daily overtime threshold are not modelled yet.
- Gmail requests are read from the email's snippet (the first couple of lines): the Gmail connector doesn't return the full body. Outlook requests are read in full.
- Ledger checks see what the Xero Accounting API shares: bank statement lines that aren't coded yet aren't visible, so CHK-022 counts transactions entered but not reconciled. Each list is read up to 2,000 rows a run (the checklist says when that cut a list short). The first run takes the bank-details snapshot, so bank changes are reported from the second night on.
- A raised invoice uses the organisation's default branding theme and invoice numbering, and Xero's standard email template when it's emailed.
