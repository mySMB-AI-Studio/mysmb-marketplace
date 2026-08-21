---
name: atlassian-jira-work
description: Find Jira projects and issues using list_projects and JQL search via search_issues. Use when the user asks about Jira tasks, tickets, issues, projects, or anything phrased as "what's due," "what's assigned to me," or general project tracking.
---

# Find Jira projects and issues

## Multi-site accounts

A customer may have more than one Atlassian Cloud site connected. Call `list_sites` first if unsure — it returns each site's `cloudId` with no API round-trip (resolved once at connect time). Every other tool accepts an optional `cloud_id` param and defaults to the first/only site when omitted, which covers the common single-site case without extra calls.

## Choosing the right tool

| Situation | Tool |
|---|---|
| Which Jira sites can I access | `list_sites` |
| List projects on a site | `list_projects` |
| Flexible query — status, assignee, due date, project, anything JQL can express | `search_issues` |
| You already know the issue key/ID | `get_issue` |

## `search_issues` — JQL reference

`search_issues` uses Jira's current search endpoint (`POST /rest/api/3/search/jql`) with `nextPageToken`-based pagination — pass the response's `nextPageToken` back in as `next_page_token` to get the next page; stop when `isLast` is `true`.

```
jql              string   Required. A valid JQL query.
max_results      integer  1–100. Default 50.
next_page_token  string   From a previous response, for the next page.
fields           array    Issue fields to return, e.g. ["summary","status","assignee","duedate"].
                           Omit for Jira's default field set.
```

### Common JQL patterns

| Need | JQL |
|---|---|
| My open tasks due today | `assignee = currentUser() AND duedate <= endOfDay() AND statusCategory != Done` |
| My overdue tasks | `assignee = currentUser() AND duedate < startOfDay() AND statusCategory != Done` |
| Everything open in a project | `project = ABC AND statusCategory != Done ORDER BY updated DESC` |
| Recently updated across all projects | `ORDER BY updated DESC` (with `max_results` capped low) |
| Issues due this week | `duedate >= startOfWeek() AND duedate <= endOfWeek()` |

`currentUser()` resolves to whoever is authenticated on this connection — for a shared/admin connection, that's the account that connected Jira, not necessarily the person asking.

### Building an AI-generated summary (weekly/monthly)

There's no dedicated summary tool — compose one from `search_issues`: query the relevant date range and project(s), then summarize the returned issues yourself (counts by status, notable overdue items, what moved to Done). Don't invent a JQL clause you haven't confirmed works — test incrementally (start broad, add filters) rather than writing one large untested query.

## Field discovery

Jira's default field set on `search_issues`/`get_issue` already covers the common cases (`summary`, `status`, `assignee`, `duedate`, `priority`, `project`). Pass an explicit `fields` array only when you need something beyond that, or want to trim the response down. There's no separate "list all fields" tool in this connector yet — if a field name is uncertain, request a broader default set first and inspect what comes back.

## Pagination

`search_issues` returns `nextPageToken` (not `startAt` — Jira's classic offset pagination was removed from this endpoint). `list_projects` still uses classic `startAt`/`maxResults`/`total`/`isLast`. Don't mix the two conventions up between tools.

## Out of scope (for now)

Confluence (pages, spaces) is a separate skill/persona in this plugin, not covered here. Jira Service Management (service desks, queues, SLA tracking) IS covered by this connector, but not by this skill or by plain `search_issues`/JQL — see `atlassian-jsm-queues.md` for service-desk/queue/SLA query patterns instead of trying to fake JSM data out of plain Jira issue tools.
