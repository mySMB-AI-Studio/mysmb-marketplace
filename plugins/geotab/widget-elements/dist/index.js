/**
 * Fuel efficiency (L/100km) is a real cost signal, so it escalates through
 * the standard severity ladder. "success" is deliberately never used here —
 * TILE-DISPLAY-STANDARDS.md §7 reserves it for done/paid/completed states,
 * not "efficient right now" — muted is the correct tone for a normal reading.
 * Args: { value: number }
 */
const efficiency_tone = (args) => {
    const n = parseFloat(String(args.value ?? 0));
    if (n >= 15)
        return 'destructive';
    if (n >= 11.5)
        return 'warning';
    return 'muted';
};
/**
 * On-site productive ratio is informational, not a severity signal — the
 * source data explicitly frames a lower ratio as "a routing question, not a
 * performance one". `warning`/`destructive` would misrepresent that, so this
 * only ever returns `muted` (normal) or `info` (worth a look), never an
 * alarming tone.
 * Args: { value: number } — a percentage, e.g. 68
 */
const productivity_tone = (args) => {
    const n = parseFloat(String(args.value ?? 0));
    return n < 70 ? 'info' : 'muted';
};
/**
 * Flags a vehicle whose private-km reading is high enough to be worth a
 * second look (e.g. against a tool-of-trade FBT exemption), without
 * classifying every vehicle as some tone.
 * Args: { value: number } — km
 */
const private_km_tone = (args) => {
    const n = parseFloat(String(args.value ?? 0));
    return n >= 150 ? 'warning' : 'muted';
};
/**
 * A geofence position that hasn't resolved to a known/mapped location is a
 * real data-quality gap worth flagging; a normal client-site or depot dwell
 * is not.
 * Args: { label: string }
 */
const geofence_status_tone = (args) => {
    const label = String(args.label ?? '');
    return label.startsWith('Unmapped') ? 'warning' : 'muted';
};
/**
 * Formats a duration given in minutes as "4h 10m" (or "54m" under an hour).
 * No system equivalent exists yet (checked widget-elements-system catalog) —
 * plugin-local until a second connector needs the same formatting.
 * Args: { minutes: number }
 */
const format_duration_hm = (args) => {
    const total = Math.max(0, Math.round(Number(args.minutes ?? 0)));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0)
        return `${m}m`;
    return `${h}h ${m}m`;
};
const elements = {
    slug: 'geotab',
    functions: {
        efficiency_tone,
        productivity_tone,
        private_km_tone,
        geofence_status_tone,
        format_duration_hm,
    },
};
export default elements;
