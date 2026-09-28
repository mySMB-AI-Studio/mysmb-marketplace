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
// Fixed order for the search result's `object` field — shared by the
// per-row Badge tone and the content-type breakdown bar/legend so a given
// type always renders the exact same color in both places (same pattern as
// notion-projects.json's stage coloring; see that tile's widget-elements
// for the fuller rationale on why a shared absolute lookup, not a
// per-call positional one, matters here).
//
// Unlike Stage (a progression/status field, where TILE-DISPLAY-STANDARDS.md
// §7 restricts tone to a small restrained status vocabulary), `object` is a
// plain content-TYPE distinction with no severity/urgency meaning at all —
// squarely the "categorical (multi-color, non-status) breakdown" case §7
// explicitly sanctions `chart-1`..`chart-5` for, on the badge itself and
// not just a separate breakdown element. No standards deviation here.
const OBJECT_TYPE_ORDER = ['page', 'data_source'];
const OBJECT_TYPE_CHART_TONES = ['chart-1', 'chart-2'];
function objectTypeToneFor(raw) {
    const i = OBJECT_TYPE_ORDER.indexOf(raw.trim().toLowerCase());
    return i === -1 ? 'muted' : OBJECT_TYPE_CHART_TONES[i];
}
const notion_object_type_tone = (args) => objectTypeToneFor(String(args.value ?? ''));
/**
 * Groups `search` results by `object` type into a proportional segment set
 * for the Recent Notion Content tile's content-type breakdown bar — same
 * grid-`Row`-of-full-width-`ProgressBar`-segments technique as the Projects
 * tile's stage breakdown and ServiceM8's Job History status breakdown.
 * Tones come from the shared `objectTypeToneFor` lookup above, so a
 * segment's color always matches that type's row-badge color.
 *
 * Args: { results: array of { object } } — pass `/notion/search/results` directly.
 * Returns: { total, segments: [{ status, count, tone }], template }
 *
 * Spec example:
 *   {
 *     "$computed": "notion_content_type_breakdown",
 *     "args": { "results": { "$state": "/notion/search/results" } }
 *   }
 */
const notion_content_type_breakdown = (args) => {
    const results = Array.isArray(args.results) ? args.results : [];
    const counts = new Map();
    for (const r of results) {
        const raw = typeof r.object === 'string' && r.object ? r.object.toLowerCase() : 'unknown';
        counts.set(raw, (counts.get(raw) ?? 0) + 1);
    }
    const priority = (key) => {
        const i = OBJECT_TYPE_ORDER.indexOf(key);
        return i === -1 ? OBJECT_TYPE_ORDER.length : i;
    };
    const ordered = [...counts.entries()].sort((a, b) => priority(a[0]) - priority(b[0]));
    const segments = ordered.map(([key, count]) => ({
        status: NOTION_OBJECT_TYPE_LABELS[key] ?? (key.charAt(0).toUpperCase() + key.slice(1)),
        count,
        tone: objectTypeToneFor(key),
    }));
    return {
        total: results.length,
        segments,
        template: segments.length ? segments.map((s) => `${s.count}fr`).join(' ') : '1fr',
    };
};
// Fixed recency-bucket order + matching colors, most-recent-first, for the
// Recent Notion Pages tile's breakdown bar. That tile's `search` call is
// pinned to `object_type: "page"` — every result is the same content type,
// so (unlike Recent Notion Content's Page/Data Source split) there is no
// natural category to break down by. Bucketing by how recently each page
// was edited gives that tile the same "colorful breakdown bar" treatment
// while actually reflecting something real about page-only data.
const RECENCY_BUCKET_ORDER = ['Today', 'This Week', 'Older'];
const RECENCY_CHART_TONES = ['chart-1', 'chart-2', 'chart-3'];
const DAY_MS = 24 * 60 * 60 * 1000;
function recencyBucketFor(lastEditedTime, now) {
    const ms = Date.parse(lastEditedTime);
    if (Number.isNaN(ms))
        return 'Older';
    const ageMs = now - ms;
    if (ageMs < DAY_MS)
        return 'Today';
    if (ageMs < 7 * DAY_MS)
        return 'This Week';
    return 'Older';
}
// Shared by notion_recency_breakdown's segments and
// notion_page_recency_tone's per-row icon, same reasoning as
// stageToneFor/objectTypeToneFor above — one absolute lookup keyed by
// bucket NAME (not position in a given call's own filtered/sorted list)
// so a page's icon color always matches its bucket's segment color in
// the bar, regardless of which other buckets are present that call.
function recencyToneFor(bucket) {
    const i = RECENCY_BUCKET_ORDER.indexOf(bucket);
    return i === -1 ? 'muted' : RECENCY_CHART_TONES[i];
}
/**
 * Per-row icon tone for the Recent Notion Pages tile — colors each page's
 * leading icon by how recently it was edited, matching
 * notion_recency_breakdown's bar/legend colors for the same bucket.
 *
 * Args: { value } — the row's `last_edited_time` field.
 */
const notion_page_recency_tone = (args) => {
    const raw = typeof args.value === 'string' ? args.value : '';
    return raw ? recencyToneFor(recencyBucketFor(raw, Date.now())) : 'muted';
};
/**
 * Groups `search` results (page-only, per this tile's `object_type: "page"`
 * dataProvider filter) by how recently each was edited, into a proportional
 * segment set for a colored recency-breakdown bar — same
 * grid-`Row`-of-full-width-`ProgressBar`-segments technique as this
 * plugin's other two breakdown bars (Projects' stage breakdown, Recent
 * Notion Content's content-type breakdown).
 *
 * Defaults `now` to `Date.now()` (there's no system `$computed` for "current
 * timestamp" to bind from a widget spec) — an optional explicit `now` arg
 * exists purely so this can be called with a fixed timestamp directly
 * (tests, a REPL check), without needing to mock the system clock.
 *
 * Args: { results: array of { last_edited_time } }, optional { now: number }
 * Returns: { total, segments: [{ status, count, tone }], template }
 *
 * Spec example:
 *   {
 *     "$computed": "notion_recency_breakdown",
 *     "args": { "results": { "$state": "/notion/search/results" } }
 *   }
 */
const notion_recency_breakdown = (args) => {
    const results = Array.isArray(args.results) ? args.results : [];
    const now = typeof args.now === 'number' && Number.isFinite(args.now) ? args.now : Date.now();
    const counts = new Map();
    for (const r of results) {
        const raw = typeof r.last_edited_time === 'string' ? r.last_edited_time : '';
        const bucket = raw ? recencyBucketFor(raw, now) : 'Older';
        counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
    const priority = (key) => {
        const i = RECENCY_BUCKET_ORDER.indexOf(key);
        return i === -1 ? RECENCY_BUCKET_ORDER.length : i;
    };
    const ordered = [...counts.entries()].sort((a, b) => priority(a[0]) - priority(b[0]));
    const segments = ordered.map(([status, count]) => ({ status, count, tone: recencyToneFor(status) }));
    return {
        total: results.length,
        segments,
        template: segments.length ? segments.map((s) => `${s.count}fr`).join(' ') : '1fr',
    };
};
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/**
 * Formats a Notion date-property value ("YYYY-MM-DD", optionally with a time
 * component) to dd-Mmm-yy per TILE-DISPLAY-STANDARDS.md §1. Date-only (no
 * time-of-day) on purpose — Notion's `Timeline` property here is a plain date
 * range, not a datetime, and `Date.parse` on a bare "YYYY-MM-DD" string is
 * parsed as UTC midnight, which is fine for a calendar-date label.
 */
function formatNotionDate(raw) {
    const ms = Date.parse(raw);
    if (Number.isNaN(ms))
        return '—';
    const d = new Date(ms);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = MONTH_ABBR[d.getUTCMonth()];
    const year = String(d.getUTCFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
}
// Fixed left-to-right pipeline order for the 5-value "Stage" select this
// plugin's Projects tile was built and live-verified against — shared by
// both the per-row Badge tone (below) and the stage-breakdown bar/legend
// (`notion_project_stage_breakdown`, further down this file) so a given
// stage always renders the exact same color in both places. A workspace
// with different stage names falls in after these five, cycling through
// the remaining chart tones rather than crashing.
const STAGE_ORDER = ['Idea', 'Planning', 'In Progress', 'Complete', 'Archived'];
const CHART_TONES = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'];
/**
 * Tone for a Notion "Stage" select property's value.
 *
 * DELIBERATE DEVIATION from TILE-DISPLAY-STANDARDS.md §7's default
 * progression-field guidance (restrained info/success/muted palette,
 * explicitly "don't invent a tone per stage to make them look different
 * from each other") — recorded here per §7's own required process for
 * such a deviation. Originally built compliant with that default (Idea/
 * Planning/In Progress all `info`, Complete `success`, Archived `muted`).
 * Changed 2026-09-23 on the user's own explicit request, after seeing the
 * compliant version, to give each stage a distinct color instead — reusing
 * the SAME `chart-1`..`chart-5` categorical palette (and the SAME
 * `STAGE_ORDER` sequence) as the stage-breakdown bar, so a project's pill
 * color always matches its segment's color in that bar. A stage outside
 * the known 5 falls back to `muted` (a genuine "not one of the known
 * stages" case, not a status judgment).
 */
// Shared by notion_stage_tone (per-row Badge) and
// notion_project_stage_breakdown (the bar/legend) so a given stage always
// resolves to the exact same tone in both places, regardless of which
// OTHER stages happen to be present in a given workspace's data — an
// earlier version of the breakdown assigned tones by each stage's POSITION
// in that call's own filtered/sorted segment list, which drifted from this
// fixed absolute mapping whenever a workspace was missing one of the known
// stages (e.g. no "Complete" projects yet), silently mismatching the bar's
// color for a stage against that same stage's row-pill color.
function stageToneFor(stage) {
    const i = STAGE_ORDER.findIndex((s) => s.toLowerCase() === stage.trim().toLowerCase());
    return i === -1 ? 'muted' : CHART_TONES[i];
}
const notion_stage_tone = (args) => stageToneFor(String(args.value ?? ''));
/**
 * Flattens a `query_database` response's `results` array into display rows
 * for the Notion Projects tile. Live-verified 2026-09-17 against a real
 * connected workspace's "Projects" database — property shapes below
 * (`Name`/title, `Stage`/select, `Timeline`/date, `Lead`/people) are exactly
 * what that live response returned, not guessed from docs.
 *
 * A Notion database's property NAMES are whatever its author chose — there
 * is no API-level guarantee a workspace has a "Projects" database at all,
 * let alone one shaped this way. This tile is built for the common/standard
 * "Projects" template shape (Name/Stage/Timeline/Lead); a workspace using
 * different property names will render blank fields per-row (via the
 * defensive `??` fallbacks below) rather than fail to load — see this
 * plugin's README for how the tile resolves the database itself via
 * `search`.
 *
 * `Lead` is a `people` property — every sampled real row had it empty
 * (`"people": []`), so "Unassigned" is a live-confirmed real case; a
 * populated `people` array's per-person shape (full User objects with a
 * `name` field, not just an id) is per Notion's documented API contract,
 * not independently observed against a non-empty value in this environment.
 *
 * Row 0 carries footer_label: "N projects". No total/has_more count is
 * available from `query_database` the way some other connectors' list
 * tools provide one, so this only reports what actually loaded (capped at
 * the dataProvider's own page_size), not a "showing X of Y" claim this
 * tool can't back up.
 *
 * Args: { value: array } — the response's `results` array (each a Notion
 * "page" object representing one database row).
 */
const notion_flatten_projects = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    if (raw.length === 0)
        return [];
    const rows = raw.map((page) => {
        const id = String(page.id ?? '');
        const url = String(page.url ?? '');
        const properties = page.properties ?? {};
        const nameProp = properties.Name;
        const name = firstPlainText(nameProp?.title) ?? 'Untitled project';
        const stageProp = properties.Stage;
        const stageSelect = stageProp?.select;
        const stageLabel = typeof stageSelect?.name === 'string' ? stageSelect.name : 'No Stage';
        const stageTone = stageSelect?.name ? notion_stage_tone({ value: stageSelect.name }) : 'muted';
        const timelineProp = properties.Timeline;
        const timelineDate = timelineProp?.date;
        const start = typeof timelineDate?.start === 'string' ? timelineDate.start : null;
        const end = typeof timelineDate?.end === 'string' ? timelineDate.end : null;
        const timelineLabel = start
            ? end
                ? `${formatNotionDate(start)} – ${formatNotionDate(end)}`
                : formatNotionDate(start)
            : 'No timeline';
        const leadProp = properties.Lead;
        const leadPeople = Array.isArray(leadProp?.people) ? leadProp.people : [];
        const leadNames = leadPeople.map((p) => String(p.name ?? 'Unknown')).filter(Boolean);
        const leadLabel = leadNames.length === 0 ? 'Unassigned' : leadNames.join(', ');
        return {
            id,
            name,
            stage_label: stageLabel,
            stage_tone: stageTone,
            timeline_label: timelineLabel,
            lead_label: leadLabel,
            url,
            footer_label: '',
        };
    });
    const total = rows.length;
    rows[0].footer_label = `${total} project${total === 1 ? '' : 's'}`;
    return rows;
};
/**
 * Groups the Projects tile's already-flattened `/ui/rows` by `stage_label`
 * into a proportional segment set for a colored stage-breakdown bar — same
 * grid-`Row`-of-full-width-`ProgressBar`-segments technique as ServiceM8's
 * Job History tile's status breakdown (that tile's widget-elements has the
 * fuller writeup of why `template` is exact `fr`-unit ratios, not rounded
 * percentages).
 *
 * Uses the SAME `stageToneFor` lookup as the per-row Badge's
 * `notion_stage_tone` (both defined above, sharing `STAGE_ORDER`/
 * `CHART_TONES`) — originally this assigned tones by each stage's position
 * within this function's own filtered/sorted segment list, which drifted
 * from the row pills' colors whenever a workspace was missing one of the
 * known stages. The shared absolute lookup guarantees a project's row-pill
 * color always matches its segment's color in this bar, regardless of
 * which other stages are present. See `notion_stage_tone`'s own doc
 * comment for why this pill/bar coloring is a deliberate, user-requested
 * deviation from TILE-DISPLAY-STANDARDS.md §7's default restrained
 * status-tone guidance — §7 does separately, explicitly sanction
 * `chart-1`..`chart-5` for exactly this kind of categorical breakdown bar.
 *
 * Args: { rows: array of { stage_label } }
 * Returns: { total, segments: [{ status, count, tone }], template }
 *
 * Spec example:
 *   {
 *     "$computed": "notion_project_stage_breakdown",
 *     "args": { "rows": { "$state": "/ui/rows" } }
 *   }
 */
const notion_project_stage_breakdown = (args) => {
    const rows = Array.isArray(args.rows) ? args.rows : [];
    const counts = new Map();
    for (const row of rows) {
        const stage = typeof row.stage_label === 'string' && row.stage_label ? row.stage_label : 'No Stage';
        counts.set(stage, (counts.get(stage) ?? 0) + 1);
    }
    const stagePriority = (stage) => {
        const i = STAGE_ORDER.indexOf(stage);
        return i === -1 ? STAGE_ORDER.length : i;
    };
    const ordered = [...counts.entries()].sort((a, b) => stagePriority(a[0]) - stagePriority(b[0]));
    const segments = ordered.map(([status, count]) => ({ status, count, tone: stageToneFor(status) }));
    return {
        total: rows.length,
        segments,
        template: segments.length ? segments.map((s) => `${s.count}fr`).join(' ') : '1fr',
    };
};
// Object KEYS here must be bare (no "notion_" prefix) — the plugin loader
// (both this harness's and myHubV2's real one) auto-prepends `slug` to every
// key it finds here (`functions[`${slug}_${k}`] = fn`). The function
// VARIABLE names keep their "notion_" prefix per this file's own naming
// convention, but shorthand property syntax (`{ notion_flatten_projects }`)
// would use that same prefixed name as the object key too, double-prefixing
// the registered name to `notion_notion_flatten_projects` — which then
// never matches any widget's `"$computed": "notion_flatten_projects"`
// reference. Explicit `key: value` mappings avoid that trap.
const elements = {
    slug: 'notion',
    functions: {
        result_title: notion_result_title,
        object_type_label: notion_object_type_label,
        object_type_icon: notion_object_type_icon,
        flatten_projects: notion_flatten_projects,
        project_stage_breakdown: notion_project_stage_breakdown,
        object_type_tone: notion_object_type_tone,
        content_type_breakdown: notion_content_type_breakdown,
        recency_breakdown: notion_recency_breakdown,
        page_recency_tone: notion_page_recency_tone,
    },
};
export default elements;
