import type { ComputedFunction, PluginElementsModule } from './types';

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Format an ISO-ish date/datetime string to dd-Mmm-yy (e.g. "09-Sep-26"),
 * per TILE-DISPLAY-STANDARDS.md §1. Eventbrite's `start.local` / `end.local`
 * fields come back as a naive local-time string with no offset (e.g.
 * "2026-10-01T09:00:00") — `Date.parse` treats that as local time in
 * whatever timezone this code runs in, which is fine for a display-only
 * calendar-date label (the day doesn't shift), but NOT reliable if this
 * value were ever used for a real time-of-day computation across timezones.
 *
 * Called via `$computed` — both directly (single-object detail fields) and
 * from `flatten_upcoming_events` below (NOT as a `Table` column `format`;
 * see that function's own doc comment for why `Table` can't call plugin
 * functions here).
 *
 * Args: { value: string }
 */
const format_date: ComputedFunction = (args) => {
  const raw = args.value;
  if (!raw) return '—';
  const ms = Date.parse(String(raw));
  if (Number.isNaN(ms)) return '—';
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_ABBR[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
};

/**
 * Title-Case label for an Eventbrite event `status` value, per
 * TILE-DISPLAY-STANDARDS.md §3 (never show a raw connector enum in a badge).
 * Status values per the MCP server's EVENT_STATUS enum
 * (myhub-mcp-servers/src/integrations/eventbrite/servers/eventbrite.ts):
 * draft | live | started | ended | completed | canceled | all.
 */
const EVENT_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  live: 'Live',
  started: 'Started',
  ended: 'Ended',
  completed: 'Completed',
  canceled: 'Canceled',
};

const event_status_label: ComputedFunction = (args) => {
  const raw = String(args.value ?? '').toLowerCase();
  return EVENT_STATUS_LABELS[raw] ?? (raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Unknown');
};

/**
 * Tone for an Eventbrite event status, per TILE-DISPLAY-STANDARDS.md §7.
 * `status` is a progression field (draft -> live -> started -> ended ->
 * completed, with `canceled` as a terminal negative branch) — per §7, a
 * progression field's open/in-progress stages get `info`, not `muted`
 * ("muted means nothing to report, not early"), reserving `success` for the
 * genuinely terminal, positive-outcome stage.
 *   draft     -> muted       (not yet published; no audience-facing urgency)
 *   live      -> info        (open for registration, in progress)
 *   started   -> info        (currently happening)
 *   ended     -> muted       (naturally finished, nothing left to do)
 *   completed -> success     (terminal, done — matches "success = done" rule)
 *   canceled  -> destructive (terminal, negative)
 */
const event_status_tone: ComputedFunction = (args) => {
  const raw = String(args.value ?? '').toLowerCase();
  switch (raw) {
    case 'live':
    case 'started':
      return 'info';
    case 'completed':
      return 'success';
    case 'canceled':
      return 'destructive';
    case 'ended':
    case 'draft':
    default:
      return 'muted';
  }
};

/**
 * Decorative (non-status) label for Eventbrite's `online_event` boolean —
 * per TILE-DISPLAY-STANDARDS.md §7, this is not state that changes urgency,
 * so it's plain text, not a toned badge.
 *
 * Args: { value: boolean }
 */
const location_label: ComputedFunction = (args) => (args.value ? 'Online' : 'In Person');

/**
 * Em-dash for null/undefined/empty-string, otherwise the stringified value.
 * The platform's own `dash_if_empty` (myHubV2
 * `apps/web/src/features/widgets-system/system/functions.ts`) lives ONLY in
 * the `cellFormatters` registry, which `Table` resolves directly and which
 * is NOT merged into the generic `$computed` registry
 * (`renderer.tsx`'s `mergeElements(systemElements, pluginElements)`) that
 * `KeyValue.value` / `Text.text` / other non-`Table` props resolve against —
 * confirmed by reading both files rather than assuming. So a non-`Table`
 * field needing the same "—" fallback needs its own plugin-local copy.
 *
 * Args: { value: unknown }
 */
const dash_if_empty: ComputedFunction = (args) => {
  const v = args.value;
  if (v == null) return '—';
  const s = String(v);
  return s.length === 0 ? '—' : s;
};

/**
 * Flattens a `list_events` response (Eventbrite v3's
 * `{ pagination, events: [...] }` shape — see api/client.ts in
 * myhub-mcp-servers for why this shape is cross-checked against Eventbrite's
 * PHP SDK / third-party docs rather than a live sandbox call) into display
 * rows for the Upcoming Events tile.
 *
 * Hand-rolled (not a `Table`) deliberately: `Table`'s `format`/`toneFormat`
 * column props only resolve against the platform's fixed, hardcoded
 * `cellFormatters`/`cellToneFormatters` registries in myHubV2
 * (`apps/web/src/features/widgets-system/system/functions.ts`, imported
 * directly by `system/components.tsx`) — a plugin's own widget-element
 * functions are NOT merged into those two registries the way they ARE
 * merged into the generic `$computed` registry every other prop
 * (`Badge.tone`, `KeyValue.value`, a `watch`'s `setState`, …) resolves
 * against (`renderer.tsx`'s `mergeElements(systemElements, pluginElements)`).
 * Confirmed by reading both files directly rather than assuming from other
 * plugins' widgets — `xero_chargetype` / `xero_projects_status` /
 * `xero_minutes`, which look like plugin-namespaced names, are in fact
 * hardcoded first-party entries in that same system file, not resolved
 * through the generic plugin mechanism. A `Table` column referencing
 * `eventbrite_event_status_tone` as `toneFormat` would silently fall through
 * to the default (grey, uncolored) tone instead of calling this plugin's
 * function. Hand-rolling here (same pattern as this marketplace's Asana
 * `flatten_overdue_tasks` / Atlassian request-list tiles) lets `status_tone`
 * reach a `Badge` via `$item`, which DOES go through the real merged
 * registry.
 *
 * Documented event fields used: `id`, `name.text`, `start.local`, `status`,
 * `online_event` (bool), `url`. Read defensively (`??`) — this plugin was
 * built without a live sandbox token, so field presence has not been
 * confirmed end-to-end (see this plugin's README).
 *
 * Row 0 carries footer_label: "N upcoming events".
 * Each row has: id, name, date_label (dd-Mmm-yy or "—"), status_label,
 * status_tone, location_label ("Online" | "In Person"), url.
 *
 * Args: { value: array } — the response's `events` array.
 */
const flatten_upcoming_events: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  if (raw.length === 0) return [];

  const rows = raw.map((event) => {
    const id = String(event.id ?? '');
    const nameObj = event.name as Record<string, unknown> | undefined;
    const name = String(nameObj?.text ?? event.name ?? 'Untitled event');

    const startObj = event.start as Record<string, unknown> | undefined;
    const startLocal = startObj?.local ? String(startObj.local) : null;
    const dateLabel = startLocal ? String(format_date({ value: startLocal })) : '—';

    const status = String(event.status ?? '');
    const isOnline = Boolean(event.online_event);

    // Eventbrite returns `capacity: null` for an event with no attendee cap
    // ("unlimited" ticketing) rather than omitting the field — carried
    // through as `null` (not 0) so the Check-In Progress tile can tell
    // "no seats" apart from "no cap set" and skip the fill-percentage line
    // instead of showing a misleading "0 seats" or dividing by zero.
    const capacityRaw = event.capacity;
    const capacity = typeof capacityRaw === 'number' && capacityRaw > 0 ? capacityRaw : null;

    return {
      id,
      name,
      date_label: dateLabel,
      status_label: event_status_label({ value: status }),
      status_tone: event_status_tone({ value: status }),
      location_label: location_label({ value: isOnline }),
      url: String(event.url ?? ''),
      capacity,
      footer_label: '',
    };
  });

  const total = raw.length;
  rows[0].footer_label = `${total} upcoming event${total === 1 ? '' : 's'}`;

  return rows;
};

/**
 * Flattens a `get_event` response's `ticket_classes` array (only present
 * when `get_event` was called with `expand: ["ticket_classes"]`) into
 * display rows for the Event Details tile's ticket-classes list.
 *
 * `price_label` combines two fields on the same source object (`free` +
 * `cost.display`) per TILE-DISPLAY-STANDARDS.md §6's note that a `Table`
 * column formatter only sees its own field — so this is pre-computed here
 * rather than left to a column `format`, same as this marketplace's other
 * multi-field derived cells.
 *
 * Documented fields used: `id`, `name`, `free` (bool), `cost.display`,
 * `quantity_total`, `quantity_sold`. Read defensively (`??`) — this plugin
 * was built without a live sandbox token, so field presence on a real
 * response has not been confirmed end-to-end (see this plugin's README).
 *
 * Args: { value: array }
 */
const flatten_ticket_classes: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  if (raw.length === 0) return [];

  return raw.map((tc, i) => {
    const costObj = tc.cost as Record<string, unknown> | undefined;
    const isFree = Boolean(tc.free);
    const priceLabel = isFree ? 'Free' : String(costObj?.display ?? '—');

    const total = tc.quantity_total != null ? Number(tc.quantity_total) : null;
    const sold = tc.quantity_sold != null ? Number(tc.quantity_sold) : null;
    const soldLabel = total != null && sold != null ? `${sold} of ${total} sold` : '—';

    return {
      id: String(tc.id ?? i),
      name: String(tc.name ?? 'Ticket'),
      price_label: priceLabel,
      sold_label: soldLabel,
    };
  });
};

/**
 * Summarizes a `list_attendees` response's `attendees` array — plus the
 * selected event's own seat `capacity` (carried on its row by
 * `flatten_upcoming_events`) — into check-in AND seat-fill stats for the
 * Check-In Progress tile.
 *
 * Two distinct percentages, deliberately not conflated: `percent` is
 * check-in rate (checked-in ÷ registered attendees); `filled_percent` is
 * seat-fill rate (registered attendees ÷ event capacity). An event can be
 * 100% checked-in while only 40% of its seats sold, or vice versa before
 * doors open — collapsing them into one number would hide that.
 *
 * `capacity` is `null` (not 0) for an Eventbrite event with no attendee
 * cap ("unlimited" ticketing) — `filled_percent` is `null` in that case
 * too, since there's no denominator to fill against; the tile skips
 * rendering the fill line rather than showing a fake 0%/divide-by-zero.
 *
 * Documented field used: `checked_in` (boolean) — Eventbrite v3's own
 * attendee-object field for this concept. Not confirmed against a live
 * sandbox response with real attendees: the test events used while
 * building this plugin have zero registrations, so `list_attendees`
 * only ever returned an empty array during development (see this
 * plugin's README's data verification note) — the response envelope
 * shape (`{ attendees: [...], pagination }`) IS live-confirmed, just not
 * the per-attendee field names.
 *
 * Args: { attendees: array, capacity: number | null }
 * Returns: { checked_in, total, remaining, percent, capacity, filled_percent }
 * — `percent`/`filled_percent` are 0-100 integers (or `null` for
 * `filled_percent` with no capacity), ready for `ProgressBar.value`
 * directly (0 when total is 0, not NaN).
 */
const checkin_summary: ComputedFunction = (args) => {
  const raw = Array.isArray(args.attendees) ? (args.attendees as Record<string, unknown>[]) : [];
  const total = raw.length;
  const checkedIn = raw.filter((a) => Boolean(a.checked_in)).length;
  const percent = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

  const capacity = typeof args.capacity === 'number' && args.capacity > 0 ? args.capacity : null;
  const filledPercent = capacity != null ? Math.min(100, Math.round((total / capacity) * 100)) : null;

  return {
    checked_in: checkedIn,
    total,
    remaining: total - checkedIn,
    percent,
    capacity,
    filled_percent: filledPercent,
  };
};

/**
 * Flattens a `list_attendees` response's `attendees` array into display
 * rows for the Check-In Lookup tile's attendee list.
 *
 * Per TILE-DISPLAY-STANDARDS.md §11 (max 20 rows shown at once; a plain
 * count when truncated, no "see more" reveal exists on `repeat` yet),
 * this caps the returned rows at 20 regardless of how many attendees
 * exist — `checkin_summary`, run separately against the SAME untruncated
 * `attendees` array, still reports the true total for the "Showing 20 of
 * N" note.
 *
 * Documented fields used: `id`, `profile.name`, `profile.email`,
 * `checked_in` (bool), `ticket_class_name`. Not confirmed against a live
 * response with real attendees — the test events used while building
 * this plugin have zero registrations (see this plugin's README's data
 * verification note); sourced from Eventbrite's own v3 API docs, not
 * observed. This is organizer-facing data (the same attendee roster
 * Eventbrite's own dashboard shows the event's organizer) — not exposed
 * to anyone the organizer hasn't already connected this plugin for.
 *
 * Args: { value: array } — the response's `attendees` array (untruncated).
 */
const flatten_attendees: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];

  return raw.slice(0, 20).map((attendee, i) => {
    const profile = attendee.profile as Record<string, unknown> | undefined;
    const checkedIn = Boolean(attendee.checked_in);

    return {
      id: String(attendee.id ?? i),
      name: dash_if_empty({ value: profile?.name }),
      email: dash_if_empty({ value: profile?.email }),
      ticket_label: dash_if_empty({ value: attendee.ticket_class_name }),
      checkin_label: checkedIn ? 'Checked In' : 'Not Checked In',
      checkin_tone: checkedIn ? 'success' : 'muted',
    };
  });
};

/**
 * Buckets a `list_attendees` response's `attendees` array into four
 * status-filtered tabs for the Guest List tile: `all`, `checked_in`,
 * `not_checked_in`, `cancelled` (this last one covers BOTH `cancelled` and
 * `refunded` attendees — Eventbrite tracks them as two independent boolean
 * fields, but neither reads as "an actual guest" to an organizer scanning
 * the roster, so they share one tab rather than splitting into two mostly-
 * empty ones).
 *
 * Per TILE-DISPLAY-STANDARDS.md §11, each tab's row array is capped at 20 —
 * a `_total` sibling field (e.g. `checked_in_total`) carries the true,
 * untruncated count for that bucket, both for the tab button's "(N)" label
 * and for a "Showing 20 of N" note when a bucket is truncated.
 *
 * `name` prefers `profile.first_name` + `profile.last_name` over
 * `profile.name` — live-verified 2026-09-16 against a real (test) attendee
 * on a connected account: `profile.name` came back as a malformed Python
 * byte-string repr (`"b'Neil' b'Simon'"`), while `first_name`/`last_name`
 * were clean. This plugin's Check-In Progress tile (`flatten_attendees`
 * above) still reads `profile.name` directly and was built before this was
 * caught — NOT fixed here, since that's a different tile's file; flagged
 * for a follow-up.
 *
 * Status tone/label priority (highest wins): `cancelled` or `refunded` ->
 * "Cancelled"/destructive; else `checked_in` -> "Checked In"/success; else
 * "Not Checked In"/muted — same checked-in/not-checked-in tone pairing as
 * `checkin_summary` above, so the two tiles read consistently.
 *
 * Documented fields used: `id`, `profile.first_name`, `profile.last_name`,
 * `profile.name` (fallback only), `profile.email`, `ticket_class_name`,
 * `checked_in`, `cancelled`, `refunded` (all booleans) — every one of these
 * is now live-confirmed (2026-09-16), unlike `flatten_attendees` above
 * which shipped field-names-from-docs-only.
 *
 * Args: { value: array } — the response's `attendees` array (untruncated).
 * Returns: { all, all_total, checked_in, checked_in_total,
 *            not_checked_in, not_checked_in_total, cancelled, cancelled_total }
 */
const flatten_guest_list: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];

  const toRow = (attendee: Record<string, unknown>, i: number) => {
    const profile = (attendee.profile as Record<string, unknown> | undefined) ?? {};
    const firstName = String(profile.first_name ?? '').trim();
    const lastName = String(profile.last_name ?? '').trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const name = fullName || dash_if_empty({ value: profile.name ?? profile.email });

    const cancelled = Boolean(attendee.cancelled);
    const refunded = Boolean(attendee.refunded);
    const checkedIn = Boolean(attendee.checked_in);

    let statusLabel: string;
    let statusTone: string;
    if (cancelled || refunded) {
      statusLabel = cancelled ? 'Cancelled' : 'Refunded';
      statusTone = 'destructive';
    } else if (checkedIn) {
      statusLabel = 'Checked In';
      statusTone = 'success';
    } else {
      statusLabel = 'Not Checked In';
      statusTone = 'muted';
    }

    return {
      id: String(attendee.id ?? i),
      name,
      email: dash_if_empty({ value: profile.email }),
      ticket_label: dash_if_empty({ value: attendee.ticket_class_name }),
      status_label: statusLabel,
      status_tone: statusTone,
      _cancelled: cancelled || refunded,
      _checked_in: checkedIn,
    };
  };

  const allRows = raw.map(toRow);
  const checkedInRows = allRows.filter((r) => r._checked_in && !r._cancelled);
  const notCheckedInRows = allRows.filter((r) => !r._checked_in && !r._cancelled);
  const cancelledRows = allRows.filter((r) => r._cancelled);

  const strip = (rows: typeof allRows) =>
    rows.slice(0, 20).map(({ _cancelled, _checked_in, ...rest }) => rest);

  return {
    all: strip(allRows),
    all_total: allRows.length,
    checked_in: strip(checkedInRows),
    checked_in_total: checkedInRows.length,
    not_checked_in: strip(notCheckedInRows),
    not_checked_in_total: notCheckedInRows.length,
    cancelled: strip(cancelledRows),
    cancelled_total: cancelledRows.length,
  };
};

const elements: PluginElementsModule = {
  slug: 'eventbrite',
  functions: {
    format_date,
    event_status_label,
    event_status_tone,
    location_label,
    dash_if_empty,
    flatten_upcoming_events,
    flatten_ticket_classes,
    checkin_summary,
    flatten_attendees,
    flatten_guest_list,
  },
};

export default elements;
