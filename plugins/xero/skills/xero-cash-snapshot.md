---
name: xero:cash-snapshot
description: One-screen view of current accounts receivable plus last month's profit and loss.
---

# /xero:cash-snapshot

Give the user a fast, single-screen view combining where cash is tied up
in receivables with how the business actually performed last month.

## Instructions

1. Compute the date range for the **previous full calendar month** relative
   to today. Example: if today is 2026-04-10, the range is
   `from_date=2026-03-01`, `to_date=2026-03-31`.
2. Make three tool calls (in parallel is fine):
   - `list_invoices(status="AUTHORISED", limit=100)`
   - `get_profit_and_loss(from_date=<start>, to_date=<end>)`
3. From `list_invoices`, compute:
   - **Total AR** = sum of `amount_due` for invoices with `amount_due > 0`
   - **Overdue AR** = same, but restricted to `due_date < today`
   - Invoice counts for each
4. From `get_profit_and_loss`, walk the `rows` structure to extract:
   - **Revenue** for the period (the Income / Total Income row)
   - **Expenses** for the period (the Total Expenses or equivalent row)
   - **Net profit** for the period
   If the report structure does not contain an obvious match, report the
   raw line labels you did find and ask the user to confirm which one
   represents revenue / expenses, rather than guessing.
5. Produce the output in this exact order:
   - **Headline** - one sentence:
     `AR <TOTAL> <CURRENCY> (<OVERDUE> overdue); <MONTH YEAR> net profit <NET> on <REVENUE> revenue.`
   - **Receivables** bullets:
     - Total AR: amount and invoice count
     - Overdue AR: amount and invoice count
   - **Last month (<MONTH YEAR>)** bullets:
     - Revenue
     - Expenses
     - Net profit (or loss)
6. At most six bullets total below the headline. No prose paragraphs.

## Rules

- Every figure must come from the two tool responses in this turn. Never
  estimate, never carry forward, never invent a category that does not
  appear in the P&L response.
- Use the `currency_code` returned by Xero for AR. Use whatever currency
  the P&L report returns for last month - if they differ, call that out
  explicitly rather than combining them.
- Short bullets only. No emojis.
- If either tool call fails, state which one failed and show the partial
  picture from the successful call. Do not fabricate the missing numbers.

## When to use

Trigger on open-ended questions like "how's the business doing", "give me
a snapshot", "cash flow overview", "where do we stand". For a dedicated
AR view use `/xero:who-owes-me`; for a dedicated P&L summary use
`/xero:reports`.
