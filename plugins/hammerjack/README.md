# Hammerjack

Client staff operations with Sprout: portal attendance and leave projections, monthly performance reviews, employee scorecards, and branded client reports. Includes portable custom tables and guided connector setup.

Packaged from a MyHub workspace via the /developer Plugins page.

## What's in the box

- **Automations:** Monthly Client Report PDF Generator, Monthly Performance Reviews, Hammerjack Nightly Employee Scorecards, Hammerjack - Sprout HR records and portal projection, Generate Mock Portal Snapshot Data — Synthetic Only (installed as Draft — publish in the installing workspace)
- **Activity templates:** Monthly Client Performance Review
- **Form templates:** Monthly Performance Review
- **Custom tables:** Staff attendance history, Staff attendance summaries, Sprout employee mappings, Staff PTO balances, Staff leave requests, Staff monthly scorecards, Hammerjack operations (review and publish during extension setup)
- **Setup:** Hammerjack configuration (each person reviews their configuration and account bindings)
- **Widgets:** hammerjack-attendance-today, hammerjack-pto, hammerjack-scorecard
- **MCP servers:** sprout-employee, sprout-time-attendance, sprout-hr-general
- **Skills:** 1

## Configuration

| Variable | Used by |
|---|---|
| `SPROUT_CLIENT_ID` | `sprout-employee` MCP server, `sprout-time-attendance` MCP server, `sprout-hr-general` MCP server |
| `SPROUT_CLIENT_SECRET` | `sprout-employee` MCP server, `sprout-time-attendance` MCP server, `sprout-hr-general` MCP server |
| `SPROUT_ENVIRONMENT` | `sprout-employee` MCP server, `sprout-time-attendance` MCP server, `sprout-hr-general` MCP server |
| `SPROUT_SUBSCRIPTION_KEY` | `sprout-employee` MCP server, `sprout-time-attendance` MCP server, `sprout-hr-general` MCP server |
| `SPROUT_TENANT_CODE` | `sprout-employee` MCP server, `sprout-time-attendance` MCP server, `sprout-hr-general` MCP server |

## Installation and operation

All five automations install as Draft. Setup flags default to false; completing setup never publishes flows, grants access, or calls Sprout. The automation owner must review the selected accounts, explicit employee mappings, company calendar, leave status/PTO banks and grants before enabling a reviewed operation. Client-management Records pages show all staff assigned to that portal; raw mappings and run details remain organisation-only. Dashboard tiles consume the Records-to-snapshot projection. Portal pages and the Monthly Report stay native Workspace features.

Monthly reviews use a shared form with exact tracked WorkQ item IDs. Performance feedback is collected through those generated monthly WorkQ review requests; the attendance tile has no dangling popup-form dependency. Scorecards require submitted same-portal responses to that item and verified attendance through yesterday, synchronized within the previous 24 hours; weighting is 10% attendance and 90% review average, with no score before feedback. The safe manual demo requires an explicitly selected dedicated Synthetic Hammerjack portal, uses only the hammerjack_demo source and never replaces Sprout snapshots.

Sprout Employee and Time & Attendance are required setup slots. HR General is an optional company-lookup connector. Payroll is outside these use cases. Credentials stay in encrypted Connections, never in setup answers or Records.

Sprout source documentation: [Developer portal](https://developers.sprout.ph/developers/time-and-attendance), [published API reference](https://api-docs.sprout.ph/). Available versus current credit is not used as leave consumption. PTO usage comes from approved paid request detail dates. Monthly attendance needs an explicitly reviewed uniform calendar, holidays, staff start dates, and complete source coverage; unknown/unsupported sources remain partial.
