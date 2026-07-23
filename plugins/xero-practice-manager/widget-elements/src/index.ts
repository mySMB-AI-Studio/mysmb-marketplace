/**
 * xero-practice-manager — widget-elements module
 *
 * Composite components for XPM demo widgets:
 *   - TimeBlock  — a single time-boxed entry row in the Time Boxing tile
 *   - StaffRow   — a single staff workload row in the Team Schedule tile
 *
 * Computed functions:
 *   - format_duration  — EstimatedMinutes / Hours decimal → "Xh Ym"
 *   - xpm_job_url      — XPM JobID → practicemanager deep-link URL
 *   - xpm_entry_tone   — IsBillable boolean/string → system tone
 */

import type { CompositeComponentDef, ComputedFunction, PluginElementsModule } from './types';

export const slug = 'xero-practice-manager';

// ─── Composite components ─────────────────────────────────────────────────────

/**
 * TimeBlock — one row in the Time Boxing list.
 *
 * Props:
 *   time     (string)  — optional time label in the left gutter, e.g. "08:30"
 *   task     (string)  — task name
 *   subtitle (string)  — optional "Client · Job #XXXX" muted line
 *   duration (string)  — right-aligned, e.g. "1h 38m"
 *   tone     (string)  — system tone: "success" (billable) | "warning" (admin) | "muted" (neutral)
 *
 * Usage:
 *   { "type": "xero-practice-manager/TimeBlock",
 *     "props": { "time": "08:30",
 *                "task": "FY26 Tax Return prep",
 *                "subtitle": "Heritage Trust · Job #4821",
 *                "duration": "1h 38m", "tone": "success" } }
 *
 * NOTE — composite renderer constraint: a Row as the spec root with a direct child
 * that carries `visible: { $prop: ... }` causes the entire composite to render nothing
 * (root cause unconfirmed — composite.ts lives in the host app, not this repo).
 * Keep Card as root and place conditional elements deeper in the tree to avoid this.
 */
const TimeBlock: CompositeComponentDef = {
  kind: 'composite',
  props: ['time', 'task', 'subtitle', 'duration', 'tone'],
  spec: {
    root: 'outerRow',
    elements: {
      // Outer row: [time gutter] [tinted card]
      outerRow: {
        type: 'Row',
        props: { gap: 'xs', align: 'center' },
        children: ['timeText', 'rowCard'],
      },

      // Time label sits outside the card so it aligns flush left across all blocks
      timeText: {
        type: 'Text',
        props: {
          text: { $prop: 'time' },
          size: 'xs',
          tone: 'muted',
          style: { width: '42px', flexShrink: 0, textAlign: 'right' },
        },
        visible: { $prop: 'time' },
      },

      // Tinted card — tone drives background colour (success=teal, warning=amber, muted=grey)
      rowCard: {
        type: 'Card',
        props: { tone: { $prop: 'tone' }, style: { flex: 1 } },
        children: ['contentRow'],
      },

      // Content: [time] [labelStack] [duration]
      contentRow: {
        type: 'Row',
        props: { justify: 'between', align: 'center', gap: 'sm' },
        children: ['timeText', 'labelStack', 'durText'],
      },

      // Fixed-width time column — hidden when no time prop supplied (backward-compat)
      timeText: {
        type: 'Text',
        props: {
          text: { $prop: 'time' },
          size: 'xs',
          tone: 'muted',
          style: { width: '40px', flexShrink: 0, textAlign: 'right' },
        },
        visible: { $prop: 'time' },
      },

      labelStack: {
        type: 'Stack',
        props: { gap: 'none', style: { flex: 1, minWidth: 0 } },
        children: ['taskLabel', 'subtitleText'],
      },
      taskLabel: {
        type: 'Text',
        props: { text: { $prop: 'task' }, size: 'sm', weight: 'medium' },
      },
      subtitleText: {
        type: 'Text',
        props: { text: { $prop: 'subtitle' }, size: 'xs', tone: 'muted' },
        visible: { $prop: 'subtitle' },
      },

      durText: {
        type: 'Text',
        props: { text: { $prop: 'duration' }, size: 'xs', tone: 'muted', style: { flexShrink: 0 } },
      },
    },
  },
};

/**
 * StaffRow — one staff member row in the Team Schedule list.
 *
 * Props:
 *   initials      (string)  — 2-letter avatar, e.g. "PN"
 *   statusTone    (string)  — system tone: "success" | "destructive" | "warning"
 *   name          (string)  — staff member name, e.g. "Priya Nair"
 *   roleWithCount (string)  — role + job count, e.g. "Senior Accountant · 4 jobs today"
 *   loadPercent   (number)  — 0–100, pre-computed fill % for the workload bar
 *   statusLabel   (string)  — display text for status badge, e.g. "On track"
 *
 * Usage:
 *   { "type": "xero-practice-manager/StaffRow",
 *     "props": { "initials": "PN", "statusTone": "success",
 *                "name": "Priya Nair",
 *                "roleWithCount": "Senior Accountant · 4 jobs today",
 *                "loadPercent": 80, "statusLabel": "On track" } }
 */
const StaffRow: CompositeComponentDef = {
  kind: 'composite',
  props: ['initials', 'statusTone', 'name', 'roleWithCount', 'loadPercent', 'statusLabel'],
  spec: {
    root: 'row',
    elements: {
      // Outer row: [avatar] [nameStack] [loadBar] [statusBadge]
      row: {
        type: 'Row',
        props: { gap: 'sm', align: 'center' },
        children: ['avatar', 'nameStack', 'loadBar', 'statusBadge'],
      },

      // Initials chip — colour reflects workload status
      avatar: {
        type: 'Badge',
        props: {
          text: { $prop: 'initials' },
          tone: { $prop: 'statusTone' },
          style: { minWidth: '32px', textAlign: 'center', fontWeight: '600' },
        },
      },

      // Fixed-width name column — overflow:hidden prevents text from pushing bar right
      nameStack: {
        type: 'Stack',
        props: { gap: 'none', style: { width: '155px', flexShrink: 0, overflow: 'hidden' } },
        children: ['nameText', 'roleText'],
      },
      nameText: {
        type: 'Text',
        props: { text: { $prop: 'name' }, size: 'sm', weight: 'medium', truncate: true, style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
      },
      roleText: {
        type: 'Text',
        props: { text: { $prop: 'roleWithCount' }, size: 'xs', tone: 'muted', truncate: true, style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
      },

      // Workload bar — fixed width so left edge aligns across all rows
      loadBar: {
        type: 'ProgressBar',
        props: {
          value: { $prop: 'loadPercent' },
          tone: { $prop: 'statusTone' },
          style: { width: '60px', flexShrink: 0 },
        },
      },

      // Status badge — default (no variant) = soft pastel background with coloured text
      statusBadge: {
        type: 'Badge',
        props: {
          text: { $prop: 'statusLabel' },
          tone: { $prop: 'statusTone' },
        },
      },
    },
  },
};

// ─── Computed functions ───────────────────────────────────────────────────────

/**
 * Convert XPM EstimatedMinutes (integer) or Hours (decimal) to a human duration string.
 * Returns "Xh Ym", "Xh", "Ym", or "—" for zero/missing values.
 *
 * Args: { minutes?: number, hours?: number }
 *   Pass `minutes` when the source is EstimatedMinutes; pass `hours` for TimeEntry.Hours.
 *
 * Spec example:
 *   { "$computed": "xero-practice-manager_format_duration",
 *     "args": { "minutes": { "$item": "EstimatedMinutes" } } }
 */
const format_duration: ComputedFunction = (args) => {
  let mins: number;
  if (args.minutes != null) {
    mins = Math.round(Number(args.minutes));
  } else if (args.hours != null) {
    mins = Math.round(Number(args.hours) * 60);
  } else {
    return '—';
  }
  if (mins <= 0) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

/**
 * Build an XPM deep-link URL for a given JobID.
 * Returns "#" when JobID is empty so the link degrades gracefully.
 *
 * Args: { jobId: string }
 *
 * Spec example:
 *   { "$computed": "xero-practice-manager_xpm_job_url",
 *     "args": { "jobId": { "$item": "JobID" } } }
 */
const xpm_job_url: ComputedFunction = (args) => {
  const jobId = String(args.jobId ?? '');
  return jobId ? `https://go.xero.com/app/practicemanager/job/${jobId}` : '#';
};

/**
 * Map XPM IsBillable (boolean or "true"/"True" string) to a system tone.
 * Billable → "success"; non-billable → "warning".
 *
 * Args: { billable: boolean | string }
 *
 * Spec example:
 *   { "$computed": "xero-practice-manager_xpm_entry_tone",
 *     "args": { "billable": { "$item": "IsBillable" } } }
 */
const xpm_entry_tone: ComputedFunction = (args) => {
  const v = args.billable;
  return v === true || v === 'true' || v === 'True' ? 'success' : 'warning';
};

// ─── Module export ────────────────────────────────────────────────────────────

const elements: PluginElementsModule = {
  slug: 'xero-practice-manager',
  components: { TimeBlock, StaffRow },
  functions: { format_duration, xpm_job_url, xpm_entry_tone },
};

export default elements;
