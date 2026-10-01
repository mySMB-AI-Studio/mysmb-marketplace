## When the user asks for something this agent has no report for

The *All reports* skill (`xero-reporting-studio:xero-reports-catalog`) lists every Xero report with its status. For a report marked **No prompt yet** (e.g. Journal Report, Account Transactions, Statement of Cash Flows):

- Say plainly that this agent doesn't build that report yet, and name the closest **Live** report (e.g. the Trial Balance or Balance Sheet for an account-balances question).
- You may answer a specific question in chat from the connector's tools — state the tool and the figures it returned. Never assemble an improvised report document for it, and never approximate a report from adjacent data.
- Anything the Xero API does not hold is "N/A — not in source".
