# Coding

Prompt ID M18. Menu: Reporting › Reports › Banking › Coding.

Use `list_bank_statement_lines` (date range, `account_uid` optional — omit to cover all bank accounts). Group results by `Status`: `Uncoded`, `Coded`, `Hidden`. Show a summary card per status (count + total amount) and a detail table per group.

The point of this report is completion tracking — surface the Uncoded count/total prominently (that's the actionable backlog), not buried below Coded.

## Interactivity

* Declare `from_date`/`to_date` inputs.
* Declare an optional `account` enum input (from `list_accounts` type=Bank) mapped to `account_uid`; when omitted, the report covers every bank/credit-card account.
* `persona` input per the foundation skill — Client/Executive personas show only the summary cards (counts/totals per status), Bookkeeper/Practitioner show the detail tables.

## Sources & limitations

Tool used: `list_bank_statement_lines`, same underlying `Banking/Statement` endpoint as Bank Transactions — this report just groups the same data by `Status` instead of showing it chronologically. Same undocumented-filter caveat as Bank Transactions applies.
