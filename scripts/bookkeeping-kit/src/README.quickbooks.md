# Bookkeeping checks for QuickBooks

Overnight **ledger checks** on a client's QuickBooks Online company, for bookkeeping practices. Every night the mySMB checks catalogue is run on the whole company, however the entries got there, and the client gets a WorkQ checklist of what needs fixing. A weekly data quality report sums it up. It only reads: nothing is changed in QuickBooks.

These are the same checks Bookkeeping for Xero runs on Xero files, fed from QuickBooks' own records. A workspace can have both: they share the bookkeeping settings and findings in Knowledge.

**One company per connection.** A QuickBooks connection reaches one company (the company is chosen when QuickBooks is connected). The checks run on the client whose company QuickBooks is connected to; a client whose company isn't the connected one is reported as an error on that night's run, not checked.

> Generated from `scripts/bookkeeping-kit` in this repo (`node gen-ext.js <root> quickbooks`). Change the kit source and regenerate; don't hand-edit these files.

## What's in the box

- **Bookkeeping: Start checks setup (QuickBooks)** (run by hand): creates the setup items in WorkQ, the Bookkeeping checks setup form (unless bookkeeping is set up already) and one Client checks settings (QuickBooks) form per business you list.
- **Bookkeeping: Apply checks setup (QuickBooks)** (when one of those forms is submitted): saves the answers to Knowledge (`Bookkeeping/settings.json`, keeping anything Bookkeeping for Xero saved, and `Bookkeeping/Clients/<client>.json`) and checks the client's company is the connected one.
- **Bookkeeping: Ledger checks (QuickBooks)** (every 30 minutes from midnight to 5:30 am, Sydney time, on a Check findings form, or by hand with the client's name): checks the client and keeps its Checks item.
- **Forms:** Bookkeeping checks setup, Client checks settings (QuickBooks), Check findings.

## Configuration

No configuration variables are required. Settings are collected by the setup forms and stored in Knowledge (`Bookkeeping/settings.json`, `Bookkeeping/Clients/<client>.json`).

**Requires** the `quickbooks-accounting` connector (myhub-mcp-servers).

## After installing

1. **Automations are on** for the workspace (`features.automations`).
2. **Connect QuickBooks** (from the *QuickBooks Accounting* extension) to the client's company as the person who will own the automations. The automations run as that person and use their QuickBooks connection.
3. **Publish the three forms** in Forms (they install as drafts).
4. **Publish *Start checks setup (QuickBooks)* and *Apply checks setup (QuickBooks)*.** They install as drafts; publishing shows the permissions each one asks for.
5. **Run *Bookkeeping: Start checks setup (QuickBooks)*** and fill in the Bookkeeping checks setup form on the item it creates (skipped when Bookkeeping for Xero is set up already).
6. **Run it again with the client business name**, and fill in its settings form. Enter the company name exactly as it appears in QuickBooks.
7. **Publish *Ledger checks (QuickBooks)*.**
8. **Try it:** run *Ledger checks (QuickBooks)* by hand with the client's name.

After every extension update, publish the updated automation drafts again. Updates arrive as drafts, and the previous version keeps running until you do.

## How the ledger checks work

1. **Every night (fraud and duplicates):** suppliers sharing a name (CHK-006); duplicate bills (CHK-055, CHK-079) and duplicate bills paid (CHK-080); bills with nearly the same number and the same amount (CHK-081); duplicate sales invoices (CHK-028) and both paid (CHK-035); expenses that look like a bill (CHK-087); a new supplier paid a lot or fast (CHK-056). These look at the last 35 days, plus every bill with a balance.
2. **Once a week (the rest):** last month's expenses and bills over $82.50 with nothing attached (CHK-021, CHK-086); sales invoices never sent (CHK-024); GST on sales when not registered (CHK-031); GST on accounts that normally have none (CHK-058) or that isn't the rate's share, or mixed tax codes for one supplier and account (CHK-059); suspense balances 30 days old (CHK-125); GST accounts with mostly GST-free lines (CHK-129); nothing entered for 30 days (CHK-132); a monthly journal entry missing (CHK-133); no recent closing date (CHK-134) or one moved back (CHK-135); income over the GST registration threshold (CHK-136); unused profit and loss accounts (CHK-138); GST on lines coded to an account whose tax code has none (CHK-137); an ASIC fee overdue or due within a fortnight (CHK-170); expenses paid to a supplier that's normally billed (CHK-074); fuel bought and no fuel tax credits recorded in 12 months (CHK-131); a contact's income or expense coded to another account than the one it nearly always uses (CHK-041, CHK-094); a fixed asset account with a balance and no accumulated depreciation account of its own (CHK-141); pending estimates, or accepted ones not yet invoiced (CHK-040), and open purchase orders (CHK-093), the nearest QuickBooks has to drafts; a month far above a customer's or supplier's usual (CHK-036, CHK-082: at least 2.5 times the median of 3 or more earlier months, and $500 more); an overdue invoice or bill from a contact that's usually paid within about the same number of days (CHK-037, CHK-083), or several of them at once (CHK-038, CHK-084).
3. **The checklist, ticks, the Check findings form and the weekly report** work as in Bookkeeping for Xero: a *Checks: <client>* item, rewritten each run, ticked lines stay hidden until their details change, and a weekly *Ledger checks (QuickBooks)* report goes to the checks owner.

### Look back (test companies only)

The daily checks look at the last 35 days and the weekly ones at this financial year. For a test company whose planted problems are older, run *Ledger checks (QuickBooks)* by hand with the client's name and **Look back this many months** (up to 18). It stays for that client until a manual run sets 0, and its checklist says so at the top.

### How QuickBooks' records are read

- Each line's GST is its share of the document's tax line for its tax code's rate (QuickBooks keeps the GST per rate, not per line). Only account-coded lines are checked against their account: an item line carries the item's account, which QuickBooks doesn't give on the line.
- Duplicate contacts are checked among suppliers: QuickBooks keeps customers and suppliers in separate lists, so one business in both is normal.
- A bill's paid date is the latest bill payment linked to it.
- Attachments are read newest first, back to a month before last month. If there are more than 10,000 in that time, the attachment checks read as not checked rather than guess.
- The lock date is QuickBooks' closing date (Settings, Advanced, Accounting).

### Not checked (QuickBooks' API doesn't give what they need)

These are listed on the Checks item as not checked, never shown as clear:

| Check | Why |
|---|---|
| CHK-007, CHK-008 and the register checks (CHK-002 to CHK-005, CHK-009, CHK-030, CHK-039, CHK-068, CHK-069, CHK-071, CHK-072, CHK-076, CHK-077, CHK-085, CHK-088) | QuickBooks contacts carry no ABN field through its API |
| CHK-017, CHK-018, CHK-057 (supplier bank details changed or shared) | QuickBooks' API doesn't return supplier bank details |
| CHK-022 (unreconciled transactions) | QuickBooks doesn't say through its API whether a transaction is reconciled |
| CHK-033, CHK-078 (invoices and bills in draft) | QuickBooks has no draft or awaiting-approval invoices or bills |
| CHK-016 (batch payment text) | QuickBooks' API has no batch payments |
| CHK-139, CHK-140 (fixed assets) | These read Xero Assets |

## Limits

- One company per QuickBooks connection (see above).
- Each list is read up to 10,000 rows a run (the checklist says when a list was cut short).
- The first run takes the contacts snapshot, so a new supplier is reported from the second night on.
- Links open the document in QuickBooks Online, in whichever company the browser has open.
