# Canva

Access Canva through a mySMB-owned OAuth app and a myHub-hosted MCP gateway (`/canva/mcp`) — click Connect and sign in with your Canva account. No client ID/secret to create or paste in; that step is gone.

This is a read-only build on top of Canva's Connect REST API, not a proxy to Canva's own `mcp.canva.com` remote server — that official server is generation/editing-focused (creating and editing designs) and uses a different authentication model (Client ID Metadata Documents) with a waitlist-gated redirect-URI registration. This connector covers browsing existing designs, brand templates, folders, comments, and assets instead.

## Configuration

No environment variables required. Click **Connect** and sign in to your Canva account; the workspace completes the OAuth exchange and stores your session securely.

Scopes requested during Connect:

| Scope | Grants |
|---|---|
| `design:meta:read` | List and retrieve design metadata (title, owner, thumbnail, URLs, page count) |
| `design:content:read` | Read a design's page-level content metadata |
| `brandtemplate:meta:read` | List and retrieve brand template metadata |
| `brandtemplate:content:read` | Check a brand template's autofill fields |
| `folder:read` | Read folder metadata and list folder contents |
| `comment:read` | Read comment/suggestion threads and replies on designs |
| `asset:read` | Retrieve metadata for a single asset (image/video) by ID |
| `profile:read` | Read the connected user's Canva display name |

**No write scopes are requested.** Creating, editing, uploading, or exporting anything in Canva is out of scope for this connector — see "Known limitations" below.

## Tool categories

### Designs (3)
- `list_designs` — search/list the user's designs. Returns `{ items, continuation }`.
- `get_design` — metadata for one design by ID (title, owner, thumbnail, edit/view URLs — these expire after 30 days).
- `get_design_pages` — page-level metadata (page number, design type, dimensions, thumbnail) for a multi-page design.

### Brand templates (3)
- `list_brand_templates` — search/list the user's brand templates.
- `get_brand_template` — metadata for one template by ID.
- `get_brand_template_dataset` — whether a template supports autofill, and its fillable fields (each typed image/text/chart).

### Folders (2)
- `get_folder` — metadata for one folder by ID.
- `list_folder_items` — contents of a folder: subfolders, designs, images/videos, and brand templates. Each item's `type` says which nested object (`folder`/`design`/`image`/`brand_template`) is populated.

### Comments (2)
- `get_comment_thread` — a comment or suggestion thread on a design.
- `list_comment_replies` — replies to a comment thread.

### Assets (1)
- `get_asset` — metadata for a single asset (image/video) by ID — name, tags, dimensions/duration, import status.

> **Known limitation — no list/search-assets endpoint.** Canva's Connect API only exposes assets by exact ID; there is no way to browse a user's whole asset library directly. Discover asset IDs via `list_folder_items` (item type `image`) first, then call `get_asset`.

### Profile (1)
- `get_profile` — the connected user's Canva display name.

## Destructive operations

**None.** This connector is entirely read-only — no tool creates, edits, uploads, exports, or deletes anything in Canva.

## Known limitations

- **No design generation, editing, or export tools.** Canva's own hosted `mcp.canva.com` remote server covers that surface (natural-language design generation, editing sessions, asset upload, export to PDF/PNG/etc.), but requires a different OAuth model (Client ID Metadata Documents) and a waitlist-gated redirect-URI registration — out of scope for this build. If that capability is needed later, it would be a separate connector/integration, not an extension of this one.
- **No list/search-assets endpoint** — see Assets above.
- **Pagination** is Canva's native `continuation` cursor (never page numbers) — every `list_*` tool returns `{ items, continuation }`; omit `continuation` for the first page, pass a prior response's value to get the next page.

## See also

- [Canva Connect API authentication](https://www.canva.dev/docs/connect/authentication/)
- [Canva Connect API reference](https://www.canva.dev/docs/connect/api-reference/)
- [Canva Developer Portal](https://www.canva.com/developers/)
