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

/** `dd-Mmm-yy`, e.g. `05-Aug-26` — matches the platform's default date format. */
function formatDate(iso: unknown): string {
  const ms = Date.parse(String(iso ?? ''));
  if (!Number.isFinite(ms)) return '—';
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = String(d.getFullYear()).slice(-2);
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

interface EventStatus { label: string; tone: string; }

/**
 * Only genuinely exceptional states get a non-muted tone — most events are
 * simply "published and on sale", which is the platform's normal/no-news
 * state, not a "success". See TILE-DISPLAY-STANDARDS.md §7.
 */
function eventStatus(event: AnyRecord): EventStatus {
  if (event.isArchived) return { label: 'Archived', tone: 'muted' };
  if (event.suspendSales) return { label: 'Sales Suspended', tone: 'destructive' };
  if (event.markedAsSoldOut) return { label: 'Sold Out', tone: 'warning' };
  if (!event.published) return { label: 'Draft', tone: 'muted' };
  return { label: 'Published', tone: 'muted' };
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
 * Maps the `list_events` response into display rows for the Upcoming Events
 * tile. Filters out archived events, sorts soonest-first, and caps at 20 rows
 * (TILE-DISPLAY-STANDARDS.md §11).
 *
 * Each row: id, name, start_date (ISO, pass through to the Table's own
 * dd_mmm_yy formatter), location, capacity, status_label, status_tone.
 *
 * Args: { value: raw list_events response }
 */
const flatten_events: ComputedFunction = (args) => {
  const raw = toItems(args.value, 'events');
  return upcomingSorted(raw)
    .slice(0, 20)
    .map((event) => {
      const status = eventStatus(event);
      return {
        id: String(event._id ?? ''),
        name: String(event.name ?? 'Untitled event'),
        start_date: event.startDate ?? null,
        location: eventLocationLabel(event),
        capacity: event.totalCapacity != null ? String(event.totalCapacity) : '—',
        status_label: status.label,
        status_tone: status.tone,
      };
    });
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
  return `${name} (${formatDate(next.startDate)})`;
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
    flatten_events,
    next_upcoming_event_id,
    next_upcoming_event_label,
    flatten_tickets,
  },
};

export default elements;
