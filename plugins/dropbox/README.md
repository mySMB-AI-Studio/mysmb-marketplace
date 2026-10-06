# Dropbox

Access [Dropbox](https://dropbox.com) files and folders — browse, search, upload, download, and organize — plus the connected user's own account profile, via the **myHub-hosted Dropbox MCP gateway** — a self-hosted connector (`myhub-mcp-servers/src/integrations/dropbox`) that talks to Dropbox's REST API on your behalf through a single mySMB-owned Dropbox OAuth app (the same shared-app model as Zoom and ApprovalMax — one app for every customer portal, not a per-tenant registration).

Browser OAuth through myHub — no API keys, no env vars. Click Connect, sign in to Dropbox, and you're done.

## Configuration

No configuration variables are required.

## Tools & resources

This connector exposes the following MCP tools, backed directly by Dropbox's REST API. (Internally, calls split across two Dropbox hosts — `api.dropboxapi.com` for metadata/RPC endpoints, `content.dropboxapi.com` for the upload/download endpoints — but that split is fully handled by the MCP server and isn't something a caller needs to think about.)

### Account

| Tool | Description |
|------|-------------|
| `get_current_account` | Profile detail for the connected Dropbox account. No arguments. |

### Files & folders

| Tool | Description |
|------|-------------|
| `list_folder` | List a folder's contents. `path` — a Dropbox path, e.g. `/Homework/math.txt`; use the **empty string `""`** (not `"/"`) to refer to the root of the user's Dropbox — this is Dropbox's own convention, not a typo. `recursive` — list the entire subtree instead of just immediate children (default false). `limit` — max entries per page (Dropbox's own cap is 2000; omit to use Dropbox's default). `cursor` — an opaque pagination token from a previous response's `cursor` field, used only when that response's `has_more` was true. **When `cursor` is provided, `path`/`recursive`/`limit` are ignored** — Dropbox's `list_folder/continue` endpoint takes only the cursor and continues the same listing from where it left off. |
| `get_metadata` | Metadata for a single file or folder by `path` (same empty-string-root convention as `list_folder`). |
| `create_folder` | Create a folder at `path`. `autorename` — if true and the folder name already exists, Dropbox automatically renames the new folder to avoid a conflict instead of failing. |
| `upload_file` | Upload a file. `path`, `content_base64` (the file's content, base64-encoded), `mode` (`add` [Dropbox's default — fails or autorenames on conflict] or `overwrite`), `autorename`, `mute` (suppress the notification Dropbox normally sends other devices/users about this change). **Small files only** — this tool sends the whole file in a single request, capped at ~6MB of raw content / 8,000,000 base64 characters. Dropbox's separate chunked `upload_session` API for larger files is not implemented by this connector. |
| `download_file` | Download a file's content by `path`. |
| `delete_item` | Delete a file or folder by `path`. |
| `move_item` | Move or rename an item. `from_path` — the current Dropbox path of the file or folder. `to_path` — the destination path (including the new name, for a rename). `autorename` — if true and a name conflict exists at `to_path`, Dropbox automatically renames instead of failing. |
| `search_files` | Search by name (and, where Dropbox's indexing supports it, file content). `query` (required, matches against file/folder names). `path` — restrict the search to a folder and its subtree; omit to search the entire Dropbox. `max_results` — Dropbox's own cap is 1000, defaults to 100. `filename_only` — if true, match only against names, skipping Dropbox's file-content indexing. |

## Capabilities this connector does NOT have

- **No chunked/large-file upload.** `upload_file` covers only small files sent as a single request (see the size ceiling above) — Dropbox's separate `upload_session` API (`start`/`append_v2`/`finish`) for multi-GB uploads is not implemented in this pass.
- **No sharing or collaboration tools.** Shared links, team folders, and sharing permissions are out of scope — this pass covers basic file/folder CRUD, search, and account info only.
- **No Dropbox Paper, Dropbox Sign, or any other Dropbox product** beyond core file storage.

## Destructive / mutating operations

Confirm before calling — these change the connected user's live Dropbox account:

- `create_folder` — creates a new folder.
- `upload_file` — can **overwrite an existing file** depending on `mode`.
- `delete_item` — **permanently deletes** a file or folder via the API. There is no undo/trash tool exposed here, even though Dropbox's own web UI has one.
- `move_item` — moves or renames a file or folder.

## Rate limits

Follow Dropbox's own published API rate limits. If a tool call returns a `429`, wait a few seconds and retry once.

## Technical notes

- Dropbox's OAuth token endpoint (`api.dropbox.com`) is a **third, distinct host** from both the authorize endpoint (`www.dropbox.com`) and the resource API hosts (`api.dropboxapi.com` / `content.dropboxapi.com`) — unusual among OAuth providers, but fully handled by the MCP server.
- Dropbox's refresh token does **not** expire and does **not** rotate on use (unlike Zoom's, which rotates on every refresh) — if this connection ever seems to silently stop working, it's not the same kind of refresh-token-expiry issue you might expect from other connectors.

## See also

- [Dropbox API documentation](https://www.dropbox.com/developers/documentation/http/documentation)
- [Dropbox OAuth guide](https://developers.dropbox.com/oauth-guide)
