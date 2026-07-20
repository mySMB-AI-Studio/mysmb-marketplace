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
 *   time     (string)  — left-aligned time label, e.g. "08:30"
 *   label    (string)  — task name, bold when tone is "billable"
 *   subtitle (string)  — optional "Client · Job #XXXX" muted line
 *   duration (string)  — right-aligned, e.g. "1h 38m"
 *   tone     (string)  — "neutral" | "billable" | "admin"
 *
 * Usage:
 *   { "type": "xero-practice-manager/TimeBlock",
 *     "props": { "time": "08:30", "label": "FY26 Tax Return prep",
 *                "subtitle": "Heritage Trust · Job #4821",
 *                "duration": "1h 38m", "tone": "billable" } }
 *
 * Accent bar colour:
 *   billable → success (teal/green)
 *   admin    → warning (orange)
 *   neutral  → muted   (gray)
 */
const TimeBlock: CompositeComponentDef = {
  kind: 'composite',
  props: ['time', 'label', 'subtitle', 'duration', 'tone'],
  spec: {
    root: 'row',
    elements: {
      // Outer row: [timeCol] [accentBar] [labelStack] [durationText]
      row: {
        type: 'Row',
        props: { gap: 'sm', align: 'start' },
        children: ['timeCol', 'accentBar', 'labelStack', 'durText'],
      },

      // Left: time label
      timeCol: {
        type: 'Text',
        props: {
          text: { $prop: 'time' },
          size: 'xs',
          tone: 'muted',
          style: { minWidth: '36px', textAlign: 'right', flexShrink: 0 },
        },
      },

      // Coloured accent bar (2px wide, full row height via stretch)
      accentBar: {
        type: 'Divider',
        props: {
          orientation: 'vertical',
          tone: { $prop: 'tone' },
        },
      },

      // Middle: label + optional subtitle
      labelStack: {
        type: 'Stack',
        props: { gap: 'none', grow: true },
        children: ['taskLabel', 'subtitleText'],
      },
      taskLabel: {
        type: 'Text',
        props: {
          text: { $prop: 'label' },
          size: 'sm',
          weight: 'medium',
          truncate: true,
        },
      },
      subtitleText: {
        type: 'Text',
        props: {
          text: { $prop: 'subtitle' },
          size: 'xs',
          tone: 'muted',
          truncate: true,
        },
        visible: { $prop: 'subtitle' },
      },

      // Right: duration
      durText: {
        type: 'Text',
        props: {
          text: { $prop: 'duration' },
          size: 'xs',
          tone: 'muted',
          style: { flexShrink: 0 },
        },
      },
    },
  },
};

/**
 * StaffRow — one staff member row in the Team Schedule list.
 *
 * Props:
 *   initials  (string)  — 2-letter avatar, e.g. "PN"
 *   color     (string)  — badge tone for the avatar chip, e.g. "accent"
 *   name      (string)  — staff member name
 *   role      (string)  — job title / role
 *   jobCount  (string)  — e.g. "4 jobs today"
 *   loadLevel (number)  — 0–5 filled squares
 *   status    (string)  — "on-track" | "overloaded" | "available"
 *
 * Usage:
 *   { "type": "xero-practice-manager/StaffRow",
 *     "props": { "initials": "PN", "color": "accent",
 *                "name": "Priya Nair", "role": "Senior Accountant",
 *                "jobCount": "4 jobs today", "loadLevel": 4,
 *                "status": "on-track" } }
 */
const StaffRow: CompositeComponentDef = {
  kind: 'composite',
  props: ['initials', 'color', 'name', 'role', 'jobCount', 'loadLevel', 'status'],
  spec: {
    root: 'row',
    elements: {
      // Outer row: [avatar] [nameStack] [rightStack]
      row: {
        type: 'Row',
        props: { gap: 'sm', align: 'center' },
        children: ['avatar', 'nameStack', 'rightStack'],
      },

      // Initials chip
      avatar: {
        type: 'Badge',
        props: {
          text: { $prop: 'initials' },
          tone: { $prop: 'color' },
          style: { minWidth: '32px', textAlign: 'center', fontWeight: '600' },
        },
      },

      // Name + role
      nameStack: {
        type: 'Stack',
        props: { gap: 'none', grow: true },
        children: ['nameText', 'roleText'],
      },
      nameText: {
        type: 'Text',
        props: { text: { $prop: 'name' }, size: 'sm', weight: 'medium', truncate: true },
      },
      roleText: {
        type: 'Text',
        props: { text: { $prop: 'role' }, size: 'xs', tone: 'muted', truncate: true },
      },

      // Right side: job count + status badge
      rightStack: {
        type: 'Stack',
        props: { gap: 'xs', align: 'end' },
        children: ['jobCountText', 'statusBadge'],
      },
      jobCountText: {
        type: 'Text',
        props: { text: { $prop: 'jobCount' }, size: 'xs', tone: 'muted' },
      },
      statusBadge: {
        type: 'Badge',
        props: {
          text: { $prop: 'status' },
          tone: { $prop: 'status' },
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
