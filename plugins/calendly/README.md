# Calendly

Connect Calendly to myHub via the official Calendly-hosted MCP server at `https://mcp.calendly.com`. Covers scheduling (event types, meetings, availability, invitees, scheduling links), routing forms, and user/organisation management from a single endpoint.

Browser OAuth 2.1 + PKCE — no API keys, no env vars. Each user authorises individually; the MCP server only sees data that user can already see in Calendly.

## Configuration

No environment variables are required. The Calendly MCP server implements OAuth 2.1 Authorization Code + PKCE with Dynamic Client Registration (DCR, RFC 7591):

- Clients self-register at `https://calendly.com/oauth/register` to obtain a `client_id` at runtime — no pre-registered credentials are needed.
- The public-client model is used (`token_endpoint_auth_method: "none"`); no `client_secret` is ever issued or stored.
- Required scopes: `mcp:scheduling:read`, `mcp:scheduling:write`.

On first use, the browser redirects to `https://calendly.com/oauth/authorize` — sign in, grant the requested scopes, and subsequent calls flow over the authorised session with automatic token refresh.

### Prerequisites

- A Calendly account (Free, Standard, Teams, or Enterprise).
- Some tools (e.g. `meetings-create_invitee`) require a paid Calendly plan.
- Routing form tools (`routing_forms-*`) require a Teams plan or higher.

## Tool categories

### Scheduling — Event Types
- `event_types-list_event_types` — list event types for a user or organisation
- `event_types-get_event_type` — retrieve a specific event type by URI
- `event_types-create_event_type` — create a new event type
- `event_types-update_event_type` — update event type details
- `event_types-list_event_type_available_times` — list open time slots for an event type
- `event_types-list_event_type_availability_schedule` — list availability schedules for an event type
- `event_types-update_event_type_availability_schedule` — update an event type's availability schedule

### Scheduling — Meetings
- `meetings-list_events` — list scheduled events (upcoming or past) for a user or org
- `meetings-get_event` — retrieve a single event's details
- `meetings-cancel_event` — cancel a scheduled event
- `meetings-create_invitee` — book a new meeting on behalf of an invitee (paid plan required)
- `meetings-list_event_invitees` — list all invitees for a given event
- `meetings-get_event_invitee` — get details for a specific invitee
- `meetings-create_invitee_no_show` — mark an invitee as a no-show
- `meetings-get_invitee_no_show` — retrieve no-show status for an invitee
- `meetings-delete_invitee_no_show` — remove a no-show mark from an invitee

### Scheduling — Availability
- `availability-list_user_availability_schedules` — list a user's availability schedules
- `availability-get_user_availability_schedule` — retrieve a specific availability schedule
- `availability-list_user_busy_times` — list busy times within a date range

### Scheduling — Links & Shares
- `scheduling_links-create_single_use_scheduling_link` — create a single-use scheduling link (no customisation)
- `shares-create_share` — create a customised single-use scheduling link

### Locations
- `locations-list_user_meeting_locations` — list a user's configured meeting locations

### Routing Forms (Teams plan+)
- `routing_forms-list_routing_forms` — list routing forms for an organisation
- `routing_forms-get_routing_form` — retrieve a routing form by URI
- `routing_forms-list_routing_form_submissions` — list submissions for a routing form
- `routing_forms-get_routing_form_submission` — retrieve a single routing form submission

### Users
- `users-get_current_user` — get the authenticated user's profile and organisation URI
- `users-get_user` — get a specific user's profile by UUID

### Organisation Management
- `organizations-get_organization` — retrieve organisation details
- `organizations-list_organization_memberships` — list all members in the organisation
- `organizations-get_organization_membership` — get a specific membership record
- `organizations-list_organization_invitations` — list pending invitations
- `organizations-create_organization_invitation` — invite a new user to the organisation
- `organizations-revoke_organization_invitation` — revoke a pending invitation

## Widgets

- **Upcoming Meetings** — feed of scheduled events for the current user, ordered by start time
- **Event Types** — list of event types with duration badges and scheduling links
- **Availability Schedule** — weekly availability windows for the current user
- **Organisation Members** — roster of organisation members with roles
- **User Profile** — current user's name, email, timezone, and scheduling URL

## Destructive operations

Confirm before calling — these mutate or remove Calendly data:

- `meetings-cancel_event` — cancels and notifies all invitees; irreversible via API
- `organizations-revoke_organization_invitation` — revokes access for the invitee
- `meetings-create_invitee_no_show` / `delete_invitee_no_show` — modifies meeting records

## See also

- [Calendly MCP Server documentation](https://developer.calendly.com/calendly-mcp-server)
- [Calendly supported MCP tools](https://developer.calendly.com/supported-tools)
- [Calendly Developer Portal](https://developer.calendly.com/)
- [OAuth 2.1 RFC 9700](https://www.rfc-editor.org/rfc/rfc9700)
- [Dynamic Client Registration RFC 7591](https://www.rfc-editor.org/rfc/rfc7591)
