// Same categorical per-person coloring convention established for Trello's
// Team Workload / Recent Activity tiles: deterministic hash of the person's
// name into chart-1/2/3/5 (chart-4 excluded per earlier design feedback).
const CHART_TONES = ['chart-1', 'chart-2', 'chart-3', 'chart-5'];
function toneForName(name) {
    if (!name)
        return 'muted';
    let hash = 0;
    for (let i = 0; i < name.length; i++)
        hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return CHART_TONES[hash % CHART_TONES.length];
}
function initialFor(name) {
    const trimmed = name.trim();
    return trimmed ? trimmed[0].toUpperCase() : '?';
}
function formatTime12h(ms) {
    const d = new Date(ms);
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0)
        h = 12;
    return `${h}:${m} ${ampm}`;
}
/** Whole local-calendar-day difference between `ms` and now (0 = today, 1 = yesterday, etc.). */
function calendarDaysAgo(ms) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const that = new Date(ms);
    const thatDay = new Date(that.getFullYear(), that.getMonth(), that.getDate()).getTime();
    return Math.round((today - thatDay) / 86_400_000);
}
// Friendly labels for the meeting platforms actually observed — confirmed
// from live get_meetings data ("teams", "meet") and Read.ai's own API
// Reference example ("zoom"). Read.ai's docs don't enumerate a fixed set of
// platform values, so an unrecognized one falls back to a title-cased
// version of the raw string rather than being hidden — still genuinely
// useful at a glance, just not a hand-tuned label.
const PLATFORM_LABELS = {
    teams: 'Microsoft Teams',
    meet: 'Google Meet',
    zoom: 'Zoom',
};
function platformLabel(platform) {
    const key = String(platform ?? '').trim().toLowerCase();
    if (!key)
        return '';
    if (PLATFORM_LABELS[key])
        return PLATFORM_LABELS[key];
    return key.charAt(0).toUpperCase() + key.slice(1);
}
/**
 * "Today · 10:00 AM" / "Yesterday · 2:00 PM" / "2 days ago" — matches the
 * Recent Meetings tile's reference mockup exactly. Recent meetings (today/
 * yesterday) show a time, since that's genuinely useful at that distance;
 * older ones drop it in favor of a plain day count, since the exact time of
 * a meeting from several days ago is rarely what someone's scanning for.
 *
 * Appends the platform label (" · Microsoft Teams") when known, so where a
 * meeting was held is visible at a glance without a separate badge crowding
 * the row's already-tight trailing group (duration + view button). Omitted
 * entirely when the platform is unknown, rather than leaving a stray "· ".
 */
function formatMeetingSubtitle(startMs, platform) {
    const daysAgo = calendarDaysAgo(startMs);
    const dayPart = daysAgo === 0
        ? `Today · ${formatTime12h(startMs)}`
        : daysAgo === 1
            ? `Yesterday · ${formatTime12h(startMs)}`
            : daysAgo <= 0
                ? formatTime12h(startMs) // clock skew / same-day edge case — never show a negative count
                : `${daysAgo} days ago`;
    const platformPart = platformLabel(platform);
    return platformPart ? `${dayPart} · ${platformPart}` : dayPart;
}
/**
 * "32m" / "1h 5m" — Read.ai's API has no duration field (confirmed against
 * the live API Reference); it's always derived from end_time_ms - start_time_ms.
 * Returns null for a still-active meeting (end_time_ms not yet set), so the
 * widget can hide the duration badge entirely rather than show a bogus value.
 */
function formatDuration(startMs, endMs) {
    if (endMs == null)
        return null;
    const minutes = Math.round((endMs - startMs) / 60_000);
    if (minutes < 0)
        return null;
    if (minutes < 60)
        return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
/**
 * Flattens get_meetings' raw `data` array into display rows for the Recent
 * Meetings tile: a deterministic per-owner avatar color/initial, a day-
 * relative subtitle, and a derived duration label (Read.ai has no duration
 * field of its own).
 *
 * Args: { value: array } — list_meetings' raw `data` array.
 */
const flatten_meetings = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    return raw.map((meeting) => {
        const ownerName = String(meeting.owner?.name ?? '').trim();
        const startMs = Number(meeting.start_time_ms ?? 0);
        return {
            id: String(meeting.id ?? ''),
            title: String(meeting.title ?? 'Untitled meeting'),
            initials: initialFor(ownerName),
            avatar_tone: toneForName(ownerName),
            subtitle: startMs ? formatMeetingSubtitle(startMs, meeting.platform) : '',
            duration_label: formatDuration(startMs, meeting.end_time_ms),
            report_url: String(meeting.report_url ?? ''),
        };
    });
};
const elements = {
    slug: 'readai',
    functions: {
        flatten_meetings,
    },
};
export default elements;
