/**
 * Filter an array of records to those where a field's value contains the search string.
 * Case-insensitive: lowercases `search` before comparing, so works correctly against
 * pre-lowercased fields like `titleLower`. Returns all items when `search` is empty.
 *
 * Args: { value: array, field: string, search: string }
 *   value  — the records array to filter
 *   field  — field name to read from each record
 *   search — substring to find (case-insensitive)
 *
 * Spec example:
 *   { "$computed": "shopify-storefront_filter_contains", "args": { "value": { "$state": "/ui/sorted" }, "field": "titleLower", "search": { "$state": "/ui/search" } } }
 */
const filter_contains = (args) => {
    const items = Array.isArray(args.value) ? args.value : [];
    const field = String(args.field ?? '');
    const search = String(args.search ?? '').toLowerCase();
    if (!field || !search)
        return items;
    return items.filter((row) => String(row[field] ?? '').includes(search));
};
/**
 * Sort an array of product records using a composite "field|dir" key.
 * Compares numerically when both values parse as numbers (handles price strings like "89.99"),
 * otherwise falls back to locale-aware string comparison.
 * Returns the original array unchanged when key is empty or items is empty.
 *
 * Args: { value: array, key: string }
 *   value — the products array to sort
 *   key   — composite sort key, e.g. "title|asc", "price|desc", "totalInventory|asc"
 *
 * Spec example:
 *   { "$computed": "shopify-storefront_sort_by_key", "args": { "value": { "$state": "/shopify-ucp/search_catalog/products" }, "key": { "$state": "/ui/sortKey" } } }
 */
const sort_by_key = (args) => {
    const items = Array.isArray(args.value) ? args.value : [];
    const key = String(args.key ?? 'title|asc');
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
 * Toggle the sort direction for a given field.
 * If the current sort key targets a different field, returns "<field>|asc".
 * If the current key matches the field, toggles between asc and desc.
 * Used by per-column sort buttons to cycle through ascending/descending.
 *
 * Args: { current: string, field: string }
 *   current — the current /ui/sortKey value (e.g. "title|asc")
 *   field   — the column field being toggled (e.g. "title", "price", "vendor", "totalInventory")
 *
 * Spec example:
 *   { "$computed": "shopify-storefront_cycle_sort", "args": { "current": { "$state": "/ui/sortKey" }, "field": "title" } }
 */
const cycle_sort = (args) => {
    const current = String(args.current ?? '');
    const field = String(args.field ?? 'title');
    const [currentField, currentDir] = current.split('|');
    if (currentField !== field)
        return `${field}|asc`;
    return currentDir === 'asc' ? `${field}|desc` : `${field}|asc`;
};
const elements = {
    slug: 'shopify-storefront',
    functions: { filter_contains, sort_by_key, cycle_sort },
};
export default elements;
