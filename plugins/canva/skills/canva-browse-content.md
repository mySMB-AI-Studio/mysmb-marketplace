---
name: canva-browse-content
description: Find and inspect Canva designs, brand templates, folders, comments, and assets using the read-only list_/get_ tools. Use when the user asks to find, list, search, or look up any Canva design, template, folder, comment, or asset.
---

# Browse Canva content

This connector is **entirely read-only** — there is no create/edit/upload/export tool. Use it to find and inspect existing Canva content, not to make changes.

## Choosing the right tool

| You want to... | Tool |
|---|---|
| Find designs by name/keyword, or list recent ones | `list_designs` |
| Get one design's metadata by ID | `get_design` |
| See a multi-page design's pages | `get_design_pages` |
| Find brand templates by name/keyword, or list them | `list_brand_templates` |
| Get one brand template's metadata by ID | `get_brand_template` |
| Check whether a brand template supports autofill, and its fields | `get_brand_template_dataset` |
| Browse a folder's contents (subfolders, designs, images, templates) | `list_folder_items` |
| Get one folder's metadata by ID | `get_folder` |
| Read a comment or suggestion thread on a design | `get_comment_thread` |
| Read the replies on a comment thread | `list_comment_replies` |
| Get one asset's (image/video) metadata by ID | `get_asset` |
| Get the connected user's display name | `get_profile` |

## `list_designs` parameters

```
query        string   Free-text search term (max 255 chars). Omit to list without filtering.
continuation string   Pagination cursor from a previous call's continuation. Omit for page 1.
ownership    string   "any" (default) | "owned" | "shared"
sort_by      string   "relevance" (default) | "modified_descending" | "modified_ascending" |
                       "title_descending" | "title_ascending"
limit        integer  1-100. Default 25.
```

Returns `{ items, continuation }` — each item has `id`, `title`, `owner`, `thumbnail`, `urls` (`edit_url`/`view_url` — **expire after 30 days**), `created_at`, `updated_at`, `page_count`, `design_types`.

## `list_brand_templates` parameters

Same shape as `list_designs`, plus:

```
dataset   string   "any" (default) | "non_empty" — filter to templates with autofill fields set up.
```

Returns `{ items, continuation }` — each item has `id`, `title`, `view_url`, `create_url`, `created_at`, `updated_at`, `thumbnail`.

## `list_folder_items` parameters

```
folder_id     string    Required. Use the user's root Projects folder ID to list top-level items.
continuation  string    Pagination cursor. Omit for page 1.
limit         integer   1-100. Default 50.
item_types    string[]  Subset of ["design","folder","image","brand_template"]. Default all except brand_template.
sort_by       string    "created_ascending" | "created_descending" | "modified_ascending" |
                         "modified_descending" (default) | "title_ascending" | "title_descending"
pin_status    string    "any" (default) | "pinned"
```

Returns `{ items, continuation }` — each item has a `type` field (`folder`/`design`/`image`/`brand_template`) saying which of the four matching nested objects (`item.folder`, `item.design`, `item.image`, `item.brand_template`) is populated. Check `type` before reading the nested object.

**This is also how you find asset IDs** — there is no list/search-assets endpoint in Canva's API. List a folder with `item_types: ["image"]`, then call `get_asset` on the IDs you get back.

## Comments — two-step lookup

A design's comments are threads, and each thread can have replies:

1. `get_comment_thread(design_id, thread_id)` — the thread itself. Two shapes: a `comment` thread has `content`/`mentions`/`assignee`/`resolver`; a `suggestion` thread has `suggested_edits`/`status` instead. Check `thread_type.type` to know which shape you got.
2. `list_comment_replies(design_id, thread_id)` — replies to that thread, paginated the same way as the list tools above.

You need a `thread_id` to call either — there's no "list all comment threads on a design" tool. If the user gives you a Canva comment link or you already have a thread ID from elsewhere, use it directly.

## Pagination

Every `list_*` tool returns `{ items, continuation }` (never page numbers or an `after`/`offset` cursor at the top level — `get_design_pages` is the one exception, using `offset`/`limit` instead since it's paging fixed design pages, not a search result). Omit `continuation` for the first page; pass a prior response's `continuation` value to get the next page. An absent/empty `continuation` means there are no more results.
