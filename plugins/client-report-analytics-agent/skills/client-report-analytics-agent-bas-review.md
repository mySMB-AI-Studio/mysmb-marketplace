---
name: client-report-analytics-agent-bas-review
description: How the Client Reporting Agent runs a BAS readiness review job - the practice's checklist file (and its default), finding the client, the readiness checks (the CRA-10 GST Check rules plus general readiness checks), the summary file and the client questions. Read-only.
---

# BAS readiness review

Use when you work a "BAS readiness review" job. You only read: you never change anything in Xero, never lodge, and never contact the client. The reviewer approves the outcome; you give them the facts. The job's statuses tell you what to do when; this skill is the detail.

## 1. The practice's checklist

Each practice decides which check groups **stop** lodgement and which are only a **note**. That choice lives in your files at `BAS readiness/Checklist.md`, and people can edit it.

- Read it with `files_read` at the start of every job.
- If it doesn't exist, write the default below there with `files_write`, then say in a job comment that you created the default checklist and that the practice should review the Stop/Note column.
- If someone has edited it, follow their version: run the groups it lists, and treat a group as Stop only when its row says Stop.

The default (provisional until a bookkeeper confirms it):

```markdown
# BAS readiness checklist

Mark each group Stop (must be fixed before lodging) or Note (flag it, carry on). Remove a row to skip that check.

| Group | Checks | Stop or Note |
|---|---|---|
| gstChargedWhileUnregistered | CHK-031 GST on sales or credit notes while not registered | Stop |
| gstOnNonClaimableItems | CHK-058 GST claimed on items that normally carry none | Stop |
| gstAmountMismatch | CHK-059 GST that isn't the rate's share of the line | Stop |
| gstWithoutAbn | CHK-008 GST claimed over $82.50 from a supplier with no ABN | Stop |
| gstFromUnregisteredSuppliers | CHK-068/069/076/077/085 GST claimed from suppliers not registered (ABR) | Stop |
| gstRegistrationRequired | CHK-136 income over $75,000 without GST registration | Stop |
| unreconciledBank | CHK-022 bank transactions not reconciled | Stop |
| suspenseBalance | CHK-125 suspense or uncoded account with a balance | Stop |
| cancelledAbn | CHK-002/071/072/088 dealings with a cancelled ABN (ABR) | Stop |
| duplicateBills | CHK-055/079/080 the same bill raised or paid twice | Stop |
| gstStatusMismatch | CHK-003 a contact's GST status differs from the ABR | Note |
| gstAccountWithoutGst | CHK-129 a GST account mostly without GST (heuristic) | Note |
| missingReceipts | CHK-021/086 spend money and bills over $82.50 with nothing attached | Note |
| draftSalesInvoices | CHK-033 sales invoices still in draft or awaiting approval | Note |
| lockDate | CHK-134/135 no lock date, or one older than 6 months | Note |
```

## 2. Find the client and the period (status: Finding the client)

- The job's inputs give `clientName`, `periodStart` and `periodEnd` (YYYY-MM-DD).
- Call `list_connections` and match `clientName` to a `tenantName`. Use its `tenantId` as `xero_tenant_id` on every other call. If nothing matches, or two do, ask for help and name the organisations you can see. Never guess.
- Call `get_organisation`: record whether the business is registered for GST (`gstRegistered`), its GST basis (`gstBasis`: cash or accrual) and a period label such as "Jul–Sep 2026" (`periodLabel`). Say in a job comment if the period doesn't look like one of its BAS periods.

## 3. Read the quarter (status: Checking)

Read only what you need, for the period only (Xero `where` filters such as `Date>=DateTime(2026,07,01) AND Date<=DateTime(2026,09,30)`).

**Always pass `page`** to `list_invoices`, `list_bank_transactions`, `list_credit_notes` and `list_contacts`: start at `page: 1` and keep going (2, 3 …) while a page comes back with 100 rows. Xero returns each document's **line items** (account, tax type, line amount, tax amount) and full contact details (ABN) **only on paged requests**; without `page` the lines are missing and the GST, ABN and coding checks can't run. Never set `summaryOnly`.

**Keep every call small.** A result too large to return is not shown to you: you only get a note that it was saved to a file, which you cannot read. That is NOT "no line items" and NOT "no data".
- Read `list_invoices` one type and one **month** at a time (bills `Type=="ACCPAY"` for July, then August, then September; then sales invoices the same way), and `list_bank_transactions` one month at a time.
- If a reply says the result was too large or saved to a file, **halve the date range** (half a month, then a week) and call again until each reply comes back in full. Never record a check as not run because of a too-large reply; split it instead.
- Read contacts only for the contacts on this quarter's documents: `list_contacts` with `ids` (comma-separated ContactIDs, about 25 at a time) and `page: 1`.
- Read the trial balance (`get_trial_balance` at `periodEnd`) on every job: the suspense check depends on it. Do it first, before the large reads.

| Call | For |
|---|---|
| `list_tax_rates`, `list_accounts` | tax types and rates; account names, types and default tax types |
| `list_invoices` | sales invoices (`Type=="ACCREC"`) and bills (`Type=="ACCPAY"`) with their lines, status, totals, attachments flag |
| `list_credit_notes` | credit notes in the period |
| `list_bank_transactions` | spend and receive money, reconciled flag, attachments flag |
| `list_contacts` | ABNs (`TaxNumber`), default tax types |
| `get_trial_balance` at `periodEnd` | suspense and clearing balances |
| `get_profit_and_loss` for the 12 months to `periodEnd` | income for the GST registration threshold |
| `abr_lookup_abns` (if available) | each supplier's and customer's ABN: status and GST registration |

If ABR tools aren't available, the register checks (`gstFromUnregisteredSuppliers`, `cancelledAbn`, `gstStatusMismatch`) are **not run**: set their `found` flag to false and list them under "Not checked" in the summary with the reason. Never call a check you didn't run "clear".

## 4. The checks

Each row is a check group. Run the groups this practice's checklist lists. The rules match the CRA-10 GST Check report (`$82.50` = the tax-invoice threshold incl. GST; `$75,000` = the GST registration threshold).

| Group | Checks | Rule |
|---|---|---|
| `gstChargedWhileUnregistered` | CHK-031 | GST on any sales invoice or credit note while the business isn't registered for GST |
| `gstOnNonClaimableItems` | CHK-058 | GST claimed on a line coded to an account that normally carries none: wages, salaries, superannuation, PAYG, bank fees or charges, interest, depreciation, amortisation, ASIC, stamp duty, fines, penalties, donations, land tax, income tax, FBT, drawings, dividends |
| `gstAmountMismatch` | CHK-059 | a line's GST isn't the tax rate's share of the line (more than 1 cent out), or one supplier's same account coded both with and without GST in the period |
| `gstWithoutAbn` | CHK-008 | GST claimed on a purchase (bill or spend money) over $82.50 from a contact with no 11-digit ABN |
| `gstFromUnregisteredSuppliers` | CHK-068, 069, 076, 077, 085 | GST claimed on bills or bank payments to a supplier the ABR shows as not registered for GST |
| `gstRegistrationRequired` | CHK-136 | income for the 12 months to `periodEnd` is $75,000 or more and the business isn't registered for GST |
| `unreconciledBank` | CHK-022 | bank transactions dated in the period (up to the end of last month) that aren't reconciled |
| `suspenseBalance` | CHK-125 | an account whose name says suspense, clearing, uncoded, unallocated, holding, uncategorised or "ask my accountant" has a non-zero balance at `periodEnd` |
| `cancelledAbn` | CHK-002, 071, 072, 088 | a bill, payment, invoice or expense in the period with a business whose ABN the ABR shows as cancelled |
| `duplicateBills` | CHK-055, 079, 080 | two bills from one supplier with the same number, or the same amount within 7 days |
| `gstStatusMismatch` | CHK-003 | a contact's GST treatment in Xero differs from the ABR's GST registration |
| `gstAccountWithoutGst` | CHK-129 (heuristic) | an account that defaults to a GST tax type, whose lines in the period mostly have no GST |
| `missingReceipts` | CHK-021, 086 | spend money and bills over $82.50 in the period with nothing attached |
| `draftSalesInvoices` | CHK-033 | sales invoices dated in the period still in draft or awaiting approval |
| `lockDate` | CHK-134, 135 | no lock date, or a lock date more than 6 months before `periodEnd`. Xero leaves `PeriodLockDate` out of `get_organisation` when no lock date is set: a missing field IS the finding "no lock date set" (this check always runs) |


## 5. Client questions

For findings only the client can resolve (a missing receipt or tax invoice, a missing ABN, an unexplained or uncoded transaction), draft one short, polite question each in `clientQuestions`: what's needed, the date, the contact and the amount. At most 15; group small ones. No figures you didn't read from Xero.

## 6. The summary file (status: Checking)

Write it to `BAS reviews/<client name> <period label>.md` with `files_write`:

- a heading with the client and the period (with the dates);
- an "Outcome" line right under the heading: "Awaiting reviewer approval" while you write it in Checking. In Recording, after the approved run, replace it with an "Outcome" section: the outcome in words (Ready to lodge, Ready once the client answers, Not ready), approved by the reviewer on the date, their note if any, and in one or two lines what must happen before the BAS can be lodged (for Not ready: the Stop findings to clear);
- the GST registration and basis, and "Read from Xero only: nothing was changed in Xero and nothing was lodged.";
- a table of findings: group, check, what was found, count, amount, and Stop or Note (from the checklist); "No findings" when there are none;
- "Not checked", with the reason for each group you couldn't run (for example ABR not connected);
- the drafted client questions, if any;
- "For the line-by-line detail, open the BAS Related Transactions and GST, GST Check and Contacts for BAS reports for this client and quarter."

Figures only from what you read in Xero.

## 7. What to record when you move on

The platform won't let the job leave a status until its outputs are supplied with the move:

- **Finding the client:** `clientName`, `xeroTenantId`, `periodLabel`, `gstRegistered`, `gstBasis`.
- **Checking:** `findings` (each `{group, check, title, count, amount}`), `stopFindings` (one line each for groups the checklist marks Stop: "CHK-058: GST claimed on 2 bank fee lines, $3.20"), `clientQuestions`, `summaryFile`.
- **Recording:** `outcome` (the outcome the reviewer approved).

## 8. The outcome (status: Waiting for review)

- `readyToLodge` only when there are no findings at all, and never while `stopFindings` is not empty (the record tool refuses it).
- `readyOnceClientAnswers` when every finding is one the client can resolve (a receipt, an ABN, an explanation).
- `notReady` otherwise.
