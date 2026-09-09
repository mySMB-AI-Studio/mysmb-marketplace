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
/**
 * Stage thresholds, all deliberate, disclosed guesses (there is no ground
 * truth to confirm them against — see the comment above):
 *
 *  - DRAFT_MAX_EDIT_SPAN_S: a design whose `updated_at` is within one hour
 *    of its `created_at` has no real edit history yet — still a draft,
 *    checked FIRST so a draft that was abandoned long ago (never touched
 *    again after that first hour) stays "Draft" rather than falling through
 *    to "Posted" just because it's old.
 *  - POSTED_STALE_DAYS: 14+ days since the last edit, once past the draft
 *    check above, is treated as "done and live" — nothing left in a content
 *    workflow sits untouched that long while still in flight.
 *  - IN_REVIEW_RECENT_DAYS: edited within the last 2 days (and past the
 *    draft check) reads as actively being worked on right now.
 *  - Anything in between (real edit history, last touched 2-14 days ago)
 *    reads as "Ready to Post" — edited, then gone quiet, presumably queued.
 */
const DRAFT_MAX_EDIT_SPAN_S = 60 * 60; // 1 hour
const POSTED_STALE_DAYS = 14;
const IN_REVIEW_RECENT_DAYS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
function classifyStage(design) {
    const createdAt = Number(design?.created_at);
    const updatedAt = Number(design?.updated_at);
    if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt))
        return 'draft';
    const editSpanS = updatedAt - createdAt;
    if (editSpanS <= DRAFT_MAX_EDIT_SPAN_S)
        return 'draft';
    const daysSinceUpdate = (Date.now() - updatedAt * 1000) / DAY_MS;
    if (daysSinceUpdate >= POSTED_STALE_DAYS)
        return 'posted';
    if (daysSinceUpdate <= IN_REVIEW_RECENT_DAYS)
        return 'in_review';
    return 'ready';
}
/**
 * Args: { design } — a design object (e.g. `{ "$item": "design" }` on a
 * `list_folder_items` row of type "design").
 *
 * Spec example:
 *   { "$computed": "canva_pipeline_stage", "args": { "design": { "$item": "design" } } }
 */
const pipeline_stage = (args) => classifyStage(args.design);
const STAGE_LABELS = {
    draft: 'Draft',
    in_review: 'In Review',
    ready: 'Ready To Post',
    posted: 'Posted',
};
/**
 * Title Case label for a stage key, per TILE-DISPLAY-STANDARDS.md §3 (every
 * status must go through a label-normalizing helper, never a raw enum).
 *
 * Args: { value } — one of 'draft' | 'in_review' | 'ready' | 'posted'.
 *
 * Spec example:
 *   { "$computed": "canva_pipeline_stage_label", "args": { "value": { "$computed": "canva_pipeline_stage", "args": { "design": { "$item": "design" } } } } }
 */
const pipeline_stage_label = (args) => {
    const key = String(args.value ?? '');
    return STAGE_LABELS[key] ?? 'Draft';
};
/**
 * Tone for a stage badge. Per TILE-DISPLAY-STANDARDS.md §7's progression-
 * field rule: every open/in-flight stage of a progression gets `info`, not
 * `muted` (muted means "nothing to report", not "early") — `success` is
 * reserved for the one genuinely terminal stage. Deliberately does NOT give
 * Draft/In Review/Ready to Post three different tones: the badge's own text
 * already carries stage identity, tone only carries urgency-tier (same
 * restraint principle this doc applies to HubSpot's deal-stage badges), and
 * nothing about a content design being in Draft vs. In Review is more
 * "urgent" than the other — there's no SLA/deadline concept here to
 * escalate against.
 *
 * Args: { value } — one of 'draft' | 'in_review' | 'ready' | 'posted'.
 *
 * Spec example:
 *   { "$computed": "canva_pipeline_stage_tone", "args": { "value": { ... } } }
 */
const pipeline_stage_tone = (args) => {
    return String(args.value) === 'posted' ? 'success' : 'info';
};
function isDesignItem(item) {
    return (!!item &&
        typeof item === 'object' &&
        item.type === 'design' &&
        !!item.design);
}
/**
 * Count of `list_folder_items` items classified into one pipeline stage.
 * Defensive about `type !== "design"` even though this tile's own
 * dataProvider already requests `item_types: ["design"]` server-side —
 * matches this connector's existing defensive-filter style elsewhere.
 *
 * Args: { items, stage } — `items` is the folder-items array, `stage` one
 * of 'draft' | 'in_review' | 'ready' | 'posted'.
 *
 * Spec example:
 *   { "$computed": "canva_stage_count", "args": { "items": { "$state": "/canva/list_folder_items/items" }, "stage": "draft" } }
 */
const stage_count = (args) => {
    const items = Array.isArray(args.items) ? args.items : [];
    const stage = String(args.stage ?? '');
    return items.filter(isDesignItem).filter((item) => classifyStage(item.design) === stage).length;
};
/**
 * Bar-fill percentage for one stage, scaled to the LARGEST bucket (not to
 * the total) so the bar chart's relative proportions stay readable even
 * when one stage dominates — a 3-item bucket next to a 9-item one should
 * read as "roughly a third as much", not as a near-empty sliver against the
 * grand total.
 *
 * Args: { items, stage } — same shape as `canva_stage_count`.
 *
 * Spec example:
 *   { "$computed": "canva_stage_pct", "args": { "items": { "$state": "..." }, "stage": "posted" } }
 */
const STAGES = ['draft', 'in_review', 'ready', 'posted'];
const stage_pct = (args) => {
    const items = Array.isArray(args.items) ? args.items : [];
    const stage = String(args.stage ?? '');
    const designs = items.filter(isDesignItem);
    const counts = STAGES.map((s) => designs.filter((item) => classifyStage(item.design) === s).length);
    const max = Math.max(...counts, 0);
    if (max === 0)
        return 0;
    const thisCount = designs.filter((item) => classifyStage(item.design) === stage).length;
    return Math.round((thisCount / max) * 100);
};
/**
 * Total design count in the response — used for the header's "N designs"
 * badge. Excludes any non-design item defensively (see `isDesignItem`).
 *
 * Args: { items } — the folder-items array.
 *
 * Spec example:
 *   { "$computed": "canva_active_design_count", "args": { "items": { "$state": "..." } } }
 */
const active_design_count = (args) => {
    const items = Array.isArray(args.items) ? args.items : [];
    return items.filter(isDesignItem).length;
};
/**
 * Thumbnail preview dimensions, read from `design.thumbnail.width`/`height`.
 *
 * CONFIRMED LIVE (2026-09-09, via the tile harness against a real connected
 * account): these are NOT the design's true canvas size — `thumbnail` is a
 * downscaled preview raster. A live `list_designs` call returned e.g.
 * `{ "width": 596, "height": 335 }` for a design, neither of which is a
 * round/real canvas preset size, confirming Canva scales this raster rather
 * than returning it 1:1. Displayed as-is anyway (labeled honestly as a
 * dimension reading, not claimed to be the exact canvas size) since it's
 * the only size signal this connector's read-only tools expose at all —
 * `get_design_pages` has real per-page dimensions but is a second, per-
 * design call this passive tile's single dataProvider fetch can't make.
 *
 * Args: { design } — a design object.
 *
 * Spec example:
 *   { "$computed": "canva_design_dimensions", "args": { "design": { "$item": "design" } } }
 */
const design_dimensions = (args) => {
    const design = args.design;
    const w = design?.thumbnail?.width;
    const h = design?.thumbnail?.height;
    if (!Number.isFinite(w) || !Number.isFinite(h))
        return null;
    return `${w}×${h}`; // × — matches the Content Pipeline mockup's "1080×1080" formatting
};
/**
 * Best-effort content-category tag, inferred from keywords in the design's
 * own `title` — Canva designs have no real tag field (only image/video
 * assets do, via a separate per-ID `get_asset` call this passive tile
 * doesn't make; see the file-level comment above). Ordered, first match
 * wins; returns null (no tag chip shown) rather than guessing when nothing
 * matches, per this connector's established "exclude, don't guess" policy
 * (e.g. `atlassian_sla_tone`'s handling of a request with no SLA clock).
 *
 * Args: { design } — a design object.
 *
 * Spec example:
 *   { "$computed": "canva_infer_content_tag", "args": { "design": { "$item": "design" } } }
 */
const TAG_KEYWORDS = [
    { tag: 'social', keywords: ['instagram', 'facebook', 'tiktok', 'linkedin', 'twitter', 'social', 'story', 'stories', 'reel'] },
    { tag: 'email', keywords: ['email', 'newsletter', 'edm'] },
    { tag: 'print', keywords: ['flyer', 'poster', 'brochure', 'postcard', 'print'] },
    { tag: 'video', keywords: ['video', 'youtube'] },
];
const infer_content_tag = (args) => {
    const design = args.design;
    const title = typeof design?.title === 'string' ? design.title.toLowerCase() : '';
    if (!title)
        return null;
    for (const { tag, keywords } of TAG_KEYWORDS) {
        if (keywords.some((k) => title.includes(k)))
            return tag;
    }
    return null;
};
/**
 * Combined row subtitle: "{dimensions} · tagged \"{tag}\"", gracefully
 * collapsing when either half is missing (e.g. no title keyword matched, so
 * there's nothing honest to tag) rather than rendering a dangling "·".
 *
 * Args: { design } — a design object.
 *
 * Spec example:
 *   { "$computed": "canva_design_subtitle", "args": { "design": { "$item": "design" } } }
 */
const design_subtitle = (args) => {
    const design = args.design;
    const dims = design_dimensions({ design });
    const tag = infer_content_tag({ design });
    const tagPhrase = tag ? `tagged "${tag}"` : null;
    return [dims, tagPhrase].filter(Boolean).join(' · '); // ·
};
/**
 * Click-through URL for a design row — Canva's own `urls.view_url` (falls
 * back to `edit_url`), both real, tenant-agnostic links Canva returns
 * directly on the design object. Returns '' (a safe no-op click) only in
 * the unexpected case neither URL is present.
 *
 * Args: { design } — a design object.
 *
 * Spec example:
 *   { "$computed": "canva_design_open_url", "args": { "design": { "$item": "design" } } }
 */
const design_open_url = (args) => {
    const design = args.design;
    return design?.urls?.view_url ?? design?.urls?.edit_url ?? '';
};
/**
 * Format a Canva design's `page_count` as "1 page" / "N pages", correctly
 * pluralized. Fills the trailing-badge slot a reference mockup expected to
 * show a publish/share status — which `list_designs` has no field for —
 * with a real field instead of a fabricated one. Falls back to "1 page"
 * when the value is missing, since every Canva design has at least one page.
 *
 * Args: { value: number }
 *
 * Spec example:
 *   { "$computed": "canva_page_count_label", "args": { "value": { "$item": "page_count" } } }
 */
const page_count_label = (args) => {
    const raw = args.value;
    const count = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 1;
    return `${count} page${count === 1 ? '' : 's'}`;
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
        pipeline_stage,
        pipeline_stage_label,
        pipeline_stage_tone,
        stage_count,
        stage_pct,
        active_design_count,
        design_dimensions,
        infer_content_tag,
        design_subtitle,
        design_open_url,
        page_count_label,
    },
};
export default elements;
