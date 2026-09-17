/**
 * Pulls a plain-text title out of Notion's `rich_text`-array title shape —
 * `[{ type: "text", text: {...}, plain_text: "..." }, ...]` — used both by a
 * data source's top-level `title` field and by a page property's own
 * `title` array. Returns null (not a placeholder) so callers can decide
 * their own fallback text.
 */
function firstPlainText(richText) {
    if (!Array.isArray(richText))
        return null;
    const first = richText[0];
    const text = first?.plain_text;
    return typeof text === 'string' && text.length > 0 ? text : null;
}
/**
 * Finds a page's title by scanning its `properties` map for the entry whose
 * `type` is `"title"` — NOT by assuming the property is literally named
 * "title". Plain pages (and this server's own `search` results) commonly do
 * use the key "title", but a page that is a row in a database can have its
 * title property named anything the database schema chose (e.g. "Name",
 * "Task"). Scanning by `type` is correct for both cases; hardcoding the key
 * "title" would silently return nothing for a differently-named database row.
 */
function titleFromPageProperties(properties) {
    if (properties == null || typeof properties !== 'object')
        return null;
    for (const value of Object.values(properties)) {
        const prop = value;
        if (prop?.type === 'title') {
            const text = firstPlainText(prop.title);
            if (text)
                return text;
        }
    }
    return null;
}
/**
 * Extracts a display title from a `search` result item, which — per Notion's
 * 2025-09-03+ data model (this server's `get_database`/`get_data_source`
 * split; see myhub-mcp-servers/src/integrations/notion/servers/notion.ts) —
 * can be EITHER a page object or a data_source object, each with a different
 * title shape:
 *   - page:        title lives in `properties.<key>.title` where that
 *                   property's `type` is "title" (key name varies).
 *   - data_source: title is a top-level `title` rich-text array directly on
 *                   the object (no `properties` involved).
 * `search`'s `object_type` filter values are "page" / "data_source" — NOT
 * "database" — for the same reason; see this plugin's README and the
 * server's own SEARCH_OBJECT_TYPE comment.
 *
 * Used directly (this plugin has no `notion-search-results`-specific
 * fallback) rather than the old raw `$item: "properties/title/title/0/..."`
 * path, which only ever worked for the page case.
 *
 * Args: { item } — a `search` result row (e.g. `{ "$item": "" }`).
 * Returns: string — never empty; falls back to a shape-aware placeholder.
 */
const notion_result_title = (args) => {
    const item = args.item;
    if (!item)
        return 'Untitled';
    if (item.object === 'data_source') {
        return firstPlainText(item.title) ?? 'Untitled data source';
    }
    // Default / "page" case. Also tried as a fallback for any future/unknown
    // object shape the search endpoint might start returning.
    return (titleFromPageProperties(item.properties) ??
        firstPlainText(item.title) ??
        'Untitled');
};
/**
 * Title Case label for a Notion `search` result's `object` field, per
 * TILE-DISPLAY-STANDARDS.md §3 (never show a raw connector enum in a badge).
 * Values per the MCP server's SEARCH_OBJECT_TYPE enum
 * (myhub-mcp-servers/src/integrations/notion/servers/notion.ts): "page" |
 * "data_source" — a data_source is the modern replacement for what the
 * Notion UI still calls a "database", so it's labeled "Data Source" (matching
 * the API's own vocabulary) rather than "Database", which would misdescribe
 * what get_database/get_data_source actually return.
 */
const NOTION_OBJECT_TYPE_LABELS = {
    page: 'Page',
    data_source: 'Data Source',
};
const notion_object_type_label = (args) => {
    const raw = String(args.value ?? '').toLowerCase();
    return NOTION_OBJECT_TYPE_LABELS[raw] ?? (raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Unknown');
};
/**
 * Decorative (non-status) leading icon for a Notion `search` result row,
 * matched to its `object` type so a data source result doesn't display the
 * same file icon as a page result. Not a toned badge — per
 * TILE-DISPLAY-STANDARDS.md §7 this isn't state that changes urgency, just a
 * type distinction, so it's a plain Lucide icon name, not a Badge tone.
 *
 * Args: { value } — the row's `object` field (e.g. `{ "$item": "object" }`).
 */
const notion_object_type_icon = (args) => {
    const raw = String(args.value ?? '').toLowerCase();
    return raw === 'data_source' ? 'Database' : 'FileText';
};
const elements = {
    slug: 'notion',
    functions: {
        notion_result_title,
        notion_object_type_label,
        notion_object_type_icon,
    },
};
export default elements;
