/**
 * Map a Salesforce Opportunity Probability (0–100) to a semantic tone.
 * >= 70 → "success", >= 40 → "accent", < 40 → "warning".
 *
 * Args: { value: number }
 *
 * Spec example:
 *   { "$computed": "salesforce_probability_tone", "args": { "value": { "$item": "Probability" } } }
 */
const probability_tone = (args) => {
    const v = Number(args.value ?? 0);
    if (v >= 70)
        return 'success';
    if (v >= 40)
        return 'accent';
    return 'warning';
};
/**
 * Map a Salesforce Account Type string to a semantic tone.
 * "Customer" → "success", "Partner" → "info", "Prospect" → "warning", else → "accent".
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "salesforce_account_type_tone", "args": { "value": { "$item": "Type" } } }
 */
const account_type_tone = (args) => {
    const v = String(args.value ?? '');
    if (v.includes('Customer'))
        return 'success';
    if (v.includes('Partner'))
        return 'info';
    if (v === 'Prospect')
        return 'warning';
    return 'accent';
};
/**
 * Express a record's numeric field value as a percentage of the maximum value
 * across all records. Useful for driving ProgressBar widths in a repeat list.
 *
 * Args: { value: number, items: array, field: string }
 *   value — the current item's raw count/amount
 *   items — the full records array (pass via $state path)
 *   field — the field name to read from each item when finding the max
 *
 * Spec example:
 *   { "$computed": "salesforce_pct_of_max", "args": { "value": { "$item": "cnt" }, "items": { "$state": "/salesforce/soql_query/records" }, "field": "cnt" } }
 */
const pct_of_max = (args) => {
    const value = Number(args.value ?? 0);
    const items = Array.isArray(args.items) ? args.items : [];
    const field = String(args.field ?? 'value');
    if (items.length === 0)
        return 0;
    const max = Math.max(...items.map((i) => Number(i[field] ?? 0)));
    if (max === 0)
        return 0;
    return Math.round((value / max) * 100);
};
/**
 * Compute the win rate as a whole-number percentage from an Opportunity records array.
 * win rate = won / closed * 100 (returns 0 if no closed opportunities).
 *
 * Args: { value: array }  — the full Opportunity records array
 *
 * Spec example:
 *   { "$computed": "salesforce_win_rate", "args": { "value": { "$state": "/salesforce/soql_query/records" } } }
 */
const win_rate = (args) => {
    const items = Array.isArray(args.value) ? args.value : [];
    const closed = items.filter((i) => i['IsClosed'] === true);
    if (closed.length === 0)
        return 0;
    const won = closed.filter((i) => i['IsWon'] === true);
    return Math.round((won.length / closed.length) * 100);
};
/**
 * Sort an array of records using a composite "Field|dir" key.
 * Decodes the key, compares numerically when both values are numbers, otherwise lexically.
 * Returns the original array unchanged if key is empty or items is empty.
 *
 * Args: { value: array, key: string }
 *   value — the records array to sort
 *   key   — composite sort key, e.g. "CloseDate|desc" or "Name|asc"
 *
 * Spec example:
 *   { "$computed": "salesforce_sort_by_key", "args": { "value": { "$state": "/salesforce/soql_query/records" }, "key": { "$state": "/ui/sortKey" } } }
 */
const sort_by_key = (args) => {
    const items = Array.isArray(args.value) ? args.value : [];
    const key = String(args.key ?? 'CloseDate|desc');
    const [field, dir] = key.split('|');
    if (!field || items.length === 0)
        return items;
    return [...items].sort((a, b) => {
        const av = a[field] ?? '';
        const bv = b[field] ?? '';
        const an = Number(av);
        const bn = Number(bv);
        const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av).localeCompare(String(bv));
        return dir === 'desc' ? -cmp : cmp;
    });
};
/**
 * Advance /ui/sortKey to the next option in the fixed 6-step cycle.
 * Used by the sort icon-button on.click action.
 *
 * Args: { current: string } — the current /ui/sortKey value
 *
 * Spec example:
 *   { "$computed": "salesforce_cycle_sort", "args": { "current": { "$state": "/ui/sortKey" } } }
 */
const cycle_sort = (args) => {
    const current = String(args.current ?? '');
    const options = ['Name|asc', 'Name|desc'];
    const idx = options.indexOf(current);
    return options[(idx + 1) % options.length];
};
const elements = {
    slug: 'salesforce',
    functions: { probability_tone, account_type_tone, pct_of_max, win_rate, sort_by_key, cycle_sort },
};
export default elements;
