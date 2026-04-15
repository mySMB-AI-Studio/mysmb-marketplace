---
name: deskcrm-accounts-pipeline
description: Summarise the deskcrm Accounts pipeline by stage, industry, or owner. Use when the user asks "how's the pipeline", "what deals do we have", "show me customers by industry", or wants an ARR / renewal view.
---

# Accounts pipeline summary

Use `list_accounts` to pull rows from the Accounts sheet, then summarise locally. This skill is about aggregation and framing, not raw dumps.

## Stages

`prospect` → `qualified` → `customer` → `churned`.

## Typical asks

| User says | Approach |
| --- | --- |
| "How's the pipeline this quarter?" | `list_accounts` with no filters, group by stage, show counts + total ARR for customers. |
| "Who's up for renewal in the next 90 days?" | `list_accounts`, filter locally by `renewalDate` between today and today+90. |
| "Show me customers in manufacturing." | `list_accounts` with `stage: "customer"` and `industry: "Manufacturing"`. |
| "What are Ramona's accounts?" | `list_accounts` with `owner: "Ramona"`. |
| "Biggest customers by ARR." | `list_accounts` with `stage: "customer"`, sort descending by `arr`. |

## How to use

1. Decide whether the user wants a **list** (show rows) or a **summary** (counts, totals, groupings). Default to summary for pipeline-style questions.
2. Call `list_accounts` once. Set a generous `limit` (default 100 is fine for the sample data).
3. Do any grouping and ARR math yourself — the server does not aggregate.
4. Present the result as a small table or bullet list. Lead with the headline number the user cares about (total customers, total ARR, number of renewals due).

## Rendering

- Format `arr` as USD with thousands separators (e.g. `$18,000`).
- Format `renewalDate` as "MMM D, YYYY" when showing it to the user.
- Only include `notes` when the user explicitly asks for context — otherwise they clutter the summary.

## Drilling in

When the user wants detail on a specific account from the summary, call `get_account` with its `id` rather than re-filtering `list_accounts`.
