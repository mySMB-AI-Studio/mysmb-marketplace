---
name: client-report-analytics-agent-bas-review
description: The review step of the BAS readiness review process - read one client's Xero file for one BAS quarter, run the readiness checks (the CRA-10 GST Check rules plus general readiness checks) and return the findings as JSON for the reviewer's decision. Read-only.
---

# BAS readiness review: the review step

Use when you run the **review** step of the "BAS readiness review" process. You read; you never change anything in Xero, never lodge and never contact the client. The reviewer decides; you give them the facts.

## 1. Find the client and the period

- The job's inputs give `clientName`, `periodStart` and `periodEnd` (YYYY-MM-DD).
- Call `list_connections` once and match `clientName` to a `tenantName`. Use its `tenantId` as `xero_tenant_id` on every other call. If nothing matches, or two do, return `found` all false, `findings: []`, `clientResolved: false` and a `summaryMarkdown` that says which names you can see. Never guess.
- Call `get_organisation`: note whether the business is registered for GST (`PaysTax`), its GST basis (cash or accrual) and its BAS period. Say in the summary if the period you were given doesn't look like one of its BAS periods.

## 2. Read the quarter

Read only what you need, for the period only (Xero `where` filters such as `Date>=DateTime(2026,07,01) AND Date<=DateTime(2026,09,30)`; page while a page comes back full):

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

## 3. The checks

Each group has a `found` flag. Set it **true** if the group has at least one finding. The rules match the CRA-10 GST Check report (`$82.50` = the tax-invoice threshold incl. GST; `$75,000` = the GST registration threshold).

| `found` flag | Checks | Rule |
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
| `lockDate` | CHK-134, 135 | no lock date, or a lock date more than 6 months before `periodEnd` |

The practice decides which groups stop lodgement (its Rules). You don't know its choices, so report every group honestly and let the process apply them.

## 4. Client questions

For findings only the client can resolve (a missing receipt or tax invoice, a missing ABN, an unexplained or uncoded transaction), draft one short, polite question each in `clientQuestions`: what's needed, the date, the contact and the amount. At most 15; group small ones. No figures you didn't read from Xero.

## 5. Return ONLY this JSON

```json
{
  "clientResolved": true,
  "clientName": "Irvine Jackson Pty Ltd",
  "xeroTenantId": "…",
  "periodLabel": "Jul–Sep 2026",
  "found": {
    "gstChargedWhileUnregistered": false, "gstOnNonClaimableItems": false, "gstAmountMismatch": false,
    "gstWithoutAbn": false, "gstFromUnregisteredSuppliers": false, "gstRegistrationRequired": false,
    "unreconciledBank": true, "suspenseBalance": false, "cancelledAbn": false, "duplicateBills": false,
    "gstStatusMismatch": false, "gstAccountWithoutGst": false, "missingReceipts": true,
    "draftSalesInvoices": false, "lockDate": true
  },
  "findings": [
    { "group": "unreconciledBank", "check": "CHK-022", "title": "4 bank transactions in Aug–Sep not reconciled", "amount": 1830.5, "count": 4 }
  ],
  "clientQuestions": ["Could you send the receipt for the $245.00 payment to Officeworks on 12 Aug 2026?"],
  "summaryMarkdown": "…",
  "brief": { "question": "Is Irvine Jackson Pty Ltd ready to lodge its Jul–Sep 2026 BAS?", "facts": ["…"], "recommendation": "…", "recommendedOption": "readyOnceClientAnswers", "consequence": "…", "uncertainty": "…" }
}
```

- `found` must have **all 15 keys**, each `true` or `false`.
- `summaryMarkdown`: a heading line with the client and period; the GST registration and basis; a table of findings by group (check, what, count, amount); a "Not checked" list with reasons; and the line *"For the line-by-line detail, open the BAS Related Transactions and GST, GST Check and Contacts for BAS reports for this client and quarter."* Figures only from what you read.
- `brief.recommendedOption` is one of `readyToLodge`, `readyOnceClientAnswers`, `notReady`. Recommend `readyToLodge` **only** when `findings` is empty. Recommend `readyOnceClientAnswers` when every finding is one the client can resolve, otherwise `notReady`.
