---
name: basiq-affordability-check
description: Run an affordability or income analysis for a Basiq user. Use when the user wants to assess borrowing capacity, verify income, analyse expenses, or generate an affordability report for a bank customer.
---

# Affordability and income analysis

Use Basiq's affordability and analytics endpoints to derive income, expense, and affordability signals from consented banking data.

## When to use this skill

- Loan pre-qualification or credit assessment workflows
- Verifying stated income against real bank data
- Expense categorisation and spending pattern analysis
- Generating an affordability summary for a specific user

## Inputs needed

- **User ID** — the Basiq user whose banking data will be analysed
- **Analysis type** — affordability report, income verification, or expense breakdown (clarify with the user)
- **Snapshot date or period** (optional) — defaults to the most recent available data

## How to proceed

1. Call `search-endpoints` with "affordability" or "income" to locate the relevant endpoints.

2. Call `get-endpoint` for each candidate endpoint to understand required inputs and what the response returns (e.g. regular income amount, income frequency, expense categories, surplus).

3. Call `execute-request` to retrieve the affordability or income data for the specified user.

4. Present findings clearly:
   - Regular income (amount, frequency, source accounts)
   - Total monthly expenses broken down by category
   - Net surplus / deficit
   - Flags or confidence indicators if the API returns them

## Constraints

- Affordability data is only available if the `affordability` route group is enabled in the user's Basiq application and the user has an active, consented bank connection.
- Do not make lending decisions yourself — present the data and let the user interpret it.
- Income and expense figures are derived estimates, not guaranteed values; state this when presenting results.
- If the affordability endpoints are not available (`list-endpoints` returns none), tell the user to enable the affordability route group in the Basiq Dashboard.
