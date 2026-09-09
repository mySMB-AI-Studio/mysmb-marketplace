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
function resolveItemObject(item) {
    const type = item?.type;
    if (!type)
        return undefined;
    return item[type];
}
const FOLDER_ITEM_ICONS = {
    design: 'FileText',
    folder: 'Folder',
    image: 'Image',
    brand_template: 'LayoutTemplate',
};
/**
 * Args: { item } — a `list_folder_items` row (e.g. `{ "$item": "" }`).
 *
 * Spec example:
 *   { "$computed": "canva_folder_item_icon", "args": { "item": { "$item": "" } } }
 */
const folder_item_icon = (args) => {
    const type = args.item?.type;
    return FOLDER_ITEM_ICONS[type ?? ''] ?? 'File';
};
const FOLDER_ITEM_TYPE_LABELS = {
    design: 'Design',
    folder: 'Folder',
    image: 'Image',
    brand_template: 'Brand Template',
};
/**
 * Args: { item } — a `list_folder_items` row.
 *
 * Spec example:
 *   { "$computed": "canva_folder_item_type_label", "args": { "item": { "$item": "" } } }
 */
const folder_item_type_label = (args) => {
    const type = args.item?.type;
    return FOLDER_ITEM_TYPE_LABELS[type ?? ''] ?? 'Item';
};
/**
 * Display name for a folder item — `title` (designs, and a best-effort try
 * on image/brand_template) or `name` (folders, and the same best-effort try
 * on image/brand_template). Falls back to "Untitled" rather than a blank
 * row, matching this repo's established "no blank label" convention.
 *
 * Args: { item } — a `list_folder_items` row.
 *
 * Spec example:
 *   { "$computed": "canva_folder_item_name", "args": { "item": { "$item": "" } } }
 */
const folder_item_name = (args) => {
    const obj = resolveItemObject(args.item);
    const title = typeof obj?.title === 'string' ? obj.title : undefined;
    const name = typeof obj?.name === 'string' ? obj.name : undefined;
    return title || name || 'Untitled';
};
/**
 * Args: { item } — a `list_folder_items` row.
 *
 * Spec example:
 *   { "$computed": "canva_folder_item_updated_at", "args": { "item": { "$item": "" } } }
 */
const folder_item_updated_at = (args) => {
    const obj = resolveItemObject(args.item);
    const raw = obj?.updated_at;
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
};
/**
 * Click-through URL for a folder-item row. ONLY design items get a real
 * one — Canva's own `urls.view_url`/`edit_url`, returned directly on the
 * design object. Folders, images, and brand templates get '' (a safe
 * no-op click, same pattern as this connector's other "no real link"
 * cases) because `get_folder` was checked LIVE (2026-09-09) and returns no
 * URL field at all (`{ id, name, created_at, updated_at }` only, confirmed
 * against a real account's real 'root' and 'uploads' folders) — there is
 * no per-folder web URL to deep-link to. Images/brand templates were never
 * checked live (no examples in that account) but are assumed to have the
 * same gap rather than guessed at.
 *
 * Args: { item } — a `list_folder_items` row.
 *
 * Spec example:
 *   { "$computed": "canva_folder_item_open_url", "args": { "item": { "$item": "" } } }
 */
const folder_item_open_url = (args) => {
    const item = args.item;
    if (item?.type !== 'design')
        return '';
    return item.design?.urls?.view_url ?? item.design?.urls?.edit_url ?? '';
};
/**
 * All Projects tile's category tabs, matching Canva's own Projects sidebar:
 * Recent / Folders / Design.
 *
 * BUG FOUND AND FIXED (2026-09-09, caught by the user comparing this tile
 * side-by-side against a real canva.com/projects screenshot): the original
 * version of this function returned the ENTIRE unfiltered root listing for
 * 'recent', including folder-type items. Confirmed wrong against a real
 * screenshot of Canva's own "Recents" section, which lists only designs and
 * never a folder — Canva's Recents is a list of recently-touched CONTENT,
 * not containers. Fixed: 'recent' now excludes `type === 'folder'`
 * explicitly, confirmed live to match Canva's real Recents exactly.
 *
 * REMAINING DISCLOSED APPROXIMATION: this tile has exactly one dataProvider
 * call (`list_folder_items`, `folder_id: "root"`, all 4 item types) -- it
 * cannot also fire the separate, site-wide `list_designs` call that Canva's
 * OWN "Recent" tab is actually built from (everything recently touched
 * across the WHOLE account, not folder-scoped). "Recent" here is the root
 * folder's own designs/images/brand templates, already `modified_descending`
 * sorted, minus folders -- close, but not literally cross-folder the way
 * Canva's real Recent view is. "Folders" and "Design" ARE exact, live,
 * zero-extra-call matches -- both are plain client-side filters over data
 * already in state, no different from Content Pipeline's own
 * priority/created sort toggle.
 *
 * Args: { items: unknown[], tab: string } -- `tab` one of
 * 'recent' | 'folders' | 'design'.
 *
 * Spec example:
 *   { "$computed": "canva_filter_items_by_tab", "args": { "items": { "$state": "/canva/list_folder_items/items" }, "tab": { "$state": "/ui/activeTab" } } }
 */
const filter_items_by_tab = (args) => {
    const items = Array.isArray(args.items) ? args.items : [];
    const tab = String(args.tab ?? 'recent');
    if (tab === 'folders')
        return items.filter((i) => i?.type === 'folder');
    if (tab === 'design')
        return items.filter((i) => i?.type === 'design');
    // 'recent' — same root listing, but excluding folders (containers aren't "recent content")
    return items.filter((i) => i?.type !== 'folder');
};
/**
 * Category bar chart above the tabs, matching Content Pipeline's own
 * bucket-bar visual pattern (label + count row, then a ProgressBar below)
 * -- one bar per tab: Recent / Folders / Design. Always computed from the
 * FULL raw item list (not whichever tab is currently active), so all three
 * counts stay visible together regardless of which tab the viewer has
 * selected. Reuses `filter_items_by_tab`'s exact category logic rather than
 * duplicating it, so the bar counts and the tab's own row counts can never
 * drift apart.
 *
 * Args: { items: unknown[], tab: string } -- `tab` one of
 * 'recent' | 'folders' | 'design'.
 *
 * Spec example:
 *   { "$computed": "canva_category_count", "args": { "items": { "$state": "/canva/list_folder_items/items" }, "tab": "folders" } }
 */
const category_count = (args) => {
    return filter_items_by_tab(args).length;
};
const CATEGORY_TABS = ['recent', 'folders', 'design'];
/**
 * Bar-fill percentage for one category, scaled to the LARGEST of the three
 * counts (not their sum) -- same scaling choice as Content Pipeline's
 * `canva_stage_pct`, for the same reason: relative proportions stay
 * readable even when one category dominates.
 *
 * Args: { items: unknown[], tab: string } -- same shape as `category_count`.
 *
 * Spec example:
 *   { "$computed": "canva_category_pct", "args": { "items": { "$state": "..." }, "tab": "design" } }
 */
const category_pct = (args) => {
    const items = Array.isArray(args.items) ? args.items : [];
    const counts = CATEGORY_TABS.map((tab) => filter_items_by_tab({ items, tab }).length);
    const max = Math.max(...counts, 0);
    if (max === 0)
        return 0;
    const thisCount = filter_items_by_tab(args).length;
    return Math.round((thisCount / max) * 100);
};
/**
 * Button variant for one of the three tab buttons -- 'secondary' (filled,
 * visually "selected") when it's the active tab, 'ghost' (plain) otherwise.
 * Only these two real `Button` variant values are used here deliberately;
 * 'primary' is reserved for the footer's single "Open in Canva" CTA so the
 * two don't visually compete for the same "most prominent action" read.
 *
 * Args: { active: string, tab: string } -- `active` is `/ui/activeTab`,
 * `tab` is this button's own tab id.
 *
 * Spec example:
 *   { "$computed": "canva_tab_button_variant", "args": { "active": { "$state": "/ui/activeTab" }, "tab": "folders" } }
 */
const tab_button_variant = (args) => {
    return String(args.active) === String(args.tab) ? 'secondary' : 'ghost';
};
const TAB_EMPTY_MESSAGES = {
    recent: 'This folder is empty.',
    folders: 'No folders here.',
    design: 'No designs here.',
};
/**
 * Args: { tab: string } -- `/ui/activeTab`.
 *
 * Spec example:
 *   { "$computed": "canva_tab_empty_message", "args": { "tab": { "$state": "/ui/activeTab" } } }
 */
const tab_empty_message = (args) => {
    return TAB_EMPTY_MESSAGES[String(args.tab ?? '')] ?? 'Nothing here.';
};
const elements = {
    slug: 'canva',
    functions: {
        relative_time,
        design_type_label,
        folder_item_icon,
        folder_item_type_label,
        folder_item_name,
        folder_item_updated_at,
        folder_item_open_url,
        filter_items_by_tab,
        category_count,
        category_pct,
        tab_button_variant,
        tab_empty_message,
    },
};
export default elements;
