# Sprout — HR General

Read **Sprout** HR General reference data and admin configuration through the
myHub-hosted Sprout MCP gateway. Covers the **HR General Service**.

## Tools

- **Lookups** — `list_companies`, `list_departments`, `list_locations`,
  `list_clients`, `list_employee_types`, `list_asset_categories`,
  `list_benefit_types`, `list_visa_types`, `list_project_statuses`
- **Company** — `get_company_policies`
- **Access levels (roles)** — `list_access_levels`, `get_access_level`,
  `get_access_level_details`, `get_access_level_module`
- **Notifications** — `list_notifications`, `get_notification_companies`
- `service_health`

## Widgets

- **Sprout — Companies** — companies in your account and their payroll-sync status.

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
