---
name: atlassian-jsm-queues
description: Find Jira Service Management service desks, queues, requests, and SLA status using list_service_desks, list_queues, list_service_desk_requests, and get_request_sla. Use when the user asks about support tickets, a service desk queue, request status, or whether something is about to breach SLA.
---

# Find JSM service desks, queues, and SLA status

## What this covers

Jira Service Management (JSM) is a separately-licensed Jira product, distinct from plain Jira issue tracking (`atlassian-jira-work.md`) and from Confluence (`atlassian-confluence-search.md`). Not every connected Atlassian site has JSM activated — `list_service_desks` returns an empty list (not an error) when it isn't, so check for that before assuming something is broken.

## Choosing the right tool

| Situation | Tool |
|---|---|
| Which service desks exist on this site | `list_service_desks` |
| Which queues a service desk has (e.g. a team's triage queue) | `list_queues` (needs `service_desk_id`) |
| What requests (tickets) are open/closed in a service desk | `list_service_desk_requests` (needs `service_desk_id`) |
| Full SLA detail for one specific request | `get_request_sla` (needs `issue_id_or_key`) |

## Typical flow

1. `list_service_desks` — if the user hasn't named one and there's more than one, ask which they mean rather than guessing. On a single-service-desk site, just use it.
2. `list_service_desk_requests` with that `service_desk_id`. Defaults to `request_status: "OPEN_REQUESTS"` — pass `"ALL_REQUESTS"` or `"CLOSED_REQUESTS"` explicitly if the user asks about closed tickets or wants everything. This tool always expands SLA and status detail server-side (no separate call needed for the common case).
3. Only call `get_request_sla` directly when you need full SLA detail for one specific request the user already named — `list_service_desk_requests` already carries each request's `sla` block, which is enough for "what's in the queue" / "what's about to breach" style questions.

## Reading SLA data

Each request's `sla.values` (or `get_request_sla`'s `values`) is an array of named clocks — a request commonly has 2-3 running at once, e.g. "Time to first response" and "Time to resolution". Rules for describing SLA status in plain language:

- **`sla` absent or an empty object** — this request's type has no SLA policy configured. Say "no SLA policy on this request," don't imply one exists.
- **A clock with no `ongoingCycle` key at all** — that specific clock hasn't started (e.g. "Time to close after resolution" before the ticket is actually resolved). Don't describe it as "running" or "not breached" — it simply hasn't started yet.
- **`ongoingCycle.breached === true`** — already breached. This is always the most urgent thing to surface, regardless of any other clock's time remaining.
- **Otherwise** — use `ongoingCycle.remainingTime.friendly` (Atlassian's own pre-formatted string, e.g. "45m") as-is; don't recompute a duration from `remainingTime.millis` unless `friendly` is missing.
- When a request has multiple running clocks, lead with whichever is breached, or — if none are — whichever has the soonest `remainingTime.millis`. This is the same "most urgent clock" logic the Service Desk Queue widget's `atlassian_sla_tone`/`atlassian_sla_label` widget-elements use (`plugins/atlassian/widget-elements/src/index.ts`), so a query answer and the tile should never disagree about which clock is "the" urgent one for a given request.

## Fields you can and can't rely on

Reliable on every `list_service_desk_requests` result: `issueKey`, `summary` (top-level, not inside `requestFieldValues`), `currentStatus.status`, `createdDate.friendly`, `_links.agent` (an absolute browsable URL). NOT reliable: anything inside `requestFieldValues` — its contents (including whether a `priority`-like field even exists) depend entirely on how each request type was configured on that site. Don't assume a priority field, and don't sort/rank requests by a field you haven't confirmed is actually present in the response.

## Scope caveat

On a shared/admin connection (the usual model for this plugin), JSM results reflect whatever the connected agent/admin account can see — the full service desk queue, not one customer's personal slice of it. If asked "what are my tickets" in a way that implies a specific end customer, say plainly that this connection can't scope to one customer's requests today.

## Out of scope

No write tools — creating, updating, transitioning, or commenting on requests isn't supported via this connector. Direct the user to Jira/JSM directly for changes.
