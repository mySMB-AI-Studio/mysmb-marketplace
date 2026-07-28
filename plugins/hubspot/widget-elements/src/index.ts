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

const elements: PluginElementsModule = {
  slug: 'hubspot',
  functions: { ticket_priority_tone, membership_state_insight },
};

export default elements;
