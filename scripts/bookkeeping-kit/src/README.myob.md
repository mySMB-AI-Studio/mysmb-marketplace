# Bookkeeping checks for MYOB

Overnight **ledger checks** on each client's own MYOB company file, for bookkeeping practices that keep the books for many client businesses. Every night the mySMB checks catalogue is run on the whole file, however the entries got there, and each client gets one WorkQ checklist of what needs fixing. A weekly data quality report covers every client. It only reads: nothing is changed in MYOB.

These are the same checks Bookkeeping for Xero runs on Xero files, fed from MYOB's own records. A workspace can have both: clients kept in Xero are checked by Bookkeeping for Xero, clients kept in MYOB by this extension, and they share the bookkeeping settings and findings in Knowledge.

> Generated from `scripts/bookkeeping-kit` in this repo (`node gen-ext.js <root> myob`). Change the kit source and regenerate; don't hand-edit these files.

## What's in the box

- **Bookkeeping: Start checks setup (MYOB)** (run by hand): creates the setup items in WorkQ, the Bookkeeping checks setup form (unless bookkeeping is set up already) and one Client checks settings (MYOB) form per business you list.
- **Bookkeeping: Apply checks setup (MYOB)** (when one of those forms is submitted): saves the answers to Knowledge (`Bookkeeping/settings.json`, keeping anything Bookkeeping for Xero saved, and `Bookkeeping/Clients/<client>.json`) and finds the client's MYOB company file.
- **Bookkeeping: Ledger checks (MYOB)** (every 30 minutes from midnight to 5:30 am, Sydney time, on a Check findings form, or by hand with a client's name): checks each client due a check and keeps its Checks item.
- **Bookkeeping: Register lookups (ABR, MYOB)** (11:45 pm nightly, or by hand): looks up each MYOB client's suppliers and customers on the Australian Business Register for the register checks. Needs the ABR Lookup extension; publish it only if that's installed.
- **Forms:** Bookkeeping checks setup, Client checks settings (MYOB), Check findings.

## Configuration

No configuration variables are required. Settings are collected by the setup forms and stored in Knowledge (`Bookkeeping/settings.json`, `Bookkeeping/Clients/<client>.json`).

**Requires** the `myob-accounting` connector with the per-call company file (`myob_company_file_id`), the line lists (`list_invoice_lines`, `list_bill_lines`), `list_suppliers`, `list_spend_money` and `list_supplier_payments` (myhub-mcp-servers; on staging and master by 18 October 2026).

## After installing

1. **Automations are on** for the workspace (`features.automations`).
2. **Connect MYOB** (from the *MYOB Accounting* extension) as the person who will own the automations, with a MYOB login that can open every client's company file. The automations run as that person and use their MYOB connection; each client's checks read its own company file through it.
3. **Publish the three forms** in Forms (they install as drafts).
4. **Publish *Start checks setup (MYOB)* and *Apply checks setup (MYOB)*.** They install as drafts; publishing shows the permissions each one asks for.
5. **Run *Bookkeeping: Start checks setup (MYOB)*** and fill in the Bookkeeping checks setup form on the item it creates (skipped when Bookkeeping for Xero is set up already).
6. **Run it again with your client business names** (one per line), and fill in each client's settings form. Enter the company file name exactly as it appears in MYOB.
7. **Publish *Ledger checks (MYOB)*,** and *Register lookups (ABR, MYOB)* if the ABR Lookup extension is installed.
8. **Try it:** run *Ledger checks (MYOB)* by hand with a client's name.

After every extension update, publish the updated automation drafts again. Updates arrive as drafts, and the previous version keeps running until you do.

## How the ledger checks work

1. **Which clients:** every client set up with a MYOB company file, unless its settings say *No* to the ledger checks. Clients are checked one after another until a run has used about 13 minutes; the next run carries on.
2. **Every night (fraud and duplicates):** contacts sharing an ABN or a name (CHK-006); duplicate bills (CHK-055, CHK-079) and duplicate bills paid (CHK-080); duplicate sales invoices (CHK-028) and both paid (CHK-035); spend money that looks like a bill (CHK-087); a new supplier paid a lot or fast (CHK-056). These look at the last 35 days, plus every open bill.
3. **Once a week (the rest):** GST claimed from suppliers with no ABN (CHK-008); TPAR details missing (CHK-007, clients that lodge a TPAR); unreconciled bank transactions (CHK-022); sales invoices never sent (CHK-024); GST on sales when not registered (CHK-031); GST on accounts that normally have none (CHK-058) or that isn't the tax code's share, or mixed tax codes for one supplier and account (CHK-059); suspense balances 30 days old (CHK-125); GST accounts with mostly GST-free lines (CHK-129); nothing entered for 30 days (CHK-132); a monthly general journal missing (CHK-133); income over the GST registration threshold (CHK-136); unused profit and loss accounts (CHK-138); GST on lines coded to an account whose tax code has none (CHK-137).
4. **Register checks** (weekly, when *Register lookups (ABR, MYOB)* is published): cancelled businesses still being billed, paid, invoiced or owing the client; GST from businesses not registered for GST; ABNs that look wrong; likely ABNs for suppliers with none; donations to a body that isn't a DGR (CHK-003 to CHK-005, CHK-009, CHK-030, CHK-039, CHK-068, CHK-069, CHK-071, CHK-072, CHK-076, CHK-077, CHK-085, CHK-088). For a test company whose ABNs are made up, see *Test register* below.
5. **The checklist, ticks, the Check findings form and the weekly report** work as in Bookkeeping for Xero: one *Checks: <client>* item per client, rewritten each run, ticked lines stay hidden until their details change, and a weekly *Ledger checks (MYOB)* report goes to the checks owner.

### How MYOB's records are read

- Bills and sales invoices dated in the window come from the line lists (every layout: item, service, professional, time billing, miscellaneous); the open bills and invoices add the balance, due date and delivery status. A line's GST is its tax code's share of the line (MYOB returns no tax per line); where the document's total tax differs, the lines carry it pro rata.
- ABNs come from the supplier cards. A customer card with the same name as a supplier card is the same business (MYOB needs one card per role), so it's left out of the duplicate-contact check.
- A bill's paid date is the latest supplier payment applied to it.
- Reconciliation comes from the bank and credit card lines of the journal transactions (their reconciled date), as MYOB's bank reconciliation reads it. General journals feed the month-end journal check.

### Not checked (MYOB's API doesn't give what they need)

These are listed on each Checks item as not checked, never shown as clear:

| Check | Why |
|---|---|
| CHK-002 (a bill PDF showing a cancelled ABN) | It reads the ABN on bill PDFs, which only Bookkeeping for Xero's bill intake reads |
| CHK-017, CHK-018, CHK-057 (supplier bank details changed or shared) | The MYOB connector doesn't return supplier bank details |
| CHK-021, CHK-086 (spend money and bills with nothing attached) | MYOB's API doesn't say whether a transaction has an attachment |
| CHK-033, CHK-078 (invoices and bills in draft) | MYOB has no draft or awaiting-approval invoices or bills (unfinished ones are quotes or orders) |
| CHK-040, CHK-093 (quotes and purchase orders in draft) | The MYOB connector doesn't list quotes or purchase orders |
| CHK-134, CHK-135 (lock date) | MYOB's API doesn't return the company file's lock period |
| CHK-016 (batch payment text) | MYOB's API has no batch payment text |
| CHK-139, CHK-140 (fixed assets) | These read Xero Assets |
| CHK-024 (invoices never sent), on some files | Only when MYOB returns no delivery status for the open invoices |

### Test register (test companies only)

A test company's ABNs are usually made up, so the register has no record of them and the register checks can't be tested on it. For such a company, save its register answers as a CSV in Knowledge at `Bookkeeping/Test register/<client>.csv`, named after the client (its name, or its MYOB company file name). *Register lookups (ABR, MYOB)* then reads that file instead of the register, for that client only:

- **Columns:** **ABN on record**, **Registry entity name**, **ABN status** (`Active`, `Cancelled (30/11/2025)`, `Not found …`), **GST registration** (`Registered` / `Not registered`) and **DGR** (`Yes` / `No`). Title lines above the header are fine: the demo seed packs' *Registry fixture* tab, saved as CSV, works as it is.
- Rows without an 11-digit ABN are skipped, and an ABN that fails the checksum reads as not on the register. No names are searched, so CHK-005 doesn't run for that client.
- Every register finding for that client ends with *(Test register, not the Australian Business Register.)*, and its checklist says so at the top.
- Delete the file to go back to the register: the next run forgets everything the file gave.

Never use it for a real client.

## Limits

- The bill and invoice line lists are read up to 5,000 lines a run, and contact cards up to 20,000 (the checklist says when a list was cut short). A large file may need the weekly window shortened later.
- The first run takes the contacts snapshot, so a new supplier is reported from the second night on.
- MYOB AccountRight has no stable web links, so findings name the document instead of linking to it.
