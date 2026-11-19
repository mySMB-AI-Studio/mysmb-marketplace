---
name: client-report-analytics-agent-report-on-request
description: Work a WorkQ item that asks the Client Reporting Agent for a client report - read the request, confirm the client and period, reuse or create the live report from the Client Report Analytics template, link it on the item and close it. Use for every report request that reaches the agent's inbox or chat.
---

# Client report on request

Use when a WorkQ item assigned to you, or a chat message, asks for a client report ("Health check for Irvine Jackson, last quarter"). Load `client-report-analytics-agent-foundation` first: it gives the template and the inputs.

## In the WorkQ inbox

1. Read the item with `todo_get`, then `todo_comments`. The request is the title, the description and the latest comments together.
2. Work out the report (foundation table), the client and the period. If any of them is missing or ambiguous, post one `todo_comment` that asks for exactly what's missing, offers the default ("I'll use last quarter, Jul–Sep 2026, unless you say otherwise"), and leave the item open with `todo_update` status `in_progress`. Stop there. You'll get the item again when someone replies.
3. Find the client with `list_connections` (xero-accounting). If no Xero organisation matches, comment with the names you can see, leave the item open, and stop.
4. Check for an existing copy: `artifact_list` with `query` = the title you would give it (foundation, Inputs 4). If a report for the same template, client and period exists, reuse it: don't create a second copy. The report refetches its data on every open, so an existing copy is current.
5. Otherwise call `artifact_from_template` exactly as the foundation skill says.
6. Post one `todo_comment` with:
   - each report as a named Markdown link: `[<report title>](<the URL the tool returned>)`, for example `[Health Check — Irvine Jackson Pty Ltd — Jul–Sep 2026](/reports/…)`. Never post a bare path,
   - one line on what the report shows and for which client and period,
   - "The banner at the top shows the report's own checks; a red line means a figure didn't tie and shouldn't be relied on.",
   - the connections the person opening it needs, if more than Xero (foundation, "What the person opening the report needs").
7. `todo_update` status `done`. Leave it open (`in_progress`) instead if the requester asked for anything you couldn't do; say what in the comment.

One item can ask for several reports for one client (for example the three BAS reports). Create each, and put all the links in the one comment.

## A BAS readiness review request

A request to review whether a client's BAS is ready ("BAS review for Irvine Jackson, last quarter", "is <client> ready to lodge?") is a job for the **BAS readiness review** process, not a report:
1. Work out the client (its Xero name) and the BAS quarter (periodStart and periodEnd, YYYY-MM-DD; "last quarter" is the last complete calendar quarter). Ask once if either is missing.
2. If you have list_my_processes and process_start: start `bas-readiness-review` with inputs clientName, periodStart and periodEnd, record the runId on the item with todo_plan_set (mode "process"), and comment the job's WorkQ link. If you don't have them, reply that the person should press **Start a process → BAS readiness review** on your page (or ask mySidekick to start it) with the client and quarter.
3. Either way, create the three live reports for that client and quarter (BAS Related Transactions and GST, GST Check, Contacts for BAS) and post them on the item as named links: the review's reviewer opens them for the line-by-line detail.
You never decide whether a BAS is ready, never lodge and never contact the client.

## In chat

Steps 2–5 the same, with questions asked in the conversation. Reply with the report button the tool returns and the same lines as step 6.

## Never

- Change anything in Xero, or send anything to a client. You only create reports and comment on WorkQ items.
- Quote figures in the comment. The report holds them, validated; a figure you type can't be checked.
- Mark an item done without a working report link, or after an error. On an error, comment the error word for word and leave the item open.
- Create reports for a client the item doesn't name, or for more clients than it asks for.

Example: an item "Health check for Irvine Jackson, last quarter" assigned to you → `todo_get` / `todo_comments` → `list_connections` → `artifact_list` (none) → `artifact_from_template` (`client-xero-health-check`, `org` = Irvine Jackson's tenantId, `display` with `"p":"last_quarter"`) → `todo_comment` with the link and the banner line → `todo_update` `done`.
