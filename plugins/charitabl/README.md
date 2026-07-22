# Charitabl

Discover Australian charities and donate through Charitabl's public directory. This plugin connects to Charitabl's public MCP server — no sign-in required — and surfaces the charity-discovery side of Charitabl: searchable listings, featured causes, and donation links.

Anyone can use this plugin. It never sees personal donor or curator data; it only reads what Charitabl already shows to anonymous visitors.

## Tools & resources

> Tool list is planned — the Charitabl MCP servers are being built out. This section will be finalized once the `/mcp/public` server ships its tool definitions.

- `search_charities` — search visible charities by name, category, or location.
- `get_charity` — view a single charity's public profile.
- `featured_charities` — browse Charitabl's currently featured causes.
- `list_charity_categories` — list the charity categories available for filtering.
- `get_donate_link` — get the donation link for a specific charity.

## Configuration

No environment variables. This plugin talks to Charitabl's public MCP server, which requires no authentication (`authType: none`) — Charitabl's charity directory and donation links are available to everyone.

**Environment URLs:** This dev-branch artifact points at `http://localhost:3003` (local Charitabl). Promotion to staging/main rewrites the `.mcp.json` URL to `https://dev.charitabl.org` / `https://www.charitabl.org` respectively.

## See also
- [Charitabl](https://www.charitabl.org)
