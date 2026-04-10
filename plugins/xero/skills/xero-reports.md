---
name: xero:reports
description: Summarise the last month's Xero profit and loss in plain English.
---

# /xero:reports

Produce a concise, plain-English summary of the most recent full calendar
month's profit and loss for the connected Xero tenant.

## Instructions

1. Compute the date range for the **previous full calendar month** relative to
   today. For example, if today is 2026-04-10, the range is
   `from_date=2026-03-01` and `to_date=2026-03-31`.
2. Call the Xero MCP tool `list-profit-and-loss` with those dates as
   `fromDate` / `toDate` (or equivalent field names the server exposes).
3. From the structured response, produce a summary that includes:
   - Total revenue for the period.
   - Total expenses for the period.
   - Net profit (or loss) and the margin as a percentage of revenue.
   - The top 3 expense categories by amount.
   - Any line items whose absolute value is more than 20% of total expenses -
     call these out as "worth a closer look".
4. Every figure in the summary **must** come directly from the tool response.
   Never estimate, never round in a way that changes the meaning, and never
   invent a category that is not in the response.
5. Format the summary as short bullet points, not prose paragraphs. Finish
   with a one-sentence headline like "March 2026: net profit of $X on $Y
   revenue (Z% margin)."

## When to use

Use this command when the user asks anything like "how did we do last month",
"give me last month's P&L", or "monthly report". For custom date ranges, call
`list-profit-and-loss` directly instead of using this command.
