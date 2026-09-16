/**
 * The Humanitix public API wraps list responses under a key matching the
 * resource name (e.g. `{ events: [...] }`, `{ tickets: [...] }`). Accept that
 * shape, a bare array, or a couple of common REST fallbacks defensively —
 * mirrors the same `toArray`-style guard used by other server-credential
 * connectors in this repo (see `plugins/worx-safety/widget-elements`-style
 * handling for `getComplianceSummary`).
 */
function toItems(raw, key) {
    if (Array.isArray(raw))
        return raw;
    const v = (raw ?? {});
    if (Array.isArray(v[key]))
        return v[key];
    if (Array.isArray(v.data))
        return v.data;
    if (Array.isArray(v.results))
        return v.results;
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
function formatDate(iso, timeZone) {
    const ms = Date.parse(String(iso ?? ''));
    if (!Number.isFinite(ms))
        return '—';
    const d = new Date(ms);
    const opts = timeZone ? { timeZone } : {};
    const day = new Intl.DateTimeFormat('en-US', { ...opts, day: '2-digit' }).format(d);
    const month = new Intl.DateTimeFormat('en-US', { ...opts, month: 'short' }).format(d);
    const year = new Intl.DateTimeFormat('en-US', { ...opts, year: '2-digit' }).format(d);
    return `${day}-${month}-${year}`;
}
/**
 * `A$1,234.56` style — always resolves the symbol from the record's own
 * currency rather than assuming AUD, per the platform currency standard.
 */
function formatMoney(amount, currency) {
    const n = Number(amount);
    if (!Number.isFinite(n))
        return '—';
    const code = String(currency || 'AUD').toUpperCase();
    const symbolMap = {
        AUD: 'A$', NZD: 'NZ$', USD: 'US$', GBP: '£', EUR: '€', CAD: 'C$',
    };
    const symbol = symbolMap[code] ?? `${code} `;
    return `${symbol}${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function titleCase(s) {
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
/** Best-effort human-readable location — Humanitix events may be online-only or in-person. */
function eventLocationLabel(event) {
    const loc = event.eventLocation;
    if (typeof loc === 'string' && loc.trim())
        return loc.trim();
    if (loc && typeof loc === 'object') {
        const l = loc;
        const candidate = l.venueName ?? l.city ?? l.address ?? l.name;
        if (typeof candidate === 'string' && candidate.trim())
            return candidate.trim();
    }
    if (typeof event.location === 'string' && event.location.trim())
        return event.location.trim();
    return '—';
}
/** Humanitix ticket `status` is `complete` | `cancelled` per the public API docs. */
function ticketStatus(ticket) {
    const s = String(ticket.status ?? '').toLowerCase();
    if (s === 'complete')
        return { label: 'Complete', tone: 'success' };
    if (s === 'cancelled' || s === 'canceled')
        return { label: 'Cancelled', tone: 'destructive' };
    if (!s)
        return { label: '—', tone: 'muted' };
    return { label: titleCase(s), tone: 'muted' };
}
function checkedInStatus(ticket) {
    const v = ticket.checkIn;
    const isIn = Array.isArray(v) ? v.length > 0 : Boolean(v);
    return isIn ? { label: 'Checked In', tone: 'success' } : { label: 'Not Checked In', tone: 'muted' };
}
/**
 * Non-archived events that haven't already ended (uses `endDate`, falling
 * back to `startDate` for single-instant events without one), sorted
 * soonest-first.
 */
function upcomingSorted(raw) {
    const now = Date.now();
    return raw
        .filter((e) => {
        if (e.isArchived)
            return false;
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
 * `chart-1`..`chart-5` — the platform's categorical (non-status) tone set
 * (TILE-DISPLAY-STANDARDS.md §7 "Categorical breakdowns"). Used here to give
 * each distinct event category a stable, deterministic color — never a
 * status tone, since "what kind of event is this" isn't a state that
 * changes based on live data.
 */
const CHART_TONES = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'];
/** Same category always maps to the same tone, regardless of what else is in the list. */
function stableCategoryTone(category) {
    const key = (category || 'uncategorised').toLowerCase();
    let hash = 0;
    for (let i = 0; i < key.length; i++)
        hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return CHART_TONES[hash % CHART_TONES.length];
}
/** "Conference · Hybrid" — Title Case, de-duplicated, from category + classification. */
function eventSubtitle(event) {
    const parts = [event.category, event.classification]
        .filter((v) => typeof v === 'string' && v.trim().length > 0)
        .map((v) => titleCase(v.trim()));
    const unique = [...new Set(parts)];
    return unique.length ? unique.join(' · ') : '—';
}
/** "Wed · 9:00 AM" — see `formatDate` re: the `timeZone` param. */
function formatDayTime(iso, timeZone) {
    const ms = Date.parse(String(iso ?? ''));
    if (!Number.isFinite(ms))
        return '—';
    const d = new Date(ms);
    const opts = timeZone ? { timeZone } : {};
    const weekday = new Intl.DateTimeFormat('en-US', { ...opts, weekday: 'short' }).format(d);
    const time = new Intl.DateTimeFormat('en-US', { ...opts, hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
    return `${weekday} · ${time}`;
}
/**
 * Humanitix's event object exposes `totalCapacity` but no direct
 * "sold" count — per-type sold counts, if present at all, would live
 * nested inside `ticketTypes`. Try the plausible field names defensively;
 * when none are populated, degrade to showing capacity without a sold
 * count rather than fabricating one.
 */
function ticketsSoldFromEvent(event) {
    const types = Array.isArray(event.ticketTypes) ? event.ticketTypes : [];
    if (types.length === 0)
        return null;
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
function capacityInfo(event, categoryTone) {
    const total = typeof event.totalCapacity === 'number' && event.totalCapacity > 0 ? event.totalCapacity : null;
    if (total === null) {
        return { has_capacity: false, capacity_label: '', capacity_pct: 0, capacity_tone: categoryTone };
    }
    const sold = ticketsSoldFromEvent(event);
    if (sold === null) {
        // Capacity is known, sold count isn't — show the ceiling only, no bar fill implied.
        return { has_capacity: true, capacity_label: `— / ${total}`, capacity_pct: 0, capacity_tone: 'muted' };
    }
    const pct = Math.max(0, Math.min(100, Math.round((sold / total) * 100)));
    const nearlyFull = pct >= 90;
    return {
        has_capacity: true,
        capacity_label: `${sold} / ${total}`,
        capacity_pct: pct,
        capacity_tone: nearlyFull ? 'warning' : categoryTone,
    };
}
function locationIconLabel(event) {
    const label = eventLocationLabel(event);
    if (label === '—')
        return { icon: 'Globe', label: 'Online' };
    return { icon: 'MapPin', label };
}
/**
 * Maps the `list_events` response into rich display rows for the Upcoming
 * Events tile. Filters out archived and already-ended events, sorts
 * soonest-first, and caps at `displayLimit` (default 5 — the tile shows a
 * handful with a "Showing X of Y" count, matching the reference design;
 * `dataProvider.params.pageSize` controls how many are actually fetched).
 *
 * Each row: id, name, subtitle, category_tone, start_date_label,
 * start_time_label, location_icon, location_label, has_capacity,
 * capacity_label, capacity_pct, capacity_tone.
 *
 * Args: { value: raw list_events response, displayLimit?: number }
 */
const flatten_upcoming_events_rich = (args) => {
    const raw = toItems(args.value, 'events');
    const limit = Number(args.displayLimit ?? 5);
    return upcomingSorted(raw)
        .slice(0, limit)
        .map((event) => {
        const category = typeof event.category === 'string' ? event.category : '';
        const tone = stableCategoryTone(category);
        const cap = capacityInfo(event, tone);
        const loc = locationIconLabel(event);
        const tz = typeof event.timezone === 'string' && event.timezone ? event.timezone : undefined;
        return {
            id: String(event._id ?? ''),
            name: String(event.name ?? 'Untitled event'),
            subtitle: eventSubtitle(event),
            category_tone: tone,
            start_date_label: formatDate(event.startDate, tz),
            start_time_label: formatDayTime(event.startDate, tz),
            location_icon: loc.icon,
            location_label: loc.label,
            has_capacity: cap.has_capacity,
            capacity_label: cap.capacity_label,
            capacity_pct: cap.capacity_pct,
            capacity_tone: cap.capacity_tone,
        };
    });
};
/**
 * Companion to `flatten_upcoming_events_rich` — "Showing 5 of 20 upcoming"
 * counts for the tile footer. `total` is capped by however many upcoming
 * events actually came back (which is itself capped by the dataProvider's
 * own `pageSize`), not a live count of everything on Humanitix.
 *
 * Args: { value: raw list_events response, displayLimit?: number }
 */
const upcoming_events_counts = (args) => {
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
const next_upcoming_event_id = (args) => {
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
const next_upcoming_event_label = (args) => {
    const raw = toItems(args.value, 'events');
    const next = upcomingSorted(raw)[0];
    if (!next)
        return '';
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
const flatten_tickets = (args) => {
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
const elements = {
    slug: 'humanitix',
    functions: {
        flatten_upcoming_events_rich,
        upcoming_events_counts,
        next_upcoming_event_id,
        next_upcoming_event_label,
        flatten_tickets,
    },
};
export default elements;
