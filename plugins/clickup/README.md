# ClickUp

Connect ClickUp to MyHub via the myHub-hosted ClickUp MCP gateway. OAuth flow — click Connect and sign in to your ClickUp account.

Covers Workspaces (called "Teams" in ClickUp's API v2), Spaces, Folders, Lists, Tasks and Comments — browsing, filtering, and creating/updating tasks and comments.

## Authentication

Click **Connect** in the MyHub workspace and sign in with your ClickUp account, then pick the Workspace(s) to authorize. ClickUp's authorization-code grant returns an access token with **no refresh token and no timed expiry** — ClickUp's own docs state the access token "currently does not expire." It stays valid until you disconnect the app in ClickUp; MyHub surfaces a re-connect prompt if it's ever revoked.

ClickUp has no granular OAuth scope system for standard (non-marketplace) apps: connecting grants whatever access you have on the Workspace(s) you pick during consent.

## Configuration

No configuration variables are required — this plugin uses a single mySMB-owned ClickUp OAuth app shared across every customer portal. No bring-your-own client ID.

## Tools

Start with `list_workspaces` to find a `team_id`, then drill down through `list_spaces` → `list_folders` → `list_lists` (or `list_folderless_lists` for Lists that live directly in a Space) to find a `list_id` before working with tasks.

- `list_workspaces` — every Workspace ("Team") the authenticated user belongs to (id, name, color, avatar)
- `list_spaces` — Spaces in a Workspace (param: `team_id`, optional `archived`)
- `list_folders` — Folders in a Space, including nested Lists and `task_count` (param: `space_id`, optional `archived`)
- `list_lists` — Lists inside a Folder (param: `folder_id`, optional `archived`)
- `list_folderless_lists` — Lists that live directly in a Space, outside any Folder (param: `space_id`, optional `archived`)
- `list_tasks` — tasks in a List, paginated (param: `list_id`; optional `page`, `order_by`, `reverse`, `subtasks`, `include_closed`, `archived`, `statuses[]`, `assignees[]`, and `due_date`/`date_created`/`date_updated` `_gt`/`_lt` Unix-ms filters). Check the response's `last_page` flag and increment `page` rather than assuming one page is everything.
- `get_task` — full detail for a single task (param: `task_id`)
- `create_task` — create a task in a List (param: `list_id`, `name`; optional `description`, `assignees[]`, `tags[]`, `status`, `priority` 1–4, `due_date`, `due_date_time`)
- `update_task` — update one or more fields on an existing task (param: `task_id`; optional `name`, `description`, `status`, `priority`, `due_date`, `due_date_time`, `assignees_add[]`/`assignees_rem[]` to add/remove without replacing the whole list, `archived`)
- `list_comments` — comments on a task, newest first (param: `task_id`; optional `start`/`start_id` pagination from the previous response's last comment)
- `create_comment` — post a comment on a task (param: `task_id`, `comment_text`; optional `notify_all`, `assignee`)

Priority is always 1 = Urgent, 2 = High, 3 = Normal, 4 = Low.

## See also

- [ClickUp API v2 reference](https://developer.clickup.com/reference)
- [ClickUp OAuth / Get Access Token](https://developer.clickup.com/reference/getaccesstoken)
