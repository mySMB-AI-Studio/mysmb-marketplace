# Sprout — Employee

Manage **Sprout** employee 201 records through the myHub-hosted Sprout MCP gateway.
Sprout is a Philippine HR & payroll platform; this plugin covers the **Employee
Service**.

## Tools

- **Employees** — `list_employees`, `get_employee`, `create_employee`,
  `update_employee`, `update_employee_status`
- **201-file sections** — `update_work_information`, `update_government_information`,
  `update_work_schedule`, `update_payroll_information`, `update_contact_information`,
  `update_employee_collection` (Dependents, Benefits, Assets, Visas, Trainings,
  Seminars, EducationalBackgrounds, EmploymentRecords, PerformanceManagementItems,
  Memos, PreEmploymentRequirements, Advances)
- **Sub-resources** — `get_employee_leave_types`, `get_employee_access_levels`,
  `get_employee_sync_information`, `get_employee_assigned_locations`
- **Search & validation** — `create_employee_search` + `get_employee_search`
  (two-step paged search), `prevalidate_employee`, `validate_username`
- **Lookups** — `list_employment_statuses`, `list_departments`, `list_locations`,
  `list_visa_types`, `list_countries`, `list_benefit_types`, `list_asset_categories`
- `service_health`

## Widgets

- **Sprout — Employee directory** — browse employees with name and employee number.

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
