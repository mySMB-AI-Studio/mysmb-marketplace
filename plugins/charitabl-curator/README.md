# Charitabl Curator

Charity curator tools for Charitabl. This plugin connects to Charitabl's curator MCP server and surfaces the charity-management side of Charitabl — the donation dashboard, donation reports, charity profile changes, and the donation widget a curator embeds elsewhere.

The server acts on your behalf using your Charitabl curator login, so it only ever sees data and performs actions your own curator account is allowed to.

## Tools & resources

> Tool list is planned — the Charitabl MCP servers are being built out. This section will be finalized once the `/mcp/curator` server ships its tool definitions.

- `get_dashboard` — view the charity's donation dashboard summary.
- `search_donations` — search and filter the charity's donation records.
- `get_charity_profile` — view the charity's current public profile.
- `submit_profile_change` — submit a change to the charity's profile.
- `get_donation_widget` — get the charity's embeddable donation widget configuration.
- `update_donation_widget` — update the charity's donation widget configuration.

## Configuration

No environment variables. This plugin uses OAuth (scope `curator`) — connecting signs you into Charitabl with your charity curator account (the email + password you use for the Charitabl curator portal). Your workspace then acts on your charity's data: donations, reports, profile, and donation widget.

**Environment URLs:** This dev-branch artifact points at `http://localhost:3003` (local Charitabl). Promotion to staging/main rewrites the `.mcp.json` URL to `https://dev.charitabl.org` / `https://www.charitabl.org` respectively.

## See also
- [Charitabl](https://www.charitabl.org)
