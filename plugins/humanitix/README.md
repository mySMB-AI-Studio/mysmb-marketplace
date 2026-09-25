# Humanitix

Event ticketing via [Humanitix](https://humanitix.com) — events, orders, tickets, and tags, through the myHub-hosted `humanitix` MCP gateway (`myhub-mcp-servers`). All operations are read-only.

## Configuration

No configuration variables are required.

## Tools

| Tool | Description |
|---|---|
| `list_events` | Events owned by or shared with the account. Paginated (`page`, `pageSize`, max 100). |
| `get_event` | Full details for one event. |
| `get_event_check_in_count` | Checked-in vs. total attendees for one event. |
| `list_orders` | Orders for one event. Paginated. |
| `get_order` | Full details for one order. |
| `list_tickets` | Tickets for one event. Paginated. |
| `get_ticket` | Full details for one ticket. |
| `list_tags` | Tags used to organise/filter events. Paginated. |
| `get_tag` | Full details for one tag. |

## Widgets

| Widget | Description |
|---|---|
| `humanitix-upcoming-events` | Table of events that haven't ended yet, soonest first — start date, location, capacity, publish status. |
| `humanitix-event-tickets` | Auto-selects the soonest upcoming event and shows its ticket sales — attendee, ticket type, amount, status, check-in. |

Each ships a `-demo` companion with static sample data for marketplace browsing before install.
