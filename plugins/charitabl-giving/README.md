# Charitabl Giving

Your personal giving on Charitabl. This plugin connects to Charitabl's donor MCP server and surfaces your own giving history — donation records, tax-deductible totals, and recurring gifts.

The server acts on your behalf using your Charitabl donor login, so it only ever sees your own giving data.

## Tools & resources

> Tool list is planned — the Charitabl MCP servers are being built out. This section will be finalized once the `/mcp/giving` server ships its tool definitions.

- `my_donations` — list your donation history.
- `giving_summary` — get totals and tax-deductible amounts across your giving.
- `recurring_gifts` — view and manage your recurring donations.

## Configuration

No environment variables. This plugin uses OAuth (scope `giving`) — connecting signs you into Charitabl with your personal donor account (the login you use in the Charitabl app). Your workspace can then show your own giving history, totals, and recurring gifts.

**Environment URLs:** This dev-branch artifact points at `http://localhost:3003` (local Charitabl). Promotion to staging/main rewrites the `.mcp.json` URL to `https://dev.charitabl.org` / `https://www.charitabl.org` respectively.

## See also
- [Charitabl](https://www.charitabl.org)
