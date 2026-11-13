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

## 3. Run the checks (status: Checking)

**Call `get_xero_bas_readiness_checks` once** with `xero_tenant_id`, `periodStart` and `periodEnd` (add `gstRegistered` only if a person told you). It reads the whole period on the Xero side (every invoice, bill, credit note and bank transaction with its lines, the period's contacts and ABNs, the trial balance at `periodEnd` and the 12 months' profit and loss) and returns only:

- `organisation`: GST registration (and whether it was inferred), GST basis and period, lock date;
- `read`: how many documents it read, and `truncated` (anything it couldn't read in full);
- `findings`: one per group with `checks`, `title`, `count`, `amount` and up to 10 example `items` (date, contact, reference, amount, detail, Xero link; `more` = how many weren't listed);
- `clear`: groups that ran and found nothing;
- `notRun`: groups it couldn't run, with the reason (the ABR register groups are always here);
- `alsoSeen`: bills still in draft or awaiting approval (not in the BAS figures yet);
- `limitations`: what the checks can't see. Copy these into "Not checked" in the summary.

Do **not** redo its checks by reading invoices, bills or bank transactions yourself: a quarter of documents with their lines is too large for you to read (the reply only says it was saved to a file). Use the list tools only to look closer at one finding, small and filtered: one supplier (`contactIDs`), one invoice number (`invoiceNumbers`) or one document (`ids`), always with `page: 1`.

If `abr_lookup_abns` is available, check the ABNs of the contacts in the findings with it, and run the register groups (`gstFromUnregisteredSuppliers`, `cancelledAbn`, `gstStatusMismatch`). Otherwise they stay "not checked" with the reason. Never call a check you didn't run "clear".

## 4. The checks

Each row is a check group; the checks tool runs them all, and you keep the groups this practice's checklist lists, marked Stop or Note from the checklist. The rules match the CRA-10 GST Check report (`$82.50` = the tax-invoice threshold incl. GST; `$75,000` = the GST registration threshold).

| Group | Checks | Rule |
|---|---|---|
| `gstChargedWhileUnregistered` | CHK-031 | GST on any sales invoice or credit note while the business isn't registered for GST |
| `gstOnNonClaimableItems` | CHK-058 | GST claimed on a line coded to an account that normally carries none: wages, salaries, superannuation, PAYG, bank fees or charges, interest, depreciation, amortisation, ASIC, stamp duty, fines, penalties, donations, land tax, income tax, FBT, drawings, dividends |
| `gstAmountMismatch` | CHK-059 | a line's GST isn't the tax rate's share of the line (more than 1 cent out), or one supplier's same account coded both with and without GST in the period |
| `gstWithoutAbn` | CHK-008 | GST claimed on a purchase (bill or spend money) over $82.50 from a contact with no valid ABN |
| `gstFromUnregisteredSuppliers` | CHK-068, 069, 076, 077, 085 | GST claimed on bills or bank payments to a supplier the ABR shows as not registered for GST |
| `gstRegistrationRequired` | CHK-136 | income for the 12 months to `periodEnd` is $75,000 or more and the business isn't registered for GST |
| `unreconciledBank` | CHK-022 | bank transactions and invoice or bill payments dated in the period that aren't reconciled |
| `suspenseBalance` | CHK-125 | an account whose name says suspense, clearing, uncoded, unallocated, holding, uncategorised or "ask my accountant" has a non-zero balance at `periodEnd` |
| `cancelledAbn` | CHK-002, 071, 072, 088 | a bill, payment, invoice or expense in the period with a business whose ABN the ABR shows as cancelled |
| `duplicateBills` | CHK-055, 079, 080 | two bills from one supplier with the same number, or the same amount within 7 days (drafts included) |
| `gstStatusMismatch` | CHK-003 | a contact's GST treatment in Xero differs from the ABR's GST registration |
| `gstAccountWithoutGst` | CHK-129 (heuristic) | an account that defaults to a GST tax type, whose lines in the period mostly have no GST |
| `missingReceipts` | CHK-021, 086 | spend money and bills over $82.50 in the period with nothing attached |
| `draftSalesInvoices` | CHK-033 | sales invoices dated in the period still in draft or awaiting approval |
| `lockDate` | CHK-134 | no lock date, or a lock date more than 6 months before `periodEnd` |


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

Ask: once the client has answered, is the BAS ready, or does the practice still have to change something in Xero?

- `notReady` whenever any Stop finding needs the **practice** to do work in Xero: reconcile bank transactions, recode or clear a suspense balance, remove a duplicate, fix GST coding or amounts. This holds even when the client must answer a question first (for example, what a suspense item was for).
- `readyOnceClientAnswers` only when every open item is just something the **client** sends and no Stop finding needs a change in Xero: a receipt or tax invoice, a missing ABN, an explanation.
- `readyToLodge` only when there are no findings at all, and never while `stopFindings` is not empty (the record tool refuses it).

In the record tool's note, say in one line which findings decided it.
