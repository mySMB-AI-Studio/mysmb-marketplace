# monday.com

Access monday.com via the official hosted OAuth MCP server at `https://mcp.monday.com/mcp`. Covers boards, items, groups, columns, updates, users/teams, and WorkForms across the Work Management, Dev, Sales CRM, and Service products from a single endpoint.

Browser OAuth — no API keys, no env vars. Each user authorises individually; the MCP server only sees data that user can already see in monday.com.

## Configuration

No environment variables required on the client side. On first use, the browser redirects to monday.com's OAuth flow — sign in, grant the requested scopes, and subsequent calls flow over the authorised session.

### Prerequisites

- A monday.com account on a plan that allows API access.
- Account admin must install the **monday MCP** app from the [monday marketplace](https://monday.com/marketplace) before individual users can authorise.

## Tool categories

Tools are exposed by monday's hosted MCP and are not split by product — the same endpoint serves Work Management, Dev, Sales CRM, and Service.

### Items
- `create_item`, `delete_item`, `get_board_items_by_name`, `change_item_column_values`, `move_item_to_group`, `create_update`

### Boards
- `create_board`, `get_board_schema`, `create_group`, `create_column`, `delete_column`

### Account
- `list_users_and_teams`

### WorkForms
- `create_form`, `get_form`

The exact tool list is owned by monday and may change — see [monday MCP](https://github.com/mondaycom/mcp) for the current set.

## Destructive operations

Confirm before calling — these mutate or remove account data:

- `delete_item`, `delete_column` — irreversible from the API
- `change_item_column_values`, `move_item_to_group` — overwrites existing values
- `create_board`, `create_column`, `create_group`, `create_form` — creates account-visible objects

## See also

- [Connect monday MCP with Claude](https://support.monday.com/hc/en-us/articles/28515704603666-Connect-monday-MCP-with-Claude)
- [Get started with monday MCP](https://support.monday.com/hc/en-us/articles/28588158981266-Get-started-with-monday-MCP)
- [monday Platform API (GraphQL)](https://developer.monday.com/api-reference/)
- [mondaycom/mcp on GitHub](https://github.com/mondaycom/mcp)
