---
name: expense-claim-checker-scan
description: Review outstanding reimbursement bills in Xero for duplicates, mis-coding, mixed charges and missing receipts, and build the findings. Use in Check expense claims before pay run (scan), weekly.
---

# Expense claim checks (Xero)

Pull outstanding reimbursement bills: `list_invoices` with `where: Type=="ACCPAY" AND Status=="AUTHORISED"`, filtered to the nominated reimbursement account(s) from the run's inputs. `list_invoices` never returns line items — fetch each bill's full detail with `get_invoice` to see its lines.

## Checks

| Check | What | Severity |
|---|---|---|
| ECC-001 Mis-coded line | The line item's own description doesn't match the nature of the account it's coded to (e.g. "taxi fare" on a "Cleaning" account, even though the account itself is valid) | medium |
| ECC-002 Mixed charges | The bill has another line item on a different account riding alongside the reimbursement line — the full bill amount will be paid, not just the reimbursement portion | medium |
| ECC-003 Missing receipt | No attachment (`list_attachments`) on an AUTHORISED reimbursement bill | low |
| ECC-004 Likely duplicate | Same employee contact (resolve via `list_contacts`), same or very close amount, same or nearby date, across two or more bills | high |
| ECC-005 GST looks off | No GST applied where the supplier and amount suggest there should be one | low |

## Findings

One finding per `<ECC id>:<invoice id(s)>`: `check`, `employee` (contact name), `amount`, `text` (one line, quoting the real line description and account name — never a generic "please review"), `link` (deep link into Xero: `https://go.xero.com/AccountsPayable/View.aspx?InvoiceID=<id>`), `severity`. `clean: true` when no employee has an open finding this run.

`summary`: per employee, the count of bills reviewed and any open findings, with the three largest amounts at risk — this is the body of the report step.

## Never

Change, approve, code or pay a bill. Create a batch payment. Guess which account is "the" reimbursement account if more than one is plausible and it isn't named in the run's inputs — report `needsSetup` instead of guessing. Report ECC-005 (a heuristic) as a definite error.
