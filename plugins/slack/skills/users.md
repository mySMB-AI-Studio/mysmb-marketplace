---
name: slack-users
description: Look up Slack user profiles and list channel members via the Slack MCP server. Use when the user wants to find a colleague's contact details, role, timezone, or status, or wants to see who is in a channel.
---

# Slack — users

Use the `slack` MCP server for all user lookup operations.

## Finding a user

Call `search_users` with a name, email address, or partial username. Returns a list of matching users with their display name, real name, and user ID.

Always search first to resolve a human-readable name to a user ID before calling `get_user_profile`. Never guess user IDs.

## Fetching a user profile

Call `get_user_profile` with the user's ID (obtained via `search_users`). Present the full profile in a readable format:

- **Display name:** @handle
- **Real name:** Full Name
- **Title:** Job Title
- **Email:** email@company.com (if available — requires `users:read.email` scope)
- **Timezone:** City/Region (UTC±N)
- **Status:** [emoji] Status message (if set)

If the user's email is not returned, it means the workspace admin has restricted email visibility; note this rather than leaving the field blank.

## Listing channel members

Call `list_channel_members` with the channel ID (resolve via `search_channels` first). Returns a list of user IDs. For small channels (≤20 members), automatically call `get_user_profile` for each and present a formatted member list. For larger channels, present the count and offer to fetch profiles on demand.

## Common use cases

**"Who is on the #sales channel?"**
1. Call `search_channels` with "sales" to resolve the channel ID.
2. Call `list_channel_members` with the ID.
3. For each member ID, call `get_user_profile` (batch for channels ≤20 members).
4. Present the member list with name, title, and email.

**"Find Alice's email address"**
1. Call `search_users` with "Alice".
2. If multiple results, show the list and ask the user to confirm which Alice.
3. Call `get_user_profile` with the confirmed user ID.
4. Present the email address.

**"What timezone is Bob in?"**
1. Call `search_users` with "Bob".
2. Call `get_user_profile` with his ID.
3. Return: "Bob is in [timezone] — currently [local time]."

## Error handling

- `401 Unauthorized` — OAuth token expired. Ask the user to reconnect.
- `403 Forbidden` — missing `users:read` scope (or `users:read.email` for email). Check README.
- `404 Not Found` — user ID does not exist or the user has been deactivated.
- `429 Too Many Requests` — rate limit; wait ~10 seconds and retry. For bulk profile fetches, add a small delay between calls.
