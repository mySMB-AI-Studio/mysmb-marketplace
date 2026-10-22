# Bookkeeping for Xero

Supplier bills and sales invoices from email or PDF into Xero, for bookkeeping practices that keep the books for many client businesses. **Invoice capture** records the sales invoices a client issued outside Xero (Word, Excel, a job app) as *Awaiting payment*, without emailing the customer again. And when a client asks for an invoice to be raised ("please invoice Bayview for September"), it's drafted in Xero, approved in WorkQ and, if the reviewer says so, emailed to the customer by Xero. Bills arriving in the bookkeeper's Outlook or Gmail inbox are picked out by AI and filed under the right client, or you can drop a PDF (or a photo of a bill) into a client's inbox folder. Each bill is read, checked and coded. It's created as a draft bill in **that client's own Xero organisation**, with the PDF attached, and sent to the reviewer in WorkQ. The reviewer's decision is applied in Xero, and coding corrections are remembered for next time. A weekly digest shows what's waiting for each client, and overnight **ledger checks** look over each client's whole Xero file, however the entries got there, and keep one WorkQ checklist per client of what needs fixing.

> Generated from `scripts/bookkeeping-kit` in this repo (gen-ext.js). Change the kit source and regenerate; don't hand-edit these files.

## What's in the box

- **Connectors:** `xero-accounting` (the mySMB Xero connector), and `m365-mail-shared` for reading a shared Outlook mailbox. Email intake otherwise uses `m365-mail-read` or, for a personal Hotmail / Outlook.com inbox, `hotmail-mail` (both in the Microsoft 365 extension), or `google-workspace-gmail` (Google Workspace extension).
- **Automations (19):**
  - *Bookkeeping: Start setup* (run by hand): creates the setup items.
  - *Bookkeeping: Apply setup (Xero)*: saves the setup answers and matches each client to its Xero organisation.
  - *Bookkeeping: Process bill, invoice or statement (Xero)*: runs when a PDF lands in `Bookkeeping Inbox/<client>/`. A PDF dropped into `Bookkeeping Inbox` itself is matched to its client by AI (with one client, it's that client); if that isn't clear, it waits in `Bookkeeping Failed/unmatched/` with a *Which client is this for?* item.
    - **Supplier bill** (addressed to the client) or **sales invoice** (issued by the client, matched on its Xero organisation name and ABN): checked, coded and sent for review.
    - **Bank or credit card statement:** attached to its bank account in Xero (matched on the last four digits of the account or card, then the name). If Xero's balance at the period end already matches, that's all. Otherwise the transactions are read off the PDF and, when they add up from the opening to the closing balance, saved as a CSV in Xero's statement import format (`Bookkeeping Processed/<client>/`, also attached in Xero) with a WorkQ item to upload it (Bank accounts, Import a Statement, date format dd/mm/yyyy). Xero only lets bank feeds add statement lines directly, so that upload stays manual.
    - **Statement of account:** attached to the supplier or customer in Xero, with the amount owing and the listed invoices compared with what Xero shows open.
    - Statements are logged in `Bookkeeping/Statements/<client>.json`; a WorkQ item appears only for differences, an unknown account or contact, or an unreadable file.
    - **Several invoices or statements in one PDF** (up to 20 pages): AI finds where each one starts and ends, the PDF is split into one PDF each in `Bookkeeping Split/<client>/`, and the original is filed in `Bookkeeping Processed/<client>/`.
  - *Bookkeeping: File split documents*: moves each part of a split PDF from `Bookkeeping Split/<client>/` into the client's inbox folder, where it's processed like any other PDF. (An automation's own new files never start it again, so this small automation does the hand-over.)
  - *Bookkeeping: Apply bill or invoice review (Xero)*: runs when a Bill review, Invoice review or Client bill approval form is submitted.
  - *Bookkeeping: Draft requested invoice (Xero)*: runs when Email intake files a request in `Bookkeeping Requests/<client>/`, or by hand with the client's name and the request text (a phone request, say).
  - *Bookkeeping: Weekly AP digest (Xero)*: Mondays at 8am.
  - *Bookkeeping: Ledger checks (Xero)*: every 30 minutes from midnight to 5:30am, checking each client once a day (see *How the ledger checks work*). Also runs when a Check findings form is submitted, or by hand with a client's name to check it now.
  - *Bookkeeping: Register lookups (ABR)*: nightly at 11:30pm, looks up each client's suppliers and customers on the Australian Business Register for the register checks. Needs the **ABR Lookup** extension; publish it only if that's installed.
  - *Bookkeeping: Asset lookups (Xero Assets)*: Sunday nights at 11pm, reads each client's fixed asset register in Xero (draft assets, and the fixed asset accounts its asset types use) for the fixed asset checks. Needs the **Xero Assets** extension connected; publish it only if that's installed.
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
  - *Bookkeeping: Email intake (Outlook)*, *Email intake (Outlook shared mailbox)*, *Email intake (Hotmail)* and *Email intake (Gmail)*: every 15 minutes, read the new emails in the owner's mailbox (or the practice's shared Outlook mailbox), have AI pick out supplier bills, sales invoices, statements and invoice requests, work out which client each one belongs to, and save it into that client's `Bookkeeping Inbox/<client>/` folder. See *How email intake works*. Other emails are left untouched: nothing in the mailbox is changed. Publish the one(s) for the mailbox you use.
- **Forms (12):** Bookkeeping setup, Client bookkeeping settings, Which client is this for?, Bill review, Invoice review, Invoice to send, Client bill approval, Client payroll settings, Pay run, Payroll review, Client payroll approval, Check findings.
- **Agent (1):** Bookkeeping Coordinator (Xero). It answers status questions, explains coding and exceptions, drafts client emails and looks things up in each client's Xero. For live reports it points to the **Xero Reporting Studio** extension. It never approves or sends anything.
- **Skill (1):** `bookkeeping-xero-foundation`. An agent can only use skills bundled in its own extension, so the agent no longer lists Xero Reporting Studio's report skills; install that extension for live Xero reports.

## Configuration

No configuration variables are required. Settings are collected by the setup forms and stored in Knowledge (`Bookkeeping/settings.json`, `Bookkeeping/Clients/<client>.json`).

**Requires** `myhub-mcp-servers` with `xero_tenant_id` support on write tools (PR #558). Without it, every bill is written to the connection's default Xero organisation. Email intake also needs the mail attachment tools (`list_email_attachments` / `get_email_attachment` for Outlook, `get_attachment` for Gmail). Folders by path, reading in order from the last run, shared mailboxes and HEIC conversion need the mail connector update (`list_mail_folders`, `receivedAfter`/`oldestFirst`, `mailbox`, Gmail `pageToken`, `heicToJpeg`, and the `m365-mail-shared` route; for Hotmail, `hotmail-mail` with myhub-mcp-servers #821). With an older connector, email intake still reads the Inbox, but only the newest 50 emails each run, and an iPhone photo becomes an item asking for a JPEG. Reading scanned PDFs and photos needs the myHubV2 version where `api.ai` accepts a file (myHubV2 #1769).

## After installing

1. **Automations are on** for the workspace (`features.automations`).
2. **Connect Xero** as the person who will own the automations. Use a Xero login that can see every client organisation. The automations run as that person and use their Xero connection.
3. **Publish the twelve forms** in Forms (they install as drafts).
4. **Publish the automations.** They install as drafts; publishing shows the permissions each one asks for. Publish *Start setup* and *Apply setup (Xero)* first.
5. **Run *Bookkeeping: Start setup*** and fill in the Bookkeeping setup form on the item it creates.
6. **Run it again with your client business names** (one per line), and fill in each client's settings form. Enter the Xero organisation name exactly as it appears in Xero.
7. **Publish** *Process bill or invoice*, *File split documents*, *Apply bill or invoice review*, *Weekly AP digest* and *Ledger checks*.
8. **For bills by email:** install the Microsoft 365 or Google Workspace extension, connect Outlook or Gmail as the automations' owner, and publish *Email intake (Outlook)* or *Email intake (Gmail)*. For a shared Outlook mailbox (accounts@…), put its address in the Bookkeeping setup form, connect *m365-mail-shared* as someone with Full Access to it, and publish *Email intake (Outlook shared mailbox)*. For a personal Hotmail, Outlook.com or Live.com inbox (the Microsoft 365 Outlook connection takes work or school accounts only), connect *hotmail-mail* (Microsoft 365 extension) as the automations' owner, signing in with that Hotmail account, and publish *Email intake (Hotmail)*. List any other folders to read in the setup form, and each client's own folder (if it has one) in its client settings. Each folder's first run looks back 24 hours.
9. **Try it:** email a supplier bill PDF to that inbox, or drop one into `Bookkeeping Inbox/<client>/` in Knowledge.

After every extension update, publish the updated automation drafts again. Updates arrive as drafts, and the previous version keeps running until you do.

## How a bill flows

Every WorkQ item the extension creates is laid out the same way: **What to do** first; then the facts (where the document came from, such as the email's sender, subject and time; which client and which Xero organisation; whether the PDF is attached in Xero); then the details; then what each answer on the form does.

1. **Read:** the PDF's text is read and AI extracts the supplier, ABN, invoice number, dates, lines, GST and total. A scanned PDF or a photo (JPG, PNG, WebP, GIF or TIFF; a photo becomes a PDF first) has no text, so the AI reads its first 10 pages from the image instead. Bills read that way are always reviewed, with a reminder to check them against the image. A PDF holding several invoices is split into one PDF per invoice, and each goes through these steps on its own.
2. **Which client:** a bill addressed to a named business that isn't this client waits, with nothing sent to Xero, when that business is another client, another Xero organisation the connection can see, or anyone at all on a bill Email intake filed here only because this is the only client set up. A *Which client is this for?* item says who it's addressed to and offers: **the business it's addressed to** (a Xero organisation that isn't a client yet is set up as one, with the practice's defaults and an item to fill in its settings), **the client it was filed under**, **another client** (named on the form), or **none of our clients**. Choosing a client remembers the name it was addressed to, so the next one goes straight there. A bill someone put in a client's folder by hand, addressed to a name nobody knows (the owner's own name, say), goes on with a warning at the top of its checks.
3. **Check:** totals, GST at 10%, the ABN checksum, and duplicates (same supplier and invoice number already in Xero). Plus the checks catalogue's intake checks, as warnings tagged with their IDs (never blocks, since the AI can misread a PDF): bank details on the PDF that differ from the supplier's in Xero (CHK-020), a new supplier whose bank details are only on the invoice (CHK-060), an ABN on the PDF that isn't the contact's (CHK-089) or isn't the one on its earlier bills (CHK-090), more than one ABN on the PDF (CHK-091), GST on the PDF but coded GST-free (CHK-092) or the reverse (CHK-124), and the exact same file processed before (CHK-130).
4. **Code:** a saved rule for the supplier comes first, then the supplier's recent bills in Xero, then an AI suggestion from the chart of accounts. Every line shows where its coding came from.
5. **Draft:** a DRAFT bill is created in the client's Xero organisation with the PDF attached. For new suppliers, the contact and bill are only created once the bill is approved.
6. **Review:** the reviewer gets a WorkQ item with the Bill review form and chooses Approve, Approve with changes (in plain words, e.g. "line 1 account 449"), Reject, or Ask the client.
7. **Apply:** approved bills become *Awaiting approval* or *Approved* in Xero (you choose in setup). Rejected drafts are deleted. Bills over the client-approval limit get a follow-up item with a draft email for the business owner; the bookkeeper records the reply in the Client bill approval form. Clients never need Workspace access.
8. **Learn:** coding changes (or "Remember this coding") are saved as a rule for that supplier.

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

### Payroll checks from the checks catalogue

*Check pay run* also runs the catalogue's payroll checks on the pay calendar's employees, the draft pay run's payslips and the pay items it uses. They're in the report's *Payroll checks* table, most severe first:

- **High:** an employee's bank account on another Xero contact, such as a supplier (CHK-019); a terminated employee with no Single Touch Payroll cessation reason (CHK-147); a terminated employee on this pay run (CHK-155); an adult's ordinary rate below the national minimum wage, $26.44 an hour from 1 July 2026, or $33.05 for a casual with the 25% loading (CHK-156); super owed on the payroll's super liability account past its due date (CHK-157, covering CHK-158).
- **Medium:** a tax file number still "applied for" more than 28 days after starting (CHK-148); someone on this pay run whose record has no tax file number declaration, super fund, bank account, home address or STP Phase 2 update (CHK-159); a full- or part-time employee with no annual or personal/carer's leave (CHK-161) or no long service leave (CHK-167) in their pay template.
- **Low:** an employee's bank account on their own Xero contact, for reimbursements (CHK-152); a negative leave balance (CHK-149, covering CHK-160); a casual accruing annual leave (CHK-150); reimbursements over wages (CHK-151); paid on this pay run but starting after the period (CHK-153); two employees paid into one bank account (CHK-162); a junior's birthday this period, under *Changes this period* (CHK-163); super guarantee under 12% of the payslip's ordinary time earnings (CHK-164, covering CHK-165); annual leave set not to accrue, or a full-timer's not 4 or 5 weeks a year (CHK-166); a pay item whose name and STP earnings type disagree, or an allowance with no allowance type (CHK-168).

CHK-156, CHK-164, CHK-166 and CHK-168 are heuristic readings until the content owner confirms them. CHK-156 skips employees under 21 (junior rates) and says apprentices, trainees and supported wages differ.

**Super owed (CHK-157)** is the super liability account's balance in Xero (so *Check pay run* also uses the Xero accounting connection, which CHK-019 and CHK-152 read the contacts from too), less the super from posted pay runs that isn't due yet. From 1 July 2026 (Payday Super) super has to reach the fund within 7 business days of pay day; the check skips weekends and national public holidays and allows one more day for a state holiday. Before that, it was due 28 days after the quarter. When the payroll settings or the ledger can't be read, the report says super owed wasn't checked.

**Privacy.** Payroll findings name the employee and show pay figures (hours, rates, amounts) only. Tax file numbers, bank details, dates of birth, addresses and contact details never appear: the checks about them state a fact ("no tax file number after 28 days", "paid into the same bank account as ..."), and bank accounts are compared in memory as hashes, never stored. Pay run, review and client approval items are visible only to the people they're assigned to and the automation's owner (a WorkQ item an automation creates is always visible to its owner).

Each year on 1 July, add the new national minimum wage to `PAY_WAGE_FLOOR` in the kit's `payroll.py`.

## How the ledger checks work

The checks are the mySMB checks catalogue's release 1 checks that need nothing but the ledger. They read Xero and change nothing in it.

1. **Which clients:** every client set up in the extension, unless its Client bookkeeping settings say *No* to the ledger checks. Clients are checked one after another until a run has used about 13 minutes; the next run carries on.
2. **Every night (fraud and duplicates):** supplier bank details changed (CHK-017) and changed before a payment is due or made (CHK-057); contacts sharing an ABN, a name (CHK-006) or a bank account (CHK-018); duplicate bills (CHK-055, CHK-079) and duplicate bills paid (CHK-080); bills with nearly the same number and the same amount, such as an "R" copy (CHK-081); duplicate sales invoices (CHK-028) and both paid (CHK-035); spend money that looks like a bill (CHK-087); a new supplier paid a lot or fast (CHK-056). These look at the last 35 days, plus every approved bill still to pay.
3. **Once a week (the rest):** GST claimed from contacts with no ABN (CHK-008); TPAR details missing (CHK-007, clients that lodge a TPAR); last month's spend money and bills over $82.50 with nothing attached (CHK-021, CHK-086); unreconciled bank transactions (CHK-022); sales invoices never sent (CHK-024, except invoices this extension captured) or still in draft (CHK-033); GST on sales when not registered (CHK-031); GST on accounts that normally have none (CHK-058) or that isn't the rate's share, or mixed tax codes for one supplier and account (CHK-059); suspense balances 30 days old (CHK-125); GST accounts with mostly GST-free lines (CHK-129); nothing entered for 30 days (CHK-132); a monthly journal missing (CHK-133); no recent lock date (CHK-134) or one moved back (CHK-135); income over the GST registration threshold (CHK-136); unused profit and loss accounts (CHK-138); bills (CHK-078), quotes (CHK-040) and purchase orders (CHK-093) left in draft or awaiting approval; batch payment text a bank's direct-entry file may reject (CHK-016); GST on lines coded to an account whose tax rate has none (CHK-137); an ASIC fee overdue or due within a fortnight (CHK-170); spend money to a supplier that's normally billed (CHK-074); fuel bought and no fuel tax credits recorded in 12 months (CHK-131); a contact's income or expense coded to another account than the one it nearly always uses (CHK-041, CHK-094); a fixed asset account with a balance and no accumulated depreciation account of its own (CHK-141, leaving out accounts Xero's fixed asset register covers); a month far above a customer's or supplier's usual (CHK-036, CHK-082: at least 2.5 times the median of 3 or more earlier months, and $500 more); an overdue invoice or bill from a contact that's usually paid within about the same number of days (CHK-037, CHK-083), or several of them at once (CHK-038, CHK-084). CHK-016, CHK-036 to CHK-038, CHK-041, CHK-056, CHK-074, CHK-082 to CHK-084, CHK-094, CHK-129, CHK-131, CHK-133 and CHK-141 are heuristic readings until the content owner confirms them. A finding also carries the catalogue checks it covers (CHK-033 covers CHK-032, CHK-028 covers CHK-034, CHK-058 covers CHK-075), and Process bill's new-supplier warning is CHK-073. When Xero won't share batch payments, quotes or purchase orders (a scope the connection lacks), that check waits for the next week and its open findings stay as they were.
4. **The checklist:** one *Checks: <client>* item per client in WorkQ (labels `bookkeeping`, `checks` and the client), assigned to the client's checks owner (else the practice's, else the reviewer). Each line shows the catalogue's default severity, the check, the amount at risk, what was found with a link into Xero, and a ref. The item is rewritten each run with what's still open, comments only when something changed, takes the highest severity as its priority (never urgent), and completes itself when nothing is open.
5. **Not an issue?** Tick the line: it stays hidden until that finding's details change. To snooze findings to a date, or add a note, fill in the **Check findings** form with their refs. A form can only be submitted once per item, so the checklist then moves to a fresh item.
6. **Register checks** (weekly, when *Register lookups (ABR)* is published): cancelled businesses still being billed (CHK-071), paid (CHK-072, CHK-088), invoiced (CHK-030) or owing the client (CHK-039); GST from businesses not registered for GST (unpaid bills CHK-085/068, paid bills CHK-076, spend money CHK-077/069); ABNs in Xero that fail, aren't on the register or belong to another name (CHK-004); a likely ABN for a supplier with none (CHK-005); donations to a body that isn't a DGR (CHK-009); a registered supplier with no GST claimed (CHK-003); a cancelled ABN on a bill PDF (CHK-002). Register lookups saves what it finds in `Bookkeeping/Checks/<client>-abr.json` and re-checks each business weekly; Ledger checks reads that file (it needs no ABR connection itself) and skips these checks when there's nothing from the last fortnight. Process bill uses the same file to warn at intake about a cancelled or unregistered ABN on the PDF (CHK-002, CHK-071, CHK-085). CHK-003, CHK-005 and CHK-009 are heuristic readings too.
7. **Fixed asset checks** (weekly, when *Asset lookups (Xero Assets)* is published): fixed assets left in draft, so not depreciating (CHK-139), and fixed asset accounts with a balance that no asset type uses (CHK-140). Asset lookups saves the register in `Bookkeeping/Checks/<client>-assets.json`; Ledger checks reads it (it needs no Xero Assets connection itself) and skips these checks when there's nothing from the last fortnight.
8. **Weekly report:** once a week, after every client is checked, a *Ledger checks* HTML artifact lists the open findings by business, with the client queries (receipts, ABNs, TPAR details) separate, and the checks owner is notified. It's as of the last run, not live.

Findings are kept in `Bookkeeping/Checks/<client>.json`. Supplier bank details are never stored: change detection keeps a keyed fingerprint of each account instead.

### Look back (test companies only)

The daily checks look at the last 35 days and the weekly ones at this financial year, so a client's history isn't reported all over again every night. A test company's planted problems are often older than that. Run *Ledger checks* by hand with the client's name and **Look back this many months** (up to 18): the daily checks then cover that far back and the weekly ones read that much of the file. It stays for that client, so its findings don't close the next night, and its checklist says so at the top. Run it by hand with 0 to go back to normal.

### Test register (test companies only)

A test company's ABNs are usually made up, so the register has no record of them and the register checks can't be tested on it. For such a company, save its register answers as a CSV in Knowledge at `Bookkeeping/Test register/<client>.csv`, named after the client (its name, or its Xero organisation name). *Register lookups* then reads that file instead of the register, for that client only:

- **Columns:** **ABN on record**, **Registry entity name**, **ABN status** (`Active`, `Cancelled (30/11/2025)`, `Not found …`), **GST registration** (`Registered` / `Not registered`) and **DGR** (`Yes` / `No`). Title lines above the header are fine: the demo seed packs' *Registry fixture* tab, saved as CSV, works as it is.
- Rows without an 11-digit ABN are skipped (the register is looked up by ABN), and an ABN that fails the checksum reads as not on the register. No names are searched, so CHK-005 doesn't run for that client.
- Every register finding for that client ends with *(Test register, not the Australian Business Register.)*, and its checklist says so at the top.
- Delete the file to go back to the register: the next run forgets everything the file gave. *Register lookups* still needs the ABR Lookup extension connected to be published.

Never use it for a real client.

## How email intake works

1. **What it reads:** the Inbox, the extra folders (Outlook folder paths such as `Inbox/Bills`, or Gmail labels) listed in the Bookkeeping setup form, and each client's own mail folder from its client settings. Each folder carries on from the last email it handled, oldest first, 20 emails a run, so none are missed however many arrive; the run summary says how many are waiting. An email that fails to download is read again next run (three tries, then an item).
2. **Triage:** AI decides which emails are supplier bills, sales invoices, statements or invoice requests; everything else is left alone.
3. **Attachments:** with several attachments, each one is checked, so terms and conditions, a remittance or a brochure sent with the bill are left out. Photos are taken only from emails with no PDF (and only over 30 KB, so logos and signatures are ignored); several photos become one PDF, which Process splits if it holds more than one bill. An iPhone's HEIC photo is converted to JPEG by the mail connector. A bill with nothing readable attached (a link to view it online, or a Word or Excel file) becomes a *Bill with nothing to read attached* item asking for the PDF.
4. **Which client:** an email in a client's own mail folder is that client's. Otherwise AI compares who the document is addressed to (or, for a sales invoice, who issued it) with every client's name, Xero organisation name, the other names in its client settings (trading names, the owner's name) and its ABN, using which clients earlier documents from that sender were for as a hint. When the AI isn't sure, a name the practice taught or a single client ABN printed on the document still places it. Otherwise the file waits in `Bookkeeping Failed/unmatched/` with a *Which client is this invoice for?* item. When you upload it into the right client's inbox folder, the name it was addressed to is remembered (`Bookkeeping/Mail/routing.json`), so the next one is placed by itself.
5. **Once only:** an email moved between folders, or copied to two mailboxes, isn't filed twice: it's recognised by its sender, subject and time received.

## How an invoice request flows

1. **Triage:** Email intake reads every new email, with or without attachments. A client asking the bookkeeper to raise an invoice is an *invoice request*.
2. **Client:** the sender's address is matched to each client's contact email in its settings; otherwise AI works it out, and an unclear one becomes a *Which client is this invoice request from?* item.
3. **Draft:** AI reads the customer and lines. Each line is priced from what the request says, then the matching Xero item; a line with no price must be priced by the reviewer. Coding comes from the Xero item, a saved customer rule, the customer's history, then AI over revenue accounts. An existing customer gets a DRAFT in Xero straight away (with its invoice number); a new customer's contact and invoice wait for approval.
4. **Approve:** the reviewer gets an *Invoice to raise* item with the request quoted and the **Invoice to send** form, including **"Once it's approved, should Xero email it to the customer?"**.
5. **Apply:** approved invoices are **Awaiting payment**. Xero emails the invoice to the contact's email address only when the reviewer ticked *yes*; otherwise send it from Xero when you're ready.

## Limits

- One Xero connection covers all clients. The connection owner's Xero login must include every client organisation. If an organisation is added later, reconnect Xero.
- A PDF of more than 20 pages holding several invoices isn't split; it goes to exceptions. Credit notes and receipts are sent to exceptions.
- An iPhone HEIC photo dropped straight into Knowledge can't be read (nothing in the automation sandbox decodes HEIC): email it in, or save it as JPEG. By email, photos are taken only from emails with no PDF, and only those over 30 KB, so logos and signature images are left alone.
- A shared mailbox is work Outlook only (Gmail has no shared mailboxes through its API, and a personal Hotmail account has none). *Email intake (Hotmail)* reads the one Hotmail account its owner connected.
- A scanned bank statement is read one page at a time from the image, and a scanned page holds about 40 transactions at most. When a page has more, the lines don't add up and the statement is flagged rather than imported.
- Payroll checks read Xero Payroll AU and Deputy only; the officer makes every correction. Deputy is one connection per client business. Penalty rules beyond the day start/end, weekends, public holidays and a daily overtime threshold are not modelled yet.
- Gmail requests are read from the email's snippet (the first couple of lines): the Gmail connector doesn't return the full body. Outlook requests are read in full.
- Ledger checks see what the Xero Accounting API shares: bank statement lines that aren't coded yet aren't visible, so CHK-022 counts transactions entered but not reconciled, and CHK-023 (a bank statement line missing) isn't checked: Xero shares statement lines only with apps it has approved for its bank statement API, and the checklist lists CHK-023 as not checked. Each list is read up to 2,000 rows a run (the checklist says when that cut a list short). The first run takes the bank-details snapshot, so bank changes are reported from the second night on.
- A raised invoice uses the organisation's default branding theme and invoice numbering, and Xero's standard email template when it's emailed.
