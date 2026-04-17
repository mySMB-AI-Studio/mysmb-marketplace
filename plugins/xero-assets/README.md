# Xero Fixed Assets

Access Xero's Fixed Assets register via the myHub-hosted OAuth MCP gateway. List, view, and register fixed assets.

## Configuration

No environment variables required. Browser OAuth — click Connect in MyHub to sign in and pick a Xero org.

Scopes requested: `offline_access openid profile email assets`.

## Tools (5)

- `list_assets` — List fixed assets with optional filters (status Draft/Registered/Disposed, pagination, sort)
- `get_asset` — Get a single asset by ID
- `create_asset` — Register a new fixed asset (required: assetName)
- `list_asset_types` — List configured asset types (used when creating assets)
- `get_asset_settings` — Get org-wide fixed asset settings (number prefix, default accounts, etc.)

## See also

- [Xero Assets API docs](https://developer.xero.com/documentation/api/assets/overview)
