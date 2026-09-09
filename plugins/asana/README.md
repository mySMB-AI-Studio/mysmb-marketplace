# Asana

Connect Asana to MyHub via the myHub-hosted Asana MCP gateway. OAuth flow — click Connect and sign in to your Asana account.

Covers task management, project listings, workspace access, and user profile data.

## Authentication

Click **Connect** in the MyHub workspace and sign in with your Asana account. Access tokens are managed and refreshed automatically.

## Configuration

This plugin uses OAuth. No environment variables or manual credentials are required.

| Variable | Description |
|---|---|
| _(none)_ | OAuth tokens are managed automatically by MyHub after you click Connect. |

## Tools & resources

- `list_workspaces` — list all workspaces the authenticated user has access to
- `get_current_user` — authenticated user profile (gid, name, email, workspaces)
- `list_users` — users in a workspace (param: `workspace_gid`)
- `list_projects` — projects in a workspace (param: `workspace_gid`)
- `get_project` — single project detail (param: `project_gid`)
- `list_sections` — sections in a project (param: `project_gid`)
- `list_tasks` — tasks in a project or assigned to a user (params: `project_gid` OR `assignee` + `workspace_gid`, optional `limit`, `completed`)
- `get_task` — single task detail (param: `task_gid`)
- `create_task` — create a new task (params: `workspace_gid`, `name`, optional `notes`, `due_on`, `assignee`, `projects`)
- `update_task` — update an existing task (param: `task_gid` plus fields to change)
- `complete_task` — mark a task as complete (param: `task_gid`)

## Widgets

- **My Tasks** (`asana-my-tasks`) — tasks assigned to the current user with due dates, project labels, and overdue indicators
- **Projects** (`asana-projects`) — active Asana projects in your workspace

## See also

- [Asana REST API reference](https://developers.asana.com/reference/rest-api-reference)
- [Asana OAuth guide](https://developers.asana.com/docs/oauth)
