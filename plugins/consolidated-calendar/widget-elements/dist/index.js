const SOURCE_LABELS = {
    outlook: 'Outlook',
    google: 'Google',
    icloud: 'iCloud',
};
// Tones follow the system palette: each source gets a stable, distinct badge.
const SOURCE_TONES = {
    outlook: 'info',
    google: 'success',
    icloud: 'accent',
};
function str(value) {
    return value == null ? '' : String(value);
}
/** Accept an array, `{ items: [...] }`, or `{ value: [...] }` — else []. */
function toArray(value) {
    if (Array.isArray(value))
        return value;
    if (value && typeof value === 'object') {
        const obj = value;
        if (Array.isArray(obj['items']))
            return obj['items'];
        if (Array.isArray(obj['value']))
            return obj['value'];
    }
    return [];
}
function get(obj, key) {
    return obj && typeof obj === 'object' ? obj[key] : undefined;
}
const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;
const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;
/**
 * Best-effort epoch ms for sorting. Graph omits the offset but returns UTC by
 * default, so outlook date-times get a `Z` appended; iCloud TZID-local times
 * parse as viewer-local (close enough to order a day's agenda); bare dates
 * sort at local midnight so all-day events lead the day.
 */
function sortKey(start, source) {
    if (!start)
        return Number.MAX_SAFE_INTEGER;
    let iso = start;
    if (BARE_DATE.test(start))
        iso = `${start}T00:00:00`;
    else if (source === 'outlook' && !HAS_OFFSET.test(start))
        iso = `${start}Z`;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : Number.MAX_SAFE_INTEGER;
}
function fromOutlook(raw) {
    const start = str(get(raw['start'], 'dateTime'));
    return {
        id: `outlook:${str(raw['id'])}`,
        source: 'outlook',
        sourceLabel: SOURCE_LABELS.outlook,
        title: str(raw['subject']) || '(no title)',
        start,
        end: str(get(raw['end'], 'dateTime')),
        allDay: raw['isAllDay'] === true,
        location: str(get(raw['location'], 'displayName')),
        calendar: '',
        url: str(raw['webLink']),
        sortKey: sortKey(start, 'outlook'),
    };
}
function fromGoogle(raw) {
    const dateOnly = str(get(raw['start'], 'date'));
    const start = str(get(raw['start'], 'dateTime')) || dateOnly;
    return {
        id: `google:${str(raw['id'])}`,
        source: 'google',
        sourceLabel: SOURCE_LABELS.google,
        title: str(raw['summary']) || '(no title)',
        start,
        end: str(get(raw['end'], 'dateTime')) || str(get(raw['end'], 'date')),
        allDay: dateOnly !== '',
        location: str(raw['location']),
        calendar: '',
        url: str(raw['htmlLink']),
        sortKey: sortKey(start, 'google'),
    };
}
function fromICloud(raw) {
    const start = str(raw['start']);
    return {
        id: `icloud:${str(raw['uid']) || str(raw['url'])}`,
        source: 'icloud',
        sourceLabel: SOURCE_LABELS.icloud,
        title: str(raw['summary']) || '(no title)',
        start,
        end: str(raw['end']),
        allDay: raw['allDay'] === true,
        location: str(raw['location']),
        calendar: str(raw['calendarName']),
        url: str(raw['url']),
        sortKey: sortKey(start, 'icloud'),
    };
}
// ── merge_events ───────────────────────────────────────────────────────────
// Referenced in widget JSON as "consolidated-calendar_merge_events" — the slug
// prefix is added by the platform at load time.
//
// Args: { outlook?, google?, icloud?, limit? } — each the RAW payload of its
// connector's list tool (absent sources contribute nothing, so the tile works
// with any subset connected). Returns UnifiedEvent[] sorted by start.
const merge_events = (args) => {
    const events = [
        ...toArray(args['outlook']).map(fromOutlook),
        ...toArray(args['google'])
            .filter((e) => str(e['status']) !== 'cancelled')
            .map(fromGoogle),
        ...toArray(args['icloud']).map(fromICloud),
    ];
    events.sort((a, b) => a.sortKey - b.sortKey);
    const limit = typeof args['limit'] === 'number' && args['limit'] > 0 ? args['limit'] : 50;
    return events.slice(0, limit);
};
// ── source_label / source_tone ─────────────────────────────────────────────
// Map a UnifiedEvent `source` to its display name / badge tone.
const source_label = (args) => {
    const s = str(args['value']);
    return SOURCE_LABELS[s] ?? str(args['value']);
};
const source_tone = (args) => {
    const s = str(args['value']);
    return SOURCE_TONES[s] ?? 'default';
};
// ── count_events ───────────────────────────────────────────────────────────
// Count of events in a RAW connector payload (array or {items}/{value}
// wrapper) — lets the per-source stat tiles point at the raw state paths.
const count_events = (args) => toArray(args['value']).length;
const elements = {
    slug: 'consolidated-calendar',
    functions: {
        merge_events,
        source_label,
        source_tone,
        count_events,
    },
};
export default elements;
