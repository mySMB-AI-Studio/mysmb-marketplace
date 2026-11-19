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
- A row's marking can be a condition, such as "Stop on accrual basis, Note on cash basis". Apply it with what you know: the GST basis from Finding the client, and the tool's detail (for suspense: how many documents dated in the period are coded to the account). In the summary, say which way it went and why.
- If the file has no row for a group the default below has (a check added since the file was written), add that row with the default marking, keep every other row exactly as it is, and say in a job comment which rows you added.

The default (a bookkeeper's recommendation, November 2026, with the practice's own interim answers of 16 and 19 November until the bookkeeper answers the follow-up questions; the GST rows are still provisional):

```markdown
# BAS readiness checklist

Mark each group Stop (must be fixed before lodging) or Note (flag it, carry on). Remove a row to skip that check.

| Group | Checks | Stop or Note |
|---|---|---|
| gstChargedWhileUnregistered | CHK-031 GST on sales or credit notes while not registered | Stop |
| gstOnNonClaimableItems | CHK-058 GST claimed on items that normally carry none | Stop |
| gstAmountMismatch | CHK-059 GST that isn't the rate's share of the line | Stop |
| gstWithoutAbn | CHK-008 GST claimed over $82.50 from a supplier with no ABN and no document attached (with a document attached it's listed under Also seen: check the invoice) | Stop |
| gstFromUnregisteredSuppliers | CHK-068/069/076/077/085 GST claimed from suppliers not registered (ABR) | Stop |
| gstRegistrationRequired | CHK-136 income over $75,000 without GST registration | Stop |
| unreconciledBank | CHK-022 bank transactions not reconciled | Stop |
| suspenseBalance | CHK-125 suspense or uncoded account with a balance | Stop when documents dated in the period are coded to it; Note when the whole balance is from earlier periods |
| cancelledAbn | CHK-002/071/072/088 dealings with a cancelled ABN (ABR) | Stop |
| duplicateBills | CHK-055/079/080 the same bill raised or paid twice | Stop |
| gstStatusMismatch | CHK-003 a contact's GST status differs from the ABR | Note |
| gstAccountWithoutGst | CHK-129 a GST account mostly without GST (heuristic) | Note |
| missingReceipts | CHK-021/086 spend money and bills over $82.50 with GST claimed and nothing attached (tax invoices are needed before claiming GST; items with no GST are listed under Also seen) | Stop |
| draftSalesInvoices | CHK-033 sales invoices dated in the period still in draft or awaiting approval | Stop on accrual basis, Note on cash basis |
| lockDate | CHK-134 no lock date, or one older than 6 months | Note |
| lockDateChanged | CHK-135 the lock date was moved back or removed since the last review (someone may have edited a closed period) | Stop |
| taxCodeMismatch | Lines coded GST-free or BAS Excluded where the account or supplier normally carries GST (heuristic; exports and input-taxed lines are left out) | Note |
| priorPeriodAdjustments | Documents dated before the period that changed after the previous BAS (flag only) | Note |
| clientQuestionsOpen | Client questions from the previous review still open | Stop when about GST or at or above the material amount in setup; Note otherwise |
```

## 2. Find the client and the period (status: Finding the client)

- The job's inputs give `clientName`, `periodStart` and `periodEnd` (YYYY-MM-DD).
- Call `list_connections` and match `clientName` to a `tenantName`. Use its `tenantId` as `xero_tenant_id` on every other call. If nothing matches, or two do, ask for help and name the organisations you can see. Never guess.
- Call `get_organisation`: record whether the business is registered for GST (`gstRegistered`), its GST basis (`gstBasis`: cash or accrual) and a period label such as "Jul–Sep 2026" (`periodLabel`). Say in a job comment if the period doesn't look like one of its BAS periods.

## 3. Run the checks (status: Checking)

**Call `get_xero_bas_readiness_checks` once** with `xero_tenant_id`, `periodStart` and `periodEnd` (add `gstRegistered` only if a person told you). Add `changedSince` as the setup setting `prior_period_from` says:

- `previous_review` (the default, also when the setting isn't listed): the date the previous BAS review for this client was approved, read from the Outcome section of its summary file in `BAS reviews/` (the period just before this one).
- `lock_date`: the client's lock date (`organisation.lockDate` from Finding the client, or the row in `BAS readiness/Lock dates.md`). With no lock date, use the previous review's approval date.

If neither date exists, leave `changedSince` out (the tool then uses `periodStart`). Say in the summary which date you used and why. It reads the whole period on the Xero side (every invoice, bill, credit note and bank transaction with its lines, the period's contacts and ABNs, the trial balance at `periodEnd` and the 12 months' profit and loss) and returns only:

- `organisation`: GST registration (and whether it was inferred), GST basis and period, lock date;
- `read`: how many documents it read, and `truncated` (anything it couldn't read in full);
- `findings`: one per group with `checks`, `title`, `count`, `amount` and up to 10 example `items` (date, contact, reference, amount, detail, Xero link; `more` = how many weren't listed);
- `clear`: groups that ran and found nothing;
- `notRun`: groups it couldn't run, with the reason (the ABR register groups are always here);
- `alsoSeen`: bills still in draft or awaiting approval (not in the BAS figures yet);
- `limitations`: what the checks can't see. Copy these into "Not checked" in the summary.

For a suspense balance, list each item the tool names with its amount, date and GST, and say which could affect GST or other BAS labels; any part of the balance from before the period is outside this BAS.

### 3a. The lock date (you run this check)

Keep each client's lock date in `BAS readiness/Lock dates.md`, a table with the columns Client, Lock date and Recorded on. Read it with `files_read` (create it if it doesn't exist).

- If the client has a row and the tool's `organisation.lockDate` is earlier than the recorded one, or now missing, that's a `lockDateChanged` finding: "Lock date moved from <old> to <new or none> since <recorded on>".
- If the client has no row yet, there's nothing to compare: say so in the summary ("first review: lock date recorded"), not as a finding.
- After the check, write the client's current lock date (or "none") and today's date to the file, keeping every other row.

### 3b. Client questions from the last review (you run this check)

The previous review is the summary file in `BAS reviews/` for the period just before this one. If there are several (a review run twice), use the latest one whose Outcome was approved, never one still awaiting approval.

If it has drafted client questions, carry each one into this review, **whatever its outcome was** (a Not ready review's questions still go to the client):

- If the finding it was about no longer appears in this review's results, list it as "answered or fixed".
- Otherwise it is a `clientQuestionsOpen` finding: **Stop** when it is about GST (GST claimed, an ABN for a GST claim, a tax invoice) or about an amount at or above the setup setting `material_question_amount` (default $1,000 when the setting isn't listed); **Note** otherwise.
- With no earlier summary file, or none with questions, say "no open questions from a previous review" in the summary.

Questions are not tracked anywhere else: the summary file is the record. A person sends them and tells you on the job when they were sent or answered.

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
| `lockDateChanged` | CHK-135 | the lock date is earlier than, or missing compared with, the one you recorded for this client last time (section 3a). You run this one, not the checks tool |
| `taxCodeMismatch` | TAX-CODE (heuristic) | a line with no GST where its account normally carries GST, or the same supplier's other lines to that account carry GST. Say what the transaction looks like it is; the bookkeeper decides |
| `priorPeriodAdjustments` | PRIOR-PERIOD | invoices, bills, credit notes and manual journals dated before the period that changed on or after `changedSince`. Flag only: never count them in this BAS; the bookkeeper or registered BAS agent decides whether each belongs here or in an amendment |
| `clientQuestionsOpen` | CLIENT-Q | a client question from the previous review that is still open (section 3b). You run this one, not the checks tool |


## 5. Client questions

For findings only the client can resolve (a missing receipt or tax invoice, a missing ABN, an unexplained or uncoded transaction), draft one short, polite question each in `clientQuestions`: what's needed, the date, the contact and the amount. At most 15; group small ones. No figures you didn't read from Xero.

## 6. The summary file (status: Checking)

Write it to `BAS reviews/<client name> <period label>.md` with `files_write`:

- a heading with the client and the period (with the dates);
- an "Outcome" line right under the heading: "Awaiting reviewer approval" while you write it in Checking. In Recording, after the approved run, replace it with an "Outcome" section: the outcome in words (Ready to lodge, Ready once the client answers, Not ready), who approved it (the reviewer's name when the decision shows it, otherwise "the reviewer") and the date, their note if any, and in one or two lines what must happen before the BAS can be lodged (for Not ready: the Stop findings to clear);
- the GST registration and basis, and "Read from Xero only: nothing was changed in Xero and nothing was lodged.";
- a table of findings: group, check, what was found, count, amount, and Stop or Note (from the checklist); "No findings" when there are none;
- "Not checked", with the reason for each group you couldn't run (for example ABR not connected), and always "PAYG withholding (W1, W2) and PAYG instalments: not checked by this review". When the setup setting `bas_payg_labels` is `payg_withholding` or `payg_withholding_and_instalments`, add that this practice reports them on the BAS, so they must be checked in payroll before lodging;
- the settings used: the date `changedSince` came from, the material amount for open questions, and the PAYG setting (say "default" where a setting wasn't chosen);
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
