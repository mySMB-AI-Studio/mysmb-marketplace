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

    return {
      id,
      name,
      date_label: dateLabel,
      status_label: event_status_label({ value: status }),
      status_tone: event_status_tone({ value: status }),
      location_label: location_label({ value: isOnline }),
      url: String(event.url ?? ''),
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
  },
};

export default elements;
