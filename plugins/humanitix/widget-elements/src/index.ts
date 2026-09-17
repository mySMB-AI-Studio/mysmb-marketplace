import type { ComputedFunction, PluginElementsModule } from './types';

type AnyRecord = Record<string, unknown>;

/**
 * The Humanitix public API wraps list responses under a key matching the
 * resource name (e.g. `{ events: [...] }`, `{ tickets: [...] }`). Accept that
 * shape, a bare array, or a couple of common REST fallbacks defensively —
 * mirrors the same `toArray`-style guard used by other server-credential
 * connectors in this repo (see `plugins/worx-safety/widget-elements`-style
 * handling for `getComplianceSummary`).
 */
function toItems(raw: unknown, key: string): AnyRecord[] {
  if (Array.isArray(raw)) return raw as AnyRecord[];
  const v = (raw ?? {}) as AnyRecord;
  if (Array.isArray(v[key])) return v[key] as AnyRecord[];
  if (Array.isArray(v.data)) return v.data as AnyRecord[];
  if (Array.isArray(v.results)) return v.results as AnyRecord[];
  return [];
}

/**
 * `dd-Mmm-yy`, e.g. `05-Aug-26` — matches the platform's default date format.
 *
 * `timeZone` (an IANA name, e.g. "Australia/Perth") renders the event's own
 * local date rather than the viewer's — important since the same row also
 * shows the venue location, and Humanitix supplies `event.timezone` for
 * exactly this. Omit it to fall back to the viewer's local timezone.
 */
function formatDate(iso: unknown, timeZone?: string): string {
  const ms = Date.parse(String(iso ?? ''));
  if (!Number.isFinite(ms)) return '—';
  const d = new Date(ms);
  const opts: Intl.DateTimeFormatOptions = timeZone ? { timeZone } : {};
  const day = new Intl.DateTimeFormat('en-US', { ...opts, day: '2-digit' }).format(d);
  const month = new Intl.DateTimeFormat('en-US', { ...opts, month: 'short' }).format(d);
  const year = new Intl.DateTimeFormat('en-US', { ...opts, year: '2-digit' }).format(d);
  return `${day}-${month}-${year}`;
}

/**
 * `A$1,234.56` style — always resolves the symbol from the record's own
 * currency rather than assuming AUD, per the platform currency standard.
 */
function formatMoney(amount: unknown, currency: unknown): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  const code = String(currency || 'AUD').toUpperCase();
  const symbolMap: Record<string, string> = {
    AUD: 'A$', NZD: 'NZ$', USD: 'US$', GBP: '£', EUR: '€', CAD: 'C$',
  };
  const symbol = symbolMap[code] ?? `${code} `;
  return `${symbol}${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Best-effort human-readable location — Humanitix events may be online-only or in-person. */
function eventLocationLabel(event: AnyRecord): string {
  const loc = event.eventLocation;
  if (typeof loc === 'string' && loc.trim()) return loc.trim();
  if (loc && typeof loc === 'object') {
    const l = loc as AnyRecord;
    const candidate = l.venueName ?? l.city ?? l.address ?? l.name;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  if (typeof event.location === 'string' && event.location.trim()) return event.location.trim();
  return '—';
}

interface TicketStatus { label: string; tone: string; }

/** Humanitix ticket `status` is `complete` | `cancelled` per the public API docs. */
function ticketStatus(ticket: AnyRecord): TicketStatus {
  const s = String(ticket.status ?? '').toLowerCase();
  if (s === 'complete') return { label: 'Complete', tone: 'success' };
  if (s === 'cancelled' || s === 'canceled') return { label: 'Cancelled', tone: 'destructive' };
  if (!s) return { label: '—', tone: 'muted' };
  return { label: titleCase(s), tone: 'muted' };
}

function checkedInStatus(ticket: AnyRecord): { label: string; tone: string } {
  const v = ticket.checkIn;
  const isIn = Array.isArray(v) ? v.length > 0 : Boolean(v);
  return isIn ? { label: 'Checked In', tone: 'success' } : { label: 'Not Checked In', tone: 'muted' };
}

/**
 * Non-archived events that haven't already ended (uses `endDate`, falling
 * back to `startDate` for single-instant events without one), sorted
 * soonest-first.
 */
function upcomingSorted(raw: AnyRecord[]): AnyRecord[] {
  const now = Date.now();
  return raw
    .filter((e) => {
      if (e.isArchived) return false;
      const endMs = Date.parse(String(e.endDate ?? e.startDate ?? ''));
      return !Number.isFinite(endMs) || endMs >= now;
    })
    .slice()
    .sort((a, b) => {
      const ta = Date.parse(String(a.startDate ?? ''));
      const tb = Date.parse(String(b.startDate ?? ''));
      const sa = Number.isFinite(ta) ? ta : Number.POSITIVE_INFINITY;
      const sb = Number.isFinite(tb) ? tb : Number.POSITIVE_INFINITY;
      return sa - sb;
    });
}

/**
 * Single decorative tone for every row's date badge. Matches the tile's own
 * header icon so the calendar-badge color reads as "this tile's color," not
 * per-event category coding — deliberately one consistent color, per
 * TILE-DISPLAY-STANDARDS.md §7's decorative (non-status) color guidance.
 *
 * Uses `chart-1` rather than `accent`/`info`: this system's `TONE_TEXT` maps
 * both `accent` and `info` to the plain foreground color for *text* (only
 * their *background* tint is actually accent/info-colored), so a badge or
 * label asking for blue-looking text has to reach for a tone whose text
 * mapping is a real color — the `chart-N` set (or `brand`, if this tile ever
 * declares its own `brandColor`) are the only ones that qualify.
 */
const DATE_BADGE_TONE = 'chart-1';

/** "23" — zero-padded day-of-month, in the event's own timezone. */
function formatDayNumber(iso: unknown, timeZone?: string): string {
  const ms = Date.parse(String(iso ?? ''));
  if (!Number.isFinite(ms)) return '—';
  const opts: Intl.DateTimeFormatOptions = timeZone ? { timeZone } : {};
  return new Intl.DateTimeFormat('en-US', { ...opts, day: '2-digit' }).format(new Date(ms));
}

/** "SEP" — uppercase 3-letter month, matching the calendar-chip convention. */
function formatMonthAbbrev(iso: unknown, timeZone?: string): string {
  const ms = Date.parse(String(iso ?? ''));
  if (!Number.isFinite(ms)) return '—';
  const opts: Intl.DateTimeFormatOptions = timeZone ? { timeZone } : {};
  return new Intl.DateTimeFormat('en-US', { ...opts, month: 'short' }).format(new Date(ms)).toUpperCase();
}

/** "9:00 AM" — no weekday, see `formatDate` re: the `timeZone` param. */
function formatTimeOnly(iso: unknown, timeZone?: string): string {
  const ms = Date.parse(String(iso ?? ''));
  if (!Number.isFinite(ms)) return '—';
  const opts: Intl.DateTimeFormatOptions = timeZone ? { timeZone } : {};
  return new Intl.DateTimeFormat('en-US', { ...opts, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(ms));
}

/**
 * Humanitix's event object exposes `totalCapacity` but no direct
 * "sold" count — per-type sold counts, if present at all, would live
 * nested inside `ticketTypes`. Try the plausible field names defensively;
 * when none are populated, degrade to showing capacity without a sold
 * count rather than fabricating one.
 */
function ticketsSoldFromEvent(event: AnyRecord): number | null {
  const types = Array.isArray(event.ticketTypes) ? (event.ticketTypes as AnyRecord[]) : [];
  if (types.length === 0) return null;
  let total = 0;
  let anyKnown = false;
  for (const t of types) {
    const sold = t.sold ?? t.quantitySold ?? t.ticketsSold ?? t.numSold;
    if (typeof sold === 'number' && Number.isFinite(sold)) {
      total += sold;
      anyKnown = true;
    }
  }
  return anyKnown ? total : null;
}

interface CapacityMeta { label: string; tone: string; }

/**
 * "142/500" (always `warning`/amber — a ticket count worth noticing, not an
 * escalating-severity status), "—/500" when capacity is known but the sold
 * count isn't (`muted`, nothing to report), or "Free" (`success`/green) when
 * Humanitix reports no capacity cap at all — matching the reference design's
 * treatment of uncapped events as free/RSVP-style. Not a guarantee the event
 * is actually $0 — Humanitix's event object doesn't expose pricing status
 * directly — but the reference design's own repeated convention for this
 * exact case.
 */
function capacityMeta(event: AnyRecord): CapacityMeta {
  const total =
    typeof event.totalCapacity === 'number' && event.totalCapacity > 0 ? event.totalCapacity : null;
  if (total === null) return { label: 'Free', tone: 'success' };
  const sold = ticketsSoldFromEvent(event);
  if (sold === null) return { label: `—/${total}`, tone: 'muted' };
  return { label: `${sold}/${total}`, tone: 'warning' };
}

/** True for a humanitix.com host, on a URL that already has an http(s) scheme. */
function isHumanitixHost(u: URL): boolean {
  return (u.protocol === 'http:' || u.protocol === 'https:') && /humanitix\.com$/i.test(u.hostname);
}

/**
 * Resolves `raw` to an absolute humanitix.com URL, or '' if it can't be made
 * into one safely.
 *
 * Handles three shapes:
 *  - Already absolute + on a humanitix.com host → used as-is.
 *  - Scheme-less but otherwise host-shaped (e.g. "events.humanitix.com/e/x",
 *    a real thing some APIs return) → prefix "https://" and re-check. This
 *    matters a lot here: passed to `window.open` as-is, a scheme-less string
 *    isn't rejected by the browser — it's resolved as a RELATIVE PATH
 *    against the CURRENT page's own origin (confirmed: `new URL('events.
 *    humanitix.com/e/x', 'http://localhost:5173').href` →
 *    "http://localhost:5173/events.humanitix.com/e/x"), silently landing back
 *    on the harness/MyHub tab instead of erroring. That's the exact "redirected
 *    to the Tile Harness page" bug this function exists to prevent.
 *  - Absolute but on some other host, or unparseable → rejected outright;
 *    never guess our way onto the wrong domain.
 */
function toAbsoluteHumanitixUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return isHumanitixHost(u) ? u.href : '';
  } catch {
    /* not absolute — try the scheme-less case below */
  }
  try {
    const withScheme = new URL(`https://${raw}`);
    return isHumanitixHost(withScheme) ? withScheme.href : '';
  } catch {
    return '';
  }
}

/**
 * The event's own public Humanitix page — "open where it is located in
 * Humanitix".
 *
 * Prefers `event.url` (see `toAbsoluteHumanitixUrl` for exactly what's
 * accepted from it — absolute or scheme-less, but always on humanitix.com).
 * Falls back to constructing a URL from `event.slug` on Humanitix's public
 * ticketing domain when `url` isn't usable. Returns '' (row becomes
 * non-clickable) if neither is available — never guesses a URL that might
 * point at the wrong page.
 */
function eventPublicUrl(event: AnyRecord): string {
  const rawUrl = typeof event.url === 'string' ? event.url.trim() : '';
  if (rawUrl) {
    const resolved = toAbsoluteHumanitixUrl(rawUrl);
    if (resolved) return resolved;
  }
  const slug = typeof event.slug === 'string' ? event.slug.trim() : '';
  if (slug) return `https://events.humanitix.com/${slug}`;
  return '';
}

/**
 * Maps the `list_events` response into compact, clickable display rows for
 * the Upcoming Events tile — each row opens the event's own Humanitix page
 * in a new tab via `open_url` (bound to `event_url` in the widget spec).
 * Filters out archived and already-ended events, sorts soonest-first, and
 * caps at `displayLimit` (default 5, matching the reference design;
 * `dataProvider.params.pageSize` controls how many are actually fetched).
 *
 * Each row: id, name, event_url, category_tone, start_day_label,
 * start_month_label, start_time_label, location_label, capacity_label,
 * capacity_tone.
 *
 * Args: { value: raw list_events response, displayLimit?: number }
 */
const flatten_upcoming_events_compact: ComputedFunction = (args) => {
  const raw = toItems(args.value, 'events');
  const limit = Number(args.displayLimit ?? 5);
  return upcomingSorted(raw)
    .slice(0, limit)
    .map((event, index) => {
      const cap = capacityMeta(event);
      const tz = typeof event.timezone === 'string' && event.timezone ? event.timezone : undefined;
      const location = eventLocationLabel(event);
      const url = eventPublicUrl(event);
      // `_id` should always be present and unique, but a blank/duplicate id
      // here would make React (and the `repeat` binding, which resolves
      // `$item` by matching this key) silently collapse two different
      // events onto one row — the exact "clicked X, went to Y" shape of bug.
      // The index suffix makes that structurally impossible regardless.
      const rawId = typeof event._id === 'string' ? event._id.trim() : '';
      return {
        id: rawId ? `${rawId}-${index}` : `row-${index}`,
        name: String(event.name ?? 'Untitled event'),
        event_url: url,
        has_url: url.length > 0,
        category_tone: DATE_BADGE_TONE,
        start_day_label: formatDayNumber(event.startDate, tz),
        start_month_label: formatMonthAbbrev(event.startDate, tz),
        start_time_label: formatTimeOnly(event.startDate, tz),
        location_label: location === '—' ? 'Online' : location,
        capacity_label: cap.label,
        capacity_tone: cap.tone,
      };
    });
};

/**
 * Companion to `flatten_upcoming_events_compact` — `shown` (rows actually
 * displayed, for the header's "Next N" badge) and `total` (for the "View
 * all N events" footer link). Both capped by however many upcoming events
 * actually came back (itself capped by the dataProvider's own `pageSize`),
 * not a live count of everything on Humanitix.
 *
 * Args: { value: raw list_events response, displayLimit?: number }
 */
const upcoming_events_counts: ComputedFunction = (args) => {
  const raw = toItems(args.value, 'events');
  const total = upcomingSorted(raw).length;
  const shown = Math.min(Number(args.displayLimit ?? 5), total);
  return { shown, total };
};

/**
 * Finds the soonest non-archived event and returns its id — used to
 * auto-select the event the ticket-sales tile drills into. Returns an empty
 * string when there are no events (the tile then shows its empty state
 * rather than calling `list_tickets` with a blank eventId).
 *
 * Args: { value: raw list_events response }
 */
const next_upcoming_event_id: ComputedFunction = (args) => {
  const raw = toItems(args.value, 'events');
  const next = upcomingSorted(raw)[0];
  return next ? String(next._id ?? '') : '';
};

/**
 * Companion to `next_upcoming_event_id` — a display label for the same
 * event, e.g. "Winter Gala (12-Oct-26)". Empty string when there is none.
 *
 * Args: { value: raw list_events response }
 */
const next_upcoming_event_label: ComputedFunction = (args) => {
  const raw = toItems(args.value, 'events');
  const next = upcomingSorted(raw)[0];
  if (!next) return '';
  const name = String(next.name ?? 'Untitled event');
  const tz = typeof next.timezone === 'string' && next.timezone ? next.timezone : undefined;
  return `${name} (${formatDate(next.startDate, tz)})`;
};

/**
 * Maps the `list_tickets` response (for one event) into display rows for the
 * Event Ticket Sales tile.
 *
 * Each row: id, attendee, ticket_type, amount_label, status_label,
 * status_tone, checked_in_label, checked_in_tone.
 *
 * Args: { value: raw list_tickets response }
 */
const flatten_tickets: ComputedFunction = (args) => {
  const raw = toItems(args.value, 'tickets');
  return raw.slice(0, 20).map((ticket) => {
    const status = ticketStatus(ticket);
    const checkedIn = checkedInStatus(ticket);
    const name = `${String(ticket.firstName ?? '').trim()} ${String(ticket.lastName ?? '').trim()}`.trim();
    return {
      id: String(ticket._id ?? ''),
      attendee: name || '—',
      ticket_type: String(ticket.ticketTypeName ?? '—'),
      amount_label: formatMoney(ticket.total, ticket.currency),
      status_label: status.label,
      status_tone: status.tone,
      checked_in_label: checkedIn.label,
      checked_in_tone: checkedIn.tone,
    };
  });
};

const elements: PluginElementsModule = {
  slug: 'humanitix',
  functions: {
    flatten_upcoming_events_compact,
    upcoming_events_counts,
    next_upcoming_event_id,
    next_upcoming_event_label,
    flatten_tickets,
  },
};

export default elements;
