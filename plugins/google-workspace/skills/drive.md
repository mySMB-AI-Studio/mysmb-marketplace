---
name: google-workspace-drive
description: List, search, read, and upload files in Google Drive via the Google Workspace MCP server. Use when the user asks to find a file, read a document, upload content, or browse Drive folders.
---

# Google Drive — browsing, searching, and managing files

Use the `google-workspace-drive` MCP server for all Drive operations.

## Listing files

Call `list_files` to browse Drive. Key parameters:

- `q` — Drive query string (see Searching below)
- `pageSize` — number of results (default 10, max 100)
- `orderBy` — e.g. `modifiedTime desc`, `name`
- `driveId` / `includeItemsFromAllDrives` — for Shared Drives

Present results as a list: file name, type, owner, last modified date.

## Listing recently accessed files

Call `list_recent_files` for files the user has opened recently. Useful as a quick starting point without a search.

## Searching

Use the `q` parameter with Drive's query syntax:

- `name contains 'budget'` — name contains keyword
- `mimeType = 'application/vnd.google-apps.spreadsheet'` — only Sheets
- `mimeType = 'application/vnd.google-apps.document'` — only Docs
- `'me' in owners` — owned by the current user
- `modifiedTime > '2025-01-01T00:00:00'` — modified after date
- `trashed = false` — exclude trash (include this by default)
- `parents in '<folderId>'` — files in a specific folder

Combine with `and` / `or`. Always add `trashed = false` unless the user explicitly wants trash.

## Reading file content

Call `get_file_content` with the file `id`. The server exports Google Workspace formats to plain text:

- Google Docs → `text/plain`
- Google Sheets → CSV
- Google Slides → plain text outline

Binary files (PDFs, images, Office files) are returned as base64. Surface the content inline for text; for binary files, describe the file type and size instead of dumping base64.

## Uploading files

Use `upload_file` with:

- `name` — desired file name
- `content` — file content (text string or base64 for binary)
- `mimeType` — MIME type of the content
- `parents` — array of folder IDs (optional; omit to place in My Drive root)

Confirm the destination with the user before uploading. After success, surface the new file's `id` and web link.

## Creating folders

Call `create_folder` with a `name` and optional `parents` array. Returns the new folder `id`.

## Sharing files

Call `share_file` with the file `id`, the role (`reader`, `commenter`, `writer`), and the type (`user`, `group`, `domain`, `anyone`). For a public link, use `type: "anyone"` and `role: "reader"`.

**Sharing changes permissions for all affected users** — confirm before calling.

## Updating existing files

When calling `upload_file` with an existing file `id`, the operation **overwrites** the file's current content. Before calling:

1. Confirm with the user: "This will replace the content of [file name]. Proceed?"
2. Only call `upload_file` after explicit approval.

## Error handling

- `401` — token expired or missing Drive scope; ask the user to re-paste a fresh token.
- `403 insufficientPermissions` — the token lacks `https://www.googleapis.com/auth/drive.readonly` (for reads) or `https://www.googleapis.com/auth/drive.file` (for writes).
- `404` — file not found or the user does not have access; confirm the file ID.
- `403 rateLimitExceeded` — back off and retry once.
