/**
 * Example: title-case a string.
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "netsuite-harness_title_case", "args": { "value": { "$item": "name" } } }
 */
const title_case = (args) => {
    const s = String(args.value ?? '');
    return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
};
// Args: { value: number }
const format_days = (args) => {
    const n = parseInt(String(args.value ?? 0), 10);
    return Number.isFinite(n) ? `${n} day${n !== 1 ? 's' : ''}` : '';
};
// Args: { value: number } — formats 54.4 as "54.4%"
const format_percent = (args) => {
    const n = parseFloat(String(args.value ?? 0));
    return Number.isFinite(n) ? `${n}%` : '';
};
// Args: { value: number } — returns "success", "destructive", or "muted" based on sign
const profit_tone = (args) => {
    const n = parseFloat(String(args.value ?? 0));
    if (n > 0)
        return 'success';
    if (n < 0)
        return 'destructive';
    return 'muted';
};
const elements = {
    slug: 'netsuite',
    functions: {
        title_case,
        format_days,
        format_percent,
        profit_tone,
    },
};
export default elements;
