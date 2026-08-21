---
name: atlassian-confluence-search
description: Find Confluence spaces and pages using CQL search via search_confluence. Use when the user asks about Confluence pages, documentation, wiki content, FAQs, or knowledge-base articles.
---

# Find Confluence spaces and pages

## A version-split worth knowing

Confluence's REST API is split across two versions by *resource*, not
consistently: spaces and pages use the current v2 API
(`/wiki/api/v2/...`), but CQL content search has **not** been migrated to v2
— it still only exists on the v1 endpoint. `search_confluence` already
points at the right one; don't be surprised the tool names don't all share
one version number under the hood.

## Choosing the right tool

| Situation | Tool |
|---|---|
| Which spaces exist / which one has a page you're looking for | `list_confluence_spaces` |
| Flexible search — title, label, space, content, anything CQL can express | `search_confluence` |
| You already know the exact page ID | `get_confluence_page` |

## `search_confluence` — CQL reference

```
cql      string   Required. A valid CQL query.
limit    integer  1–100. Default 20 (capped at 25 if you also request an
                   expanded body representation — not something this
                   connector's tools currently do).
start    integer  Pagination offset. Defaults to 0.
```

### Common CQL patterns

| Need | CQL |
|---|---|
| Pages labeled as FAQ/knowledge-base content | `type = page AND label = "faq" ORDER BY lastmodified DESC` |
| Recently updated pages, no label assumption | `type = page ORDER BY lastmodified DESC` |
| Pages in one space | `type = page AND space = "ENG" ORDER BY lastmodified DESC` |
| Free-text search across page titles/content | `type = page AND text ~ "onboarding"` |

**Don't assume a customer has labeled their content "faq" or similar** —
that's a per-customer convention, not a platform guarantee. If a label-based
query returns nothing, fall back to a plain recency- or space-scoped query
and say so, rather than reporting "no FAQ content exists."

## Response shape

Each result includes a `content` object (id, type, status, title, space,
version) plus top-level `title`, `excerpt` (a highlighted text snippet
matching the query), `url` (site-relative), `lastModified`/
`friendlyLastModified` (Confluence's own pre-formatted relative-time
string), and `score`. Prefer `excerpt` over fetching the full page body when
answering a question — it's usually enough context, and avoids an extra
`get_confluence_page` round-trip.

## `get_confluence_page` — body formats

`body_format` controls what shape the page content comes back in:
`storage` (default — Confluence's canonical XHTML-based format),
`atlas_doc_format` (ADF JSON), or `view` (rendered HTML). None of these are
plain text — whichever you request still needs parsing/stripping before
presenting to a user as prose.

## Multi-site accounts

Confluence shares the same site list as Jira — call `list_sites` if unsure
which `cloud_id` to pass; a site with Confluence disabled simply won't have
`read:page:confluence`/`read:space:confluence`/`search:confluence` in its
granted scopes.
