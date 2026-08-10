import type { ComputedFunction, PluginElementsModule } from './types';

/**
 * Map a HubSpot ticket's `hs_ticket_priority` value to a semantic badge tone.
 * Follows TILE-DISPLAY-STANDARDS.md §6's reference model (WorkQ's
 * todo_priority_tone): destructive for the most severe/urgent, warning for
 * elevated, muted for normal/default — deliberately NOT `success` for LOW,
 * even though HubSpot's own dashboard shows a green dot there. `success`
 * means done/paid/completed platform-wide; "low priority" is neither, and
 * borrowing it here would misleadingly read as "resolved." (Considered and
 * rejected matching HubSpot's own UI exactly — see §6 "Matching a
 * connector's own source UI" for why platform consistency won here.)
 *
 * Must be a real `Tone` — this used to return "neutral" for LOW, which
 * isn't a valid tone key, so the LOW badge silently rendered with no
 * background/text color at all (not a wrong color — no color, no pill).
 *
 * `muted` itself is confirmed correct semantically (matches WorkQ's own
 * `todo_priority_tone`, which also uses `muted` for low/normal priority).
 * The shared widget-tiles `Badge` component's `soft` variant for `muted`
 * used to render as effectively invisible in both light and dark mode
 * (confirmed by direct visual check) — root-caused against WorkQ's own
 * working priority pill and fixed directly in the shared `Badge` component
 * (`myHubV2/apps/web/src/features/widgets-system/system/components.tsx`),
 * not worked around here. This tile relies on that platform fix; until it's
 * promoted through myHubV2's own release pipeline, the badge will render
 * correctly in the harness/dev but not yet in a live tenant — acceptable
 * for now since this tile isn't in active use yet.
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "hubspot_ticket_priority_tone", "args": { "value": { "$item": "properties/hs_ticket_priority" } } }
 */
const ticket_priority_tone: ComputedFunction = (args) => {
  const v = String(args.value ?? '').toUpperCase();
  if (v === 'HIGH' || v === 'URGENT') return 'destructive';
  if (v === 'MEDIUM') return 'warning';
  return 'muted';
};

/**
 * Title-cases a HubSpot ticket's raw `hs_ticket_priority` value for display
 * ("LOW" → "Low", "URGENT" → "Urgent"), matching WorkQ's status_label /
 * priority_label convention (TILE-DISPLAY-STANDARDS.md §3). Capitalizes
 * every word, not just the first — HubSpot priority values are single
 * words today, but this is held up as the reference `<connector>_<field>_label`
 * pattern for other connectors' multi-word statuses to copy, so it needs to
 * be genuinely correct Title Case, not a sentence-case shortcut that happens
 * to look right only because this particular field has no multi-word values.
 * Kept separate from `ticket_priority_tone`, which keeps matching against
 * the raw uppercase value regardless of display casing.
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "hubspot_ticket_priority_label", "args": { "value": { "$item": "properties/hs_ticket_priority" } } }
 */
const ticket_priority_label: ComputedFunction = (args) => {
  const v = String(args.value ?? '');
  if (!v) return v;
  return v
    .toLowerCase()
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
};

// Standard HubSpot default Sales pipeline stage internal IDs → display label /
// badge tone. A custom pipeline's stage IDs won't match this table — falls
// back to a humanized version of the raw ID (label) / 'muted' (tone) rather
// than erroring, since HubSpot's `dealstage` property always returns the raw
// internal ID, never the display label a user sees in the HubSpot UI.
const DEAL_STAGE_LABELS: Record<string, string> = {
  appointmentscheduled: 'Appointment Scheduled',
  qualifiedtobuy: 'Qualified To Buy',
  presentationscheduled: 'Presentation Scheduled',
  decisionmakerboughtin: 'Decision Maker Bought-In',
  contractsent: 'Contract Sent',
  closedwon: 'Closed Won',
  closedlost: 'Closed Lost',
};

// `accent` used to be here for presentationscheduled/decisionmakerboughtin --
// it's a near-invisible menu-hover gray in the real theme, not a display
// color (same root cause as the Membership-by-State bar bug and the
// Support Tickets priority-pill bug). Both stages now use `info`, matching
// qualifiedtobuy -- all three represent "actively progressing, not yet at
// contract stage", escalating to `warning` right before close.
//
// appointmentscheduled was `muted` until 2026-08-10 -- copied from
// ticket_priority_tone's LOW-is-muted pattern, but that pattern fits a
// "normal, nothing to report" default value, not the first stage of an
// open deal (which is neither normal-and-ongoing nor nothing-to-report --
// it's the literal start of the thing being tracked). Moved to `info` so
// the whole open pipeline (this tile never shows closedwon/closedlost --
// see the dealstage NEQ filters in hubspot-pipeline.json) reads as one
// continuous "actively progressing" band, breaking only at contractsent.
const DEAL_STAGE_TONES: Record<string, string> = {
  appointmentscheduled: 'info',
  qualifiedtobuy: 'info',
  presentationscheduled: 'info',
  decisionmakerboughtin: 'info',
  contractsent: 'warning',
  closedwon: 'success',
  closedlost: 'destructive',
};

function humanizeStageId(raw: string): string {
  if (!raw) return '';
  const spaced = raw.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Maps a HubSpot deal's raw `dealstage` internal ID to a human-readable label
 * matching HubSpot's own UI (e.g. "closedwon" → "Closed Won"). Covers the
 * standard default Sales pipeline; falls back to humanizing the raw ID for a
 * custom pipeline's stage IDs.
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "hubspot_deal_stage_label", "args": { "value": { "$item": "properties/dealstage" } } }
 */
const deal_stage_label: ComputedFunction = (args) => {
  const v = String(args.value ?? '');
  return DEAL_STAGE_LABELS[v.toLowerCase()] ?? humanizeStageId(v);
};

/**
 * Maps a HubSpot deal's raw `dealstage` internal ID to a Badge tone, loosely
 * matching HubSpot's own color-coded stage pills (won=green, lost=red,
 * later-stage=warmer tones). Covers the standard default Sales pipeline;
 * falls back to 'muted' for a custom pipeline's stage IDs.
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "hubspot_deal_stage_tone", "args": { "value": { "$item": "properties/dealstage" } } }
 */
const deal_stage_tone: ComputedFunction = (args) => {
  const v = String(args.value ?? '').toLowerCase();
  return DEAL_STAGE_TONES[v] ?? 'muted';
};

// HubSpot's default Support ticket pipeline stage IDs → label. Tickets return
// the raw internal stage ID (e.g. "1"), never the label a user sees in the
// HubSpot UI — same underlying issue as deal stages, but tickets pipelines
// are more likely to be portal-customized, so this covers the default
// pipeline only and falls back to the raw ID (not a humanized guess, since
// "1"/"2"/etc. carry no readable structure to humanize).
const TICKET_STAGE_LABELS: Record<string, string> = {
  '1': 'New',
  '2': 'Waiting on contact',
  '3': 'Waiting on us',
  '4': 'Closed',
};

/**
 * Maps a HubSpot ticket's raw `hs_pipeline_stage` internal ID to a
 * human-readable label matching HubSpot's own UI (e.g. "1" → "New"). Covers
 * the standard default Support pipeline; falls back to the raw ID for a
 * custom pipeline's stage IDs, since numeric IDs have no structure to
 * humanize the way deal-stage slugs do.
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "hubspot_ticket_stage_label", "args": { "value": { "$item": "properties/hs_pipeline_stage" } } }
 */
const ticket_stage_label: ComputedFunction = (args) => {
  const v = String(args.value ?? '');
  return TICKET_STAGE_LABELS[v] ?? v;
};

/**
 * A HubSpot ticket's `content` (description) property, or a fallback
 * message when it's blank — most tickets created via forms/chat have one,
 * but manually-created tickets often don't, and an empty expanded row reads
 * as broken rather than "there's nothing more to show."
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "hubspot_ticket_content_or_fallback", "args": { "value": { "$item": "properties/content" } } }
 */
const ticket_content_or_fallback: ComputedFunction = (args) => {
  const v = String(args.value ?? '').trim();
  return v || 'No description provided.';
};

interface HubSpotOwner {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Resolves a record's `hubspot_owner_id` to a display name, given the full
 * owners list from `list_owners`. Records only ever store the owner's
 * internal ID, never a name, so this is always a lookup against that
 * separately-fetched list (see `list_owners` in the HubSpot MCP server).
 * Falls back to the owner's email if their name fields are blank, and to
 * "Unassigned" if the record has no owner set OR the owners list hasn't
 * resolved it yet (visibility conditions can't gate on a $computed result,
 * so this always returns a real string rather than '' — a brief incorrect
 * "Unassigned" during the one-time owners fetch self-corrects the moment it
 * lands, which reads better than an empty line).
 *
 * Args: { ownerId: string, owners: HubSpotOwner[] }
 *
 * Spec example:
 *   {
 *     "$computed": "hubspot_ticket_owner_name",
 *     "args": {
 *       "ownerId": { "$item": "properties/hubspot_owner_id" },
 *       "owners": { "$state": "/hubspot/list_owners/items" }
 *     }
 *   }
 */
const ticket_owner_name: ComputedFunction = (args) => {
  const ownerId = String(args.ownerId ?? '');
  if (!ownerId) return 'Unassigned';
  const owners = Array.isArray(args.owners) ? (args.owners as HubSpotOwner[]) : [];
  const owner = owners.find((o) => o && String(o.id) === ownerId);
  if (!owner) return 'Unassigned';
  const name = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim();
  return name || owner.email || 'Unassigned';
};

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Formats a HubSpot date/datetime property as `dd-Mmm-yy` (e.g. "05-Aug-26"),
 * the standard date format agreed across all tiles. Returns '' for a
 * missing/unparseable value rather than "Invalid Date".
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "hubspot_format_date", "args": { "value": { "$item": "properties/createdate" } } }
 */
const format_date: ComputedFunction = (args) => {
  const raw = args.value;
  if (!raw) return '';
  const ms = Date.parse(String(raw));
  if (Number.isNaN(ms)) return '';
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_ABBR[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
};

interface StateCount {
  value: string;
  count: number;
  percentage: number;
}

/**
 * Summarize the leading state(s) from a `count_objects_by_property` result as a
 * short, data-driven insight sentence, e.g. "California and Texas account for
 * 41% of total membership." Takes the top 1-2 named states — excluding the
 * "(not set)" bucket the tool uses for missing/blank values, since that isn't a
 * real place worth naming in a headline — and reports their combined share of
 * `total`. Falls back to a neutral message when there isn't enough data yet.
 *
 * Args: { counts: Array<{ value: string; count: number; percentage: number }>, total: number }
 *
 * Spec example:
 *   {
 *     "$computed": "hubspot_membership_state_insight",
 *     "args": {
 *       "counts": { "$state": "/hubspot/count_objects_by_property/counts" },
 *       "total": { "$state": "/hubspot/count_objects_by_property/total" }
 *     }
 *   }
 */
const membership_state_insight: ComputedFunction = (args) => {
  const counts = Array.isArray(args.counts) ? (args.counts as StateCount[]) : [];
  const total = typeof args.total === 'number' ? args.total : 0;

  const named = counts.filter((c) => c && c.value !== '(not set)');
  if (named.length === 0 || total <= 0) {
    return 'Not enough data yet to surface a membership insight.';
  }

  const top = named.slice(0, 2);
  const combinedCount = top.reduce((sum, c) => sum + (c.count ?? 0), 0);
  const combinedPct = Math.round((combinedCount / total) * 100);
  const names = top.map((c) => c.value).join(' and ');
  const verb = top.length > 1 ? 'account for' : 'accounts for';

  return `${names} ${verb} ${combinedPct}% of total membership.`;
};

/**
 * Complements `membership_state_insight` by calling out the least-represented
 * named state(s) as a potential outreach/growth target — directly serves this
 * tile's stated purpose ("helps associations identify their target audiences
 * and where to host events"). Only returns a sentence when there are at least
 * 3 distinct named states (otherwise "the smallest" would just restate the
 * same 1-2 states the top-line insight already names). `counts` is assumed
 * sorted descending by count (the tool's documented contract), so the last
 * 1-2 entries are the lowest.
 *
 * Args: { counts: Array<{ value: string; count: number; percentage: number }>, total: number }
 *
 * Spec example:
 *   {
 *     "$computed": "hubspot_membership_growth_insight",
 *     "args": {
 *       "counts": { "$state": "/hubspot/count_objects_by_property/counts" },
 *       "total": { "$state": "/hubspot/count_objects_by_property/total" }
 *     }
 *   }
 */
const membership_growth_insight: ComputedFunction = (args) => {
  const counts = Array.isArray(args.counts) ? (args.counts as StateCount[]) : [];
  const total = typeof args.total === 'number' ? args.total : 0;

  const named = counts.filter((c) => c && c.value !== '(not set)');
  if (named.length < 3 || total <= 0) return '';

  const lowest = named.slice(-2);
  const names = lowest.map((c) => c.value).join(' and ');
  const combinedPct = Math.round(lowest.reduce((sum, c) => sum + (c.percentage ?? 0), 0));
  const verb = lowest.length > 1 ? 'have' : 'has';

  return `${names} ${verb} the smallest share (~${combinedPct}% combined) — potential outreach targets.`;
};

/**
 * Renders a "+N more" note when a capped member-name list (e.g. the
 * click-to-expand drill-down on a Membership by State row) doesn't show every
 * record for that state. Returns an empty string (renders nothing) when the
 * full count already fits within what was shown.
 *
 * Args: { count: number (true total for this state), shown: number (how many names were actually fetched) }
 *
 * Spec example:
 *   {
 *     "$computed": "hubspot_remaining_members_note",
 *     "args": {
 *       "count": { "$state": "/ui/selectedState/count" },
 *       "shown": { "$computed": "count", "args": { "value": { "$state": "/hubspot/search_custom_objects/items" } } }
 *     }
 *   }
 */
const remaining_members_note: ComputedFunction = (args) => {
  const count = typeof args.count === 'number' ? args.count : 0;
  const shown = typeof args.shown === 'number' ? args.shown : 0;
  const remaining = count - shown;
  return remaining > 0 ? `+${remaining} more` : '';
};

// Fixed cycle of Dot tones. Used for rank-based (position-in-list) coloring
// when the underlying values are portal-defined labels with no standard
// vocabulary to look up by name (e.g. membership category names vary far
// more across portals than something like AU state abbreviations or
// HubSpot's own default deal-stage IDs) — so we color by the row's position
// in the (already count-descending-sorted) list instead of trying to match
// specific category names. Uses the categorical `chart-1..5` tones, not
// status tones like `warning`/`destructive` — a category ranked 4th or 5th
// isn't an error or a caution, just less common (TILE-DISPLAY-STANDARDS.md,
// "Decorative color").
const RANK_TONE_CYCLE = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'];

/**
 * Colors a `count_objects_by_property` row by its position in the list
 * (already sorted descending by count) rather than by matching its value
 * against a fixed name lookup — for breakdowns where the category labels are
 * portal-defined and too varied to reliably match by name (e.g. membership
 * type/category, as opposed to a more standardized breakdown like US states).
 *
 * Args: { counts: Array<{ value: string; count: number; percentage: number }>, value: string }
 *
 * Spec example:
 *   {
 *     "$computed": "hubspot_category_rank_tone",
 *     "args": {
 *       "counts": { "$state": "/hubspot/count_objects_by_property/counts" },
 *       "value": { "$item": "value" }
 *     }
 *   }
 */
const category_rank_tone: ComputedFunction = (args) => {
  const counts = Array.isArray(args.counts) ? (args.counts as StateCount[]) : [];
  const value = args.value;
  const index = counts.findIndex((c) => c && c.value === value);
  if (index < 0) return 'muted';
  return RANK_TONE_CYCLE[index % RANK_TONE_CYCLE.length];
};

interface HubSpotContactLike {
  properties?: { firstname?: string; lastname?: string; [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * Adds a combined `properties.full_name` field to each HubSpot contact,
 * for a `Table` column to bind to directly -- `Table`'s `field` is a single
 * dotted path into the row object, it can't combine two fields into one
 * cell the way a `$computed` prop binding can. Falls back to "(no name)"
 * when both firstname and lastname are blank, rather than an empty cell
 * that reads as a loading/data problem.
 *
 * Args: { items: HubSpotContactLike[] }
 *
 * Spec example:
 *   {
 *     "$computed": "hubspot_contacts_with_full_name",
 *     "args": { "items": { "$state": "/hubspot/search_contacts/items" } }
 *   }
 */
const contacts_with_full_name: ComputedFunction = (args) => {
  const items = Array.isArray(args.items) ? (args.items as HubSpotContactLike[]) : [];
  return items.map((item) => {
    const props = item.properties ?? {};
    const fullName = [props.firstname, props.lastname].filter(Boolean).join(' ').trim();
    return {
      ...item,
      properties: { ...props, full_name: fullName || '(no name)' },
    };
  });
};

const elements: PluginElementsModule = {
  slug: 'hubspot',
  functions: {
    ticket_priority_tone,
    ticket_priority_label,
    ticket_content_or_fallback,
    ticket_owner_name,
    format_date,
    contacts_with_full_name,
    membership_state_insight,
    membership_growth_insight,
    remaining_members_note,
    deal_stage_label,
    deal_stage_tone,
    ticket_stage_label,
    category_rank_tone,
  },
};

export default elements;
