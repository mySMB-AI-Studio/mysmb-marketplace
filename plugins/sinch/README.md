# Sinch Engage

Connect Sinch Engage to myHub via the `@sinch-engage/mcp-server` stdio MCP server. Enables sending SMS messages, generating detailed and summary message reports, and managing contacts and contact groups — all from the myHub workspace.

## What it does

### Messaging

| Tool | Description |
|------|-------------|
| `sendMessage` | Send an SMS to one or more recipients. Phone numbers must be in E.164 format (e.g. `+61400000000`). |

### Reporting

| Tool | Description |
|------|-------------|
| `getDetailedMessageReport` | Retrieve a detailed per-message delivery report for a date range. |
| `getSummaryMessageReport` | Retrieve a summary report aggregated by delivery status for a date range. |
| `getSummaryInsightMessageReport` | Retrieve a summary insight report with enriched delivery analytics. |
| `getAsyncReportStatus` | Check the status of a previously requested asynchronous report by report ID. |
| `getAsyncReportFields` | List the available fields that can be included in an async report. |
| `requestAsyncDetailedMessageReport` | Submit a request for a large async detailed message report. |

### Contacts

| Tool | Description |
|------|-------------|
| `getContactGroups` | List all contact groups in the account. |
| `getContactGroupDetails` | Retrieve details of a specific contact group by ID. |
| `getContactWithSearch` | Search for contacts by name, phone number, or other criteria. |
| `createContactGroup` | Create a new contact group. |
| `createContact` | Add a new contact to the account. |
| `updateContact` | Update an existing contact's details. |
| `deleteContactGroup` | Delete a contact group by ID. |

## Configuration

The first two variables are required and entered via the myHub Connect modal. All others are optional — the server provides defaults, but they can be overridden in `.mcp.json` if needed.

| Variable | Required | Default | Description |
|---|---|---|---|
| `SINCH_ENGAGE_API_KEY` | Yes | — | Your Sinch Engage API key. Found under **Settings → API Settings** at [hub.messagemedia.com/api-settings](https://hub.messagemedia.com/api-settings). |
| `SINCH_ENGAGE_API_SECRET` | Yes | — | Your Sinch Engage API secret, paired with the API key above. Found on the same **Settings → API Settings** page. Keep this value confidential. |
| `SINCH_ENGAGE_REGION` | No | `AU` | Data region for your account. Use `AU` for Australia/Asia-Pacific or `EU` for Europe. Omit to default to `AU`. |
| `MCP_TOOL_CATEGORIES` | No | all | Comma-separated list of tool categories to expose. Pre-set to `reporting, contacts, messaging`. Override in `.mcp.json` to restrict which categories are available. |
| `MCP_TOOL_MODES` | No | all | Comma-separated list of operation modes to allow. Pre-set to `read, write, delete`. Override in `.mcp.json` to restrict to read-only or write-only. |
| `MCP_TOOL_EXCLUDE_MODES` | No | none | Comma-separated list of modes to exclude. For example, set to `delete` to prevent any destructive contact operations. Takes precedence over `MCP_TOOL_MODES`. |
| `MCP_MAX_RETRIES` | No | `3` | Maximum number of retry attempts for failed API calls. Increase for flaky network conditions. |
| `MCP_RETRY_DELAY_MS` | No | `3000` | Delay in milliseconds between retry attempts. Applies to all retried API calls. |

## Authentication

Sinch Engage uses API key + API secret authentication. These credentials are passed as environment variables directly to the MCP server process — they are never transmitted to any myHub-hosted endpoint. All credentials are stored in the myHub vault and injected at session start.

## Install (Claude Code)

```
/plugin marketplace add mySMB-AI-Studio/mysmb-marketplace
/plugin install sinch@mysmb-marketplace
```

After installing, open the Connect modal and enter your `SINCH_ENGAGE_API_KEY`, `SINCH_ENGAGE_API_SECRET`, and `SINCH_ENGAGE_REGION`.

## Usage examples

**Send an SMS**

> "Send a message to +61400000000 saying 'Your appointment is confirmed for tomorrow at 10am.'"

**Generate a delivery report**

> "Show me the SMS delivery summary report for last week."

**Manage contacts**

> "List all my contact groups."
> "Create a new contact group called 'VIP Customers'."
> "Search for contacts with the phone number +61400000000."

## Notes

- All phone numbers must be in E.164 format (e.g. `+61400000000`).
- Async report tools (`requestAsyncDetailedMessageReport`, `getAsyncReportStatus`) are designed for large date ranges that exceed synchronous report limits.

## Links

- [Sinch Engage API settings](https://hub.messagemedia.com/api-settings)
- [Sinch Engage documentation](https://developers.messagemedia.com/)
- [MCP server source](https://github.com/messagemedia/sinch-engage-mcp-server)
