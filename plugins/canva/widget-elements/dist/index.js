/**
 * Format a Canva design's `created_at`/`updated_at` as a short relative
 * string ("4m ago", "1h ago", "Yesterday", "3d ago", "2w ago"). Canva's
 * Connect API documents these fields as Unix timestamps in SECONDS
 * (canva.dev/docs/connect/api-reference/designs/get-design, fetched
 * 2026-09-09) — every relative-time helper in the system baseline expects
 * milliseconds, so passing a raw Canva timestamp to the system's own
 * `relative_time` would silently render a wildly wrong value (interpreted
 * as 1970-something). This exists specifically to do the seconds→ms
 * conversion before formatting.
 *
 * Args: { value: number }
 *
 * Spec example:
 *   { "$computed": "canva_relative_time", "args": { "value": { "$item": "updated_at" } } }
 */
const relative_time = (args) => {
    const raw = args.value;
    if (typeof raw !== 'number' || !Number.isFinite(raw))
        return '';
    const ms = raw * 1000;
    const diffMs = Date.now() - ms;
    const minute = 60_000;
    const hour = 3_600_000;
    const day = 86_400_000;
    if (diffMs < minute)
        return 'just now';
    if (diffMs < hour)
        return `${Math.floor(diffMs / minute)}m ago`;
    if (diffMs < day)
        return `${Math.floor(diffMs / hour)}h ago`;
    const days = Math.floor(diffMs / day);
    if (days === 1)
        return 'Yesterday';
    if (days < 7)
        return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
};
/**
 * Turn a Canva design's `design_types` array into a human-readable Title
 * Case label (e.g. ["social-media-post"] → "Social Media Post"). Canva's
 * Connect API documents `design_types` as free-form strings, not a fixed
 * enum this repo has verified — so this is a generic hyphen/underscore
 * humanizer rather than a hardcoded lookup table, safe regardless of the
 * exact values Canva actually returns. Falls back to "Design" when the
 * array is empty or absent, rather than a blank subtitle.
 *
 * Args: { value: string[] }
 *
 * Spec example:
 *   { "$computed": "canva_design_type_label", "args": { "value": { "$item": "design_types" } } }
 */
const design_type_label = (args) => {
    const arr = args.value;
    const first = Array.isArray(arr) ? arr[0] : undefined;
    if (typeof first !== 'string' || first.length === 0)
        return 'Design';
    return first
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};
const elements = {
    slug: 'canva',
    functions: {
        relative_time,
        design_type_label,
    },
};
export default elements;
