---
name: surepact-search-grants
description: Search Australian grants by state via SurePact. Use when the user asks about grants, grant funding, funding opportunities, or "what grants are available" for their business, charity, or community organisation.
---

# Search grants

Use the `surepact_search_grants` tool to find currently listed Australian
grants through SurePact's Intelligent Grants API.

## Inputs

- `state` — **required.** One of `ACT`, `NSW`, `VIC`, `SA`, `WA`, `QLD`,
  `NT`, `TAS`. If the user doesn't say which state, ask, or infer it from
  their organisation's location if you already know it.
- `count` — optional, 1–50, default 10. Raise it only when the user asks
  for an exhaustive list.

## Result shape

Each grant has `title`, `description`, `openDate`, `closeDate`,
`fundingAmount`, and `location`.

## Rules

1. **Dates and funding amounts are free-text display strings** supplied by
   the grant publisher (`"9-Jul-2026"`, `"30 March 2026"`, `"Up to
   $450,000"`, `"$4,500,000.00"`). Show them verbatim — never parse,
   compare, or sort by them numerically.
2. **National grants appear in every state's results** with all states
   listed in `location`. When a user asks about multiple states, call the
   tool once per state and dedupe by title before presenting.
3. Descriptions can run to several paragraphs. Summarise them to one or two
   sentences when listing grants; only show a full description when the
   user drills into a specific grant.
4. When presenting results, lead with title, funding amount, and close
   date — that's what users decide on.
5. The tool returns what is currently listed. It has no full-text search,
   no category filter, and no pagination — state and count are the only
   levers.
