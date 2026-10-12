---
name: google-workspace-drive
description: Find files in Google Drive via the Google Workspace MCP server — recently opened files, folder listings, and full-text search. Use when the user asks to find a file or see what they worked on recently. Upload, edit, share, and downloading file contents are not available.
---

# Google Drive — finding files

Use the `google-workspace-drive` MCP server for all Drive operations. It is connected with the `drive.readonly` scope. Every tool returns file metadata — name, type, modified time and a link to open the file in Google Drive. No tool downloads or exports file contents.

## Recently opened files

Call `list_recent_files` (`pageSize` up to 50) for files the user viewed most recently. `get_recent_files_dashboard` returns the same with folders excluded, each file's folder name resolved, and why it is recent ("Shared by X", "Edited by X").

## Listing files

Call `list_files` with:

- `folderId` — list one folder (omit for all files)
- `q` — a Drive query filter, e.g. `mimeType = 'application/pdf'` or `name contains 'budget'`
- `pageSize` — up to 50

Useful `q` terms: `mimeType = 'application/vnd.google-apps.spreadsheet'` (Sheets), `mimeType = 'application/vnd.google-apps.document'` (Docs), `'me' in owners`, `modifiedTime > '2026-01-01T00:00:00'`. Combine with `and` / `or`.

## Full-text search

Call `search_files` with `query`. It matches words inside documents as well as file names, and excludes trashed files.

Present results as: file name, type, last modified date, and the link. To read a file, the user opens the link in Google Drive.

## What is not available

- Reading or downloading file contents
- Uploading or updating files, creating folders
- Sharing files or changing permissions
- Moving or deleting files

## Error handling

- `401` — the connection needs re-authorising; ask the user to reconnect Drive in Settings → Extensions → Connections.
- `403 insufficientPermissions` — the connection lacks `https://www.googleapis.com/auth/drive.readonly`; reconnect.
- `403 rateLimitExceeded` — back off and retry once.
