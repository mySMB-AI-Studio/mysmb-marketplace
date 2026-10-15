# Trello

Connect Trello to MyHub via the myHub-hosted Trello MCP gateway. OAuth flow — click Connect and sign in to your Trello account.

Covers boards, lists, cards, and members, plus a cross-board "my cards" view.

## Authentication

Click **Connect** in the MyHub workspace and sign in with your Trello account. Access tokens are managed and refreshed automatically. Trello's OAuth flow uses PKCE; no client secret or manual token copying is ever required on your end.

## Configuration

This plugin uses OAuth. No environment variables or manual credentials are required.

| Variable | Description |
|---|---|
| _(none)_ | OAuth tokens are managed automatically by MyHub after you click Connect. |

## Tools & resources

- `get_current_user` — authenticated member profile (id, username, fullName, avatar)
- `list_organizations` — Workspaces the authenticated user belongs to
- `list_boards` — boards visible to the authenticated user
- `get_board` — single board detail (param: `board_id`)
- `list_board_members` — members of a board (param: `board_id`)
- `list_lists` — lists (columns) on a board (param: `board_id`)
- `list_my_cards` — cards the authenticated user is a member of, across every board, enriched with board name
- `list_cards` — cards on a board or list (param: `board_id` OR `list_id`)
- `get_card` — single card detail (param: `card_id`)
- `create_card` — create a new card (params: `list_id`, `name`, optional `desc`, `due`, `id_members`)
- `update_card` — update an existing card (param: `card_id` plus fields to change, including moving it via `list_id`)
- `add_comment` — add a comment to a card (params: `card_id`, `text`)

## Widgets

- **My Cards** (`trello-my-cards`) — cards assigned to you across every board, in Upcoming / Overdue / Completed tabs
- **Overdue Cards** (`trello-overdue-cards`) — cards assigned to you that are past their due date, with summary stats
- **Boards** (`trello-boards`) — your open Trello boards

## See also

- [Trello REST API reference](https://developer.atlassian.com/cloud/trello/guides/rest-api/api-introduction/)
- [Trello OAuth 2.0 (confidential client) guide](https://developer.atlassian.com/cloud/trello/guides/rest-api/oauth-2-confidential-client-usage/)
