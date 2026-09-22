# Bank Activity (Prompt ID M15 — Reporting › Reports › Banking › Bank activity)

Use `list_accounts` (check the actual `Type` value used for bank accounts — likely "Bank", confirm against the data rather than assuming, same discovery step Cash Movement already does) to get the set of cash accounts for the account selector. Then use `list_journal_transactions` with `from_date`/`to_date` and `account_uid` set to the selected bank account to get its transaction lines for the period.

Render one chronological row per transaction: date, description, amount, and a running balance computed client-side by accumulating signed amounts in date order (check sign convention against `IsCredit` the same way General Ledger/Cash Movement do — don't assume debit-increases-balance without confirming against a bank/asset account). Show the account's `CurrentBalance` as a separate, clearly-labeled reference figure (not a period closing balance — `list_accounts` has no as-of-date balance, same limitation already disclosed elsewhere).

**Honest substitution — disclose plainly:** this report is built from the general ledger (the same underlying tools as Cash Movement), not MYOB's bank-feed/Banking module directly. It shows the net GL movement and description on each line, but it does NOT distinguish MYOB's own Spend Money / Receive Money / Transfer Money transaction *types* — that categorization lives in the Banking module's own data, which this connector doesn't expose yet. State this in Sources & limitations rather than implying transaction-type detail that isn't there.

Validate: the running balance's final value equals the sum of all period movements (pass-through arithmetic — the tie-out is guaranteed by construction, so a mismatch would indicate a rendering bug, not a data-quality issue).

## Interactivity

* Declare `persona` per the foundation skill.
* Declare a required `account` enum input (populated from the bank-account list) mapped to `list_journal_transactions`' `account_uid` — this report is inherently per-account, unlike Cash Movement's all-accounts summary.
* Declare `from_date`/`to_date` with the same preset picker as General Ledger/Cash Movement.
* Client-side sort/filter over the already-hydrated transaction list.

## Sources & limitations

Tools used: `list_accounts` (bank-type accounts) + `list_journal_transactions` (account-filtered) — the same tools as Cash Movement, no new connector work needed. Does not distinguish Spend/Receive/Transfer Money transaction types (see limitation above); no period-start/end balance, only current balance and computed running total.
