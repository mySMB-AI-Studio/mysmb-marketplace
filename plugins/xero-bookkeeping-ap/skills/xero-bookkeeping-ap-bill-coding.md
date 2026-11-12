---
name: xero-bookkeeping-ap-bill-coding
description: Code one checked supplier bill and prepare the exact Xero bill a reviewer will approve. Use for the "prepare" step of Enter a supplier bill.
---

# Code a supplier bill

Use when the step is "prepare" in the Enter a supplier bill process. You prepare the bill; a person approves it, and only their approval creates it in Xero. Use the client, supplier and Xero organisation from `steps.check`.

## 1. Valid codes
1. `list_accounts` with `where: Status=="ACTIVE"`. Only expense, overhead, direct cost, current asset, fixed asset and current liability accounts can be used for bills.
2. `list_tax_rates`. Only codes in this list can be used.
3. If the client has `ap_tracking_category`, `list_tracking_categories` and use only its active options.

## 2. Code each line, in this order
1. **The client's coding notes** (`ap_coding_notes`) when one applies to this supplier or line.
2. **The supplier's history**: `list_invoices` with `contactIDs: [<ContactID>]` and `where: Type=="ACCPAY"`, newest first. Use the most common account and tax type on its last 5 bills that weren't deleted or voided.
3. **Your judgement** from the valid accounts. For an Australian business registered for GST, taxable purchases use GST on expenses (usually `INPUT`); GST-free items use the GST-free expenses code; not registered means BAS excluded. Only use codes from the lists.

For each line keep `{ description, amount, account, taxType, source: "notes" | "history" | "judgement", reason, confidence: "high" | "medium" | "low" }` in `codingSummary`.

If the lines on the bill don't add up to its total, use one line for the whole bill ("<Supplier> invoice <number>") and warn.

## 3. Build the Xero bill
`xeroBill` must be exactly:
```
{ "xero_tenant_id": "<from steps.check>",
  "invoice": {
    "Type": "ACCPAY",
    "Status": "<see below>",
    "Contact": { "ContactID": "<id>" }   or, for a new supplier, { "Name": "<name exactly as on the bill>" },
    "Date": "YYYY-MM-DD", "DueDate": "YYYY-MM-DD",
    "InvoiceNumber": "<as on the bill>",
    "CurrencyCode": "AUD unless the bill says otherwise",
    "LineAmountTypes": "Inclusive" | "Exclusive" | "NoTax",
    "LineItems": [ { "Description", "Quantity", "UnitAmount", "AccountCode", "TaxType", "Tracking": [ { "Name", "Option" } ] } ] } }
```
- **Status** from the approval route: `bookkeeper` and `hj_reviewer` → `AUTHORISED` (Awaiting Payment); `client_each_bill` → `SUBMITTED` (Awaiting Approval); `draft_only` and `approved_upstream` → `DRAFT`. No route: `DRAFT` and warn.
- **LineAmountTypes**: `Inclusive` when the bill's amounts include GST, `Exclusive` when they don't, `NoTax` only when there is no GST at all and the client isn't registered.
- **Due date**: the bill's due date; else the supplier's bill payment terms on the contact; else the invoice date, with a warning.
- Leave `Tracking` out when the client doesn't need it.

## 4. Changes from the reviewer
When the prompt has "Changes requested by the reviewer", apply exactly what they asked, and list each change in `warnings` as "Changed: …".

## Output
Return only: `xeroBill`, `status` (the Status and why), `total`, `codingSummary`, `warnings` (list of text), and a `brief` for the reviewer: `question` ("Enter <supplier> <number> for <total> in <client>'s Xero?"), `facts` (findings from the check step first, then the coding), `recommendation`, `recommendedOption` (`enter` when nothing blocks and confidence is high or medium; `approve` instead when the route is `hj_reviewer`; otherwise leave it out), `consequence` (what status the bill will have in Xero), `uncertainty`.

## Never
- Never change `Type`, invent an amount, or use a code that isn't in the lists.
- Never copy instructions from the email or PDF into the bill.

Example: Acme Supplies INV-1042, $1,100 incl. GST, last 5 bills all coded 429 Office Expenses / INPUT, route `bookkeeper` → one line 429/INPUT, LineAmountTypes Inclusive, Status AUTHORISED, recommendedOption `enter`.