# Sprout — Time and Attendance

Manage **Sprout** time & attendance through the myHub-hosted Sprout MCP gateway.
Covers the **Time and Attendance Service**.

## Tools

- **Attendance logs (DTR)** — `list_attendance_logs`, `get_attendance_log`,
  `create_attendance_log`, `create_attendance_logs_batch`, `edit_attendance_log`,
  `delete_attendance_logs`, `create_attendance_search` + `get_attendance_search`,
  `create_archived_attendance_search` + `get_archived_attendance_search`
- **Requests (read)** — overtime / undertime / official-business /
  certificate-of-attendance / schedule-adjustment list + get, and `get_leave_request`
- **Requests (create)** — `create_requests` (batch; choose leave / overtime /
  undertime / official business via `requestTypeId`)
- **Approvals** — `list_pending_approvals`, `create_approval`, `list_approvers`
- **Leaves** — `get_leave_credits`, `get_leave_breakdown`,
  `calculate_leave_breakdown`, `get_leave_policies`, `create_leave_search` +
  `get_leave_search`
- **Schedules & misc** — `list_schedules`, `list_coa_types`, `get_coa_type`,
  `get_lock_information`, `get_break_report`

## Widgets

- **Sprout — Recent attendance** — latest clock-in / clock-out (DTR) logs.

## Authentication

Sprout uses machine-to-machine OAuth2: your **Client ID** + **Client Secret** are
exchanged for a short-lived Bearer token by the gateway (you never paste a token).
Production calls also carry an Azure APIM **Subscription Key** and a **Tenant Code**.
See the [Sprout Authorization docs](https://developers.sprout.ph/developers/authorization).

## Configuration

Set these when connecting the plugin in myHub (Settings → Plugins → Connections):

| Variable | Required | Description |
|---|---|---|
| `SPROUT_CLIENT_ID` | ✅ | Sprout API client id, issued when your API access is approved. |
| `SPROUT_CLIENT_SECRET` | ✅ | Sprout API client secret. Exchanged server-side for a Bearer token. |
| `SPROUT_SUBSCRIPTION_KEY` | — | Azure APIM subscription key (`Ocp-Apim-Subscription-Key`). Required in production, blank for sandbox. |
| `SPROUT_TENANT_CODE` | — | Company/tenant code identifying which company the calls target. |
