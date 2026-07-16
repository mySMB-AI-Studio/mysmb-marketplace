# Xero Practice Manager

Xero Practice Manager (XPM) via the myHub-hosted OAuth MCP gateway. Manage clients, jobs, tasks, time entries, staff, and invoices for your accounting practice. Browser OAuth flow — no env vars, no keys, just click Connect.

## Configuration

No environment variables required. On first use, the browser redirects to `login.xero.com/identity` — sign in, pick your Xero practice organisation, and MyHub remembers the selection for the rest of the session. Reconnect to switch organisations.

Scopes requested:

```
offline_access openid profile email practicemanager
```

## Tools (17)

### Clients (4)
- `list_xpm_clients` — List clients with optional search/filter
- `get_xpm_client` — Get a single client by ID
- `create_xpm_client` — Create a new client
- `update_xpm_client` — Update an existing client

### Jobs (4)
- `list_xpm_jobs` — List jobs with optional filters (status, client, date range)
- `get_xpm_job` — Get a single job by ID
- `create_xpm_job` — Create a new job
- `update_xpm_job` — Update an existing job

### Tasks (2)
- `list_xpm_tasks` — List tasks on a job
- `create_xpm_task` — Create a task on a job

### Time (2)
- `list_xpm_time` — List time entries with optional filters
- `create_xpm_time` — Log a time entry

### Staff (2)
- `list_xpm_staff` — List all staff members
- `get_xpm_staff` — Get a single staff member by ID

### Invoices (2)
- `list_xpm_invoices` — List invoices with optional filters
- `get_xpm_invoice` — Get a single invoice by ID

### Templates (1)
- `list_xpm_job_templates` — List available job templates

## See also

- [Xero Practice Manager API docs](https://developer.xero.com/documentation/xero-app-store/app-partner-guides/xero-practice-manager-api/)
