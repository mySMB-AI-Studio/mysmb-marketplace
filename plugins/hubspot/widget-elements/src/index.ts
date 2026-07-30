import type { ComputedFunction, PluginElementsModule } from './types';

/**
 * Map a HubSpot ticket's `hs_ticket_priority` value to a semantic badge tone.
 * "HIGH" → "destructive", "MEDIUM" → "warning", "LOW" (or anything else) → "neutral".
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
  return 'neutral';
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

const DEAL_STAGE_TONES: Record<string, string> = {
  appointmentscheduled: 'muted',
  qualifiedtobuy: 'info',
  presentationscheduled: 'accent',
  decisionmakerboughtin: 'accent',
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

// Fixed cycle of Badge/Dot tones. Used for rank-based (position-in-list)
// coloring when the underlying values are portal-defined labels with no
// standard vocabulary to look up by name (e.g. membership category names
// vary far more across portals than something like AU state abbreviations
// or HubSpot's own default deal-stage IDs) — so we color by the row's
// position in the (already count-descending-sorted) list instead of trying
// to match specific category names.
const RANK_TONE_CYCLE = ['accent', 'info', 'success', 'warning', 'destructive', 'muted'];

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

const elements: PluginElementsModule = {
  slug: 'hubspot',
  functions: {
    ticket_priority_tone,
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
