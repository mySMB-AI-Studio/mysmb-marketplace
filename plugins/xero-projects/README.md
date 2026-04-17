# Xero Projects

Access Xero Projects via the myHub-hosted OAuth MCP gateway. Manage projects, tasks, time entries, and project users. Browser OAuth flow — no env vars, no keys, just click Connect.

## Configuration

No environment variables required. On first use, the browser redirects to `identity.xero.com` — sign in, pick a Xero org, and MyHub remembers the selection for the rest of the session.

Scopes requested: `offline_access openid profile email projects`.

## Tools (11)

### Projects (5)
- `list_projects` — List projects with optional filters (state, contact, pagination)
- `get_project` — Get a single project by ID
- `create_project` — Create a new project (required: contactId, name)
- `update_project` — Update a project with a partial patch
- `patch_project_status` — Change project status (INPROGRESS / CLOSED)

### Project Users (1)
- `list_project_users` — List Xero users assignable to projects

### Tasks (3)
- `list_tasks` — List tasks under a project
- `get_task` — Get a single task
- `create_task` — Create a task (required: name, chargeType, rate)

### Time Entries (2)
- `list_time_entries` — List time entries logged against a project
- `create_time_entry` — Log a time entry (required: userId, taskId, dateUtc, duration minutes)

## See also

- [Xero Projects API docs](https://developer.xero.com/documentation/api/projects/overview)
