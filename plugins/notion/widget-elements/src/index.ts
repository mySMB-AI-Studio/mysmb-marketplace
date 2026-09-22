import type { ComputedFunction, PluginElementsModule } from './types';

/**
 * Pulls a plain-text title out of Notion's `rich_text`-array title shape —
 * `[{ type: "text", text: {...}, plain_text: "..." }, ...]` — used both by a
 * data source's top-level `title` field and by a page property's own
 * `title` array. Returns null (not a placeholder) so callers can decide
 * their own fallback text.
 */
function firstPlainText(richText: unknown): string | null {
  if (!Array.isArray(richText)) return null;
  const first = richText[0] as Record<string, unknown> | undefined;
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
function titleFromPageProperties(properties: unknown): string | null {
  if (properties == null || typeof properties !== 'object') return null;
  for (const value of Object.values(properties as Record<string, unknown>)) {
    const prop = value as Record<string, unknown> | undefined;
    if (prop?.type === 'title') {
      const text = firstPlainText(prop.title);
      if (text) return text;
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
const notion_result_title: ComputedFunction = (args) => {
  const item = args.item as Record<string, unknown> | undefined;
  if (!item) return 'Untitled';

  if (item.object === 'data_source') {
    return firstPlainText(item.title) ?? 'Untitled data source';
  }

  // Default / "page" case. Also tried as a fallback for any future/unknown
  // object shape the search endpoint might start returning.
  return (
    titleFromPageProperties(item.properties) ??
    firstPlainText(item.title) ??
    'Untitled'
  );
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
const NOTION_OBJECT_TYPE_LABELS: Record<string, string> = {
  page: 'Page',
  data_source: 'Data Source',
};

const notion_object_type_label: ComputedFunction = (args) => {
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
const notion_object_type_icon: ComputedFunction = (args) => {
  const raw = String(args.value ?? '').toLowerCase();
  return raw === 'data_source' ? 'Database' : 'FileText';
};

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats a Notion date-property value ("YYYY-MM-DD", optionally with a time
 * component) to dd-Mmm-yy per TILE-DISPLAY-STANDARDS.md §1. Date-only (no
 * time-of-day) on purpose — Notion's `Timeline` property here is a plain date
 * range, not a datetime, and `Date.parse` on a bare "YYYY-MM-DD" string is
 * parsed as UTC midnight, which is fine for a calendar-date label.
 */
function formatNotionDate(raw: string): string {
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return '—';
  const d = new Date(ms);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = MONTH_ABBR[d.getUTCMonth()];
  const year = String(d.getUTCFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

/**
 * Title Case label + tone for a Notion "Stage" select property's value, per
 * TILE-DISPLAY-STANDARDS.md §7 (small restrained tone palette; progression
 * fields get `info` for every open/in-progress stage, not `muted`, reserving
 * `muted` for a genuine "nothing to report" case and `success` for the one
 * truly-done terminal stage).
 *
 * This maps the specific 5-value "Stage" select this plugin's Projects tile
 * was built and live-verified against (Idea / Planning / In Progress /
 * Complete / Archived) — a Notion "Projects" database is a user-authored
 * template, not an API-fixed enum, so a workspace with different stage
 * names will fall through to the `default` case below (Title Case label,
 * `muted` tone) rather than crash.
 *   Idea        -> info    (earliest open stage — actively "in the pipeline",
 *                            not a no-news default; see §7's own
 *                            appointmentscheduled/HubSpot correction)
 *   Planning    -> info    (open/in-progress)
 *   In Progress -> info    (open/in-progress)
 *   Complete    -> success (terminal, done)
 *   Archived    -> muted   (terminal, but a shelved/inactive project isn't
 *                            the same as an actively-cancelled one — no
 *                            urgency to surface, unlike a genuine failure)
 */
const NOTION_STAGE_TONES: Record<string, string> = {
  idea: 'info',
  planning: 'info',
  'in progress': 'info',
  complete: 'success',
  archived: 'muted',
};

const notion_stage_tone: ComputedFunction = (args) => {
  const raw = String(args.value ?? '').trim().toLowerCase();
  return NOTION_STAGE_TONES[raw] ?? 'muted';
};

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
const notion_flatten_projects: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  if (raw.length === 0) return [];

  const rows = raw.map((page) => {
    const id = String(page.id ?? '');
    const url = String(page.url ?? '');
    const properties = (page.properties as Record<string, unknown> | undefined) ?? {};

    const nameProp = properties.Name as Record<string, unknown> | undefined;
    const name = firstPlainText(nameProp?.title) ?? 'Untitled project';

    const stageProp = properties.Stage as Record<string, unknown> | undefined;
    const stageSelect = stageProp?.select as Record<string, unknown> | undefined;
    const stageLabel = typeof stageSelect?.name === 'string' ? stageSelect.name : 'No Stage';
    const stageTone = stageSelect?.name ? notion_stage_tone({ value: stageSelect.name }) : 'muted';

    const timelineProp = properties.Timeline as Record<string, unknown> | undefined;
    const timelineDate = timelineProp?.date as Record<string, unknown> | undefined;
    const start = typeof timelineDate?.start === 'string' ? timelineDate.start : null;
    const end = typeof timelineDate?.end === 'string' ? timelineDate.end : null;
    const timelineLabel = start
      ? end
        ? `${formatNotionDate(start)} – ${formatNotionDate(end)}`
        : formatNotionDate(start)
      : 'No timeline';

    const leadProp = properties.Lead as Record<string, unknown> | undefined;
    const leadPeople = Array.isArray(leadProp?.people) ? (leadProp.people as Record<string, unknown>[]) : [];
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

const elements: PluginElementsModule = {
  slug: 'notion',
  functions: {
    notion_result_title,
    notion_object_type_label,
    notion_object_type_icon,
    notion_flatten_projects,
  },
};

export default elements;
