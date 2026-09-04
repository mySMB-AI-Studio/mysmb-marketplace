import type { PluginElementsModule } from './types';
/**
 * Queue-bucket classification for the Service Desk Queue tile's redesign
 * (Tile: Service Desk Queue - JSM - Service Management).
 *
 * Four buckets, all derived from the SAME `list_service_desk_requests`
 * response already fetched by this widget's `dataProvider` -- no new tool
 * call. A request's bucket is a pure function of two things already on
 * every request: `currentStatus.statusCategory` and the "Time to
 * resolution" SLA clock in `sla.values`.
 *
 * `statusCategory` casing: confirmed UPPERCASE ("NEW", "INDETERMINATE",
 * "DONE") against Atlassian's own servicedeskapi request-object docs
 * (`currentStatus: { status, statusCategory: "NEW", statusDate }`), and
 * consistent with a real live sandbox sample that showed `"INDETERMINATE"`
 * for a "Waiting for support" ticket. This is a different, flatter shape
 * than the nested `fields.status.statusCategory.key` object Jira's own
 * platform issue API uses (which IS lowercase) -- don't confuse the two.
 * `normalizeCategory` upper-cases defensively regardless, so a
 * differently-cased value from a future API revision degrades to
 * "in_progress" instead of silently mis-bucketing.
 *
 * Priority order -- deliberately SLA-urgency-first, not status-first:
 *   1. alerts      -- "Time to resolution" ongoingCycle.breached === true
 *   2. behind      -- ongoingCycle exists, not breached, but at-risk
 *                     (same 15%-of-goal / 1h-fallback threshold as
 *                     atlassian_sla_tone's "warning", reused via isAtRisk)
 *   3. new         -- statusCategory === "NEW"
 *   4. in_progress -- everything else (typically "INDETERMINATE")
 *
 * Alerts/Behind are checked before New so an unactioned brand-new ticket
 * that's already close to breaching its resolution clock surfaces under
 * Behind/Alerts rather than hiding under New -- the whole point of a
 * bucket board is to not bury an urgent ticket behind a status label.
 * This also guarantees the Alerts bucket's count always equals the
 * header's "breached" counter (both are exactly "breached === true" on
 * the resolution clock, no status carve-out) -- intentional, not a bug.
 *
 * Spec example (single request -> bucket key):
 *   { "$computed": "atlassian_request_bucket", "args": { "request": { "$item": "" } } }
 */
export type RequestBucket = 'new' | 'in_progress' | 'behind' | 'alerts' | 'done';
export type WorkloadStatusLabel = 'Available' | 'On track' | 'Overloaded';
export type WorkloadStatusTone = 'muted' | 'success' | 'destructive';
export interface WorkloadRow {
    accountId: string;
    displayName: string;
    count: number;
    searchUrl: string;
    /** "Available" (0) / "On track" (1-4) / "Overloaded" (5+) -- see `workloadStatusFor`. */
    statusLabel: WorkloadStatusLabel;
    /** Tone paired with `statusLabel`, per TILE-DISPLAY-STANDARDS.md's status-tone model. */
    statusTone: WorkloadStatusTone;
    /** 0-100, `count` scaled so 5 items = a full bar. See `workloadLoadPercent`. */
    loadPercent: number;
    /** 1-2 uppercase letters derived from `displayName` for the row's avatar. */
    initials: string;
    /** Honest count phrase ("2 work items in progress") -- see the "no fake role" note below. */
    countLabel: string;
}
declare const elements: PluginElementsModule;
export default elements;
