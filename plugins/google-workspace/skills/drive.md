---
name: google-workspace-drive
description: List, search, and read files in Google Drive via the Google Workspace MCP server. Use when the user asks to find a file, read a document, or browse Drive folders. Upload, edit, share, and folder creation are not available (read-only scope).
---

# Google Drive — browsing, searching, and reading files

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

## What is not available

Drive is connected with `drive.readonly` scope. The following operations are not available:

- Uploading or updating files
- Creating folders
- Sharing files or changing permissions
- Moving or deleting files

If the user asks to upload or edit a file, explain that the Drive connection is read-only and they would need to reconnect with a broader scope.

## Error handling

- `401` — token expired or missing Drive scope; ask the user to re-paste a fresh token.
- `403 insufficientPermissions` — the token lacks `https://www.googleapis.com/auth/drive.readonly`.
- `404` — file not found or the user does not have access; confirm the file ID.
- `403 rateLimitExceeded` — back off and retry once.
