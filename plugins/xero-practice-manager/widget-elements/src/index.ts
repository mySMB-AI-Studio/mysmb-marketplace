/**
 * xero-practice-manager — widget-elements module
 *
 * Composite components for XPM demo widgets:
 *   - TimeBlock  — a single time-boxed entry row in the Time Boxing tile
 *   - StaffRow   — a single staff workload row in the Team Schedule tile
 */

import type { CompositeComponentDef, PluginElementsModule } from './types';

export const slug = 'xero-practice-manager';

// ─── Composite components ─────────────────────────────────────────────────────

/**
 * TimeBlock — one row in the Time Boxing list.
 *
 * Props:
 *   task     (string)  — task name
 *   subtitle (string)  — optional "Client · Job #XXXX" muted line
 *   duration (string)  — right-aligned, e.g. "1h 38m"
 *   tone     (string)  — system tone: "success" (billable) | "warning" (admin) | "muted" (neutral)
 *
 * Usage:
 *   { "type": "xero-practice-manager/TimeBlock",
 *     "props": { "task": "FY26 Tax Return prep",
 *                "subtitle": "Heritage Trust · Job #4821",
 *                "duration": "1h 38m", "tone": "success" } }
 */
const TimeBlock: CompositeComponentDef = {
  kind: 'composite',
  props: ['task', 'subtitle', 'duration', 'tone'],
  spec: {
    root: 'rowCard',
    elements: {
      // Tinted card — tone drives background colour (success=teal, warning=amber, muted=grey)
      rowCard: {
        type: 'Card',
        props: { tone: { $prop: 'tone' } },
        children: ['contentRow'],
      },

      // Content: [labelStack] [duration]
      contentRow: {
        type: 'Row',
        props: { justify: 'between', align: 'start', gap: 'sm' },
        children: ['labelStack', 'durText'],
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
        props: { text: { $prop: 'name' }, size: 'sm', weight: 'medium', truncate: true },
      },
      roleText: {
        type: 'Text',
        props: { text: { $prop: 'roleWithCount' }, size: 'xs', tone: 'muted', truncate: true },
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

// ─── Module export ────────────────────────────────────────────────────────────

const elements: PluginElementsModule = {
  slug: 'xero-practice-manager',
  components: { TimeBlock, StaffRow },
};

export default elements;
