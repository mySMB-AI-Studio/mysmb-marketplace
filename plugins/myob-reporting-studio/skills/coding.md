---
name: MYOB Coding
description: Bank transactions grouped by coding status (coded vs uncoded), from the bank-feed statement.
---

# Coding

Prompt ID M18. Menu: Reporting › Reports › Banking › Coding.

Use `list_bank_statement_lines` (date range, `status: "All"`, `page_index: 0` to fetch every page, `account_uid` omitted to cover every bank and credit-card account). Group results by `Status`: `Uncoded`, `Coded`, `Hidden`. Show a summary card per status (count + total amount) and a detail table per group.

The point of this report is completion tracking — surface the Uncoded count/total prominently (that's the actionable backlog), not buried below Coded.

## Interactivity

* Declare `from_date`/`to_date` inputs.
* Declare an optional `account` `string` UID input (maxLength 36), its dropdown filled client-side from a `list_accounts` binding filtered to `Type` `Bank` or `CreditCard` (non-header). For "all accounts" the binding omits `account_uid` — never pass `""`. Scope to one account by filtering the already-fetched lines client-side, or with a second, `account_uid`-filtered binding called via `getData` only once a real UID is chosen.
* `persona` and `company_file` inputs per the foundation skill — Client/Executive personas show only the summary cards (counts/totals per status), Bookkeeper/Practitioner show the detail tables.

## Sources & limitations

Tool used: `list_bank_statement_lines`, same underlying `Banking/Statement` endpoint as Bank Transactions — this report just groups the same data by `Status` instead of showing it chronologically. Same undocumented-filter caveat as Bank Transactions applies.
