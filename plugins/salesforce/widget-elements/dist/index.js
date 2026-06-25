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
const elements = {
    slug: 'salesforce',
    functions: { probability_tone, account_type_tone, pct_of_max, win_rate },
};
export default elements;
