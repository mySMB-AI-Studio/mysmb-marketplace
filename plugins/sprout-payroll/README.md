# Sprout — Payroll

Work with **Sprout** payroll through the myHub-hosted Sprout MCP gateway. Covers
the **Payroll Service**.

## Tools

- **External (one-time) adjustments** — `list_adjustment_types`,
  `list_external_adjustments`, `get_external_adjustment`,
  `create_external_adjustment`, `update_external_adjustment`,
  `cancel_external_adjustment`
- **Reference data** — `list_cost_centers`, `list_departments`, `list_employees`,
  `get_employee_payrolls`
- **Overtime rates** — `list_ot_rates`, `get_ot_rate`, `create_ot_rate`,
  `update_ot_rate`, `delete_ot_rate`
- **Payroll runs & reports** — `list_payrolls`, `get_payroll_summary`,
  `get_2316_data`, `download_payslip` (PDF), `download_2316` (PDF)

Adjustment amounts are positive for earnings, negative for deductions.
`download_payslip` and `download_2316` return base64-encoded PDF content.

## Widgets

- **Sprout — Payroll adjustments** — one-time external adjustments (earnings/deductions).

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
