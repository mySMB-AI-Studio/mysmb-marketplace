/**
 * xero-practice-manager — widget-elements module
 *
 * Composite components for XPM demo widgets:
 *   - TimeBlock  — a single time-boxed entry row in the Time Boxing tile
 *   - StaffRow   — a single staff workload row in the Team Schedule tile
 */
export const slug = 'xero-practice-manager';
// ─── Composite components ─────────────────────────────────────────────────────
/**
 * TimeBlock — one row in the Time Boxing list.
 *
 * Props:
 *   time     (string)  — left-aligned time label, e.g. "08:30"
 *   task     (string)  — task name (renamed from "label" to avoid reserved-prop conflicts)
 *   subtitle (string)  — optional "Client · Job #XXXX" muted line
 *   duration (string)  — right-aligned, e.g. "1h 38m"
 *   tone     (string)  — system tone: "success" (billable) | "warning" (admin) | "muted" (neutral)
 *
 * Usage:
 *   { "type": "xero-practice-manager/TimeBlock",
 *     "props": { "time": "08:30", "task": "FY26 Tax Return prep",
 *                "subtitle": "Heritage Trust · Job #4821",
 *                "duration": "1h 38m", "tone": "success" } }
 */
const TimeBlock = {
    kind: 'composite',
    props: ['time', 'task', 'subtitle', 'duration', 'tone'],
    spec: {
        root: 'row',
        elements: {
            // Outer row: [timeCol] [dot] [labelStack] [durText]
            row: {
                type: 'Row',
                props: { gap: 'sm', align: 'center' },
                children: ['timeCol', 'dot', 'labelStack', 'durText'],
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
            // Coloured dot indicator — replaces vertical Divider (not reliably supported)
            dot: {
                type: 'Badge',
                props: {
                    text: '■',
                    tone: { $prop: 'tone' },
                    style: { padding: '2px 4px', flexShrink: 0 },
                },
            },
            // Middle: task name + optional subtitle
            labelStack: {
                type: 'Stack',
                props: { gap: 'none', grow: true },
                children: ['taskLabel', 'subtitleText'],
            },
            taskLabel: {
                type: 'Text',
                props: {
                    text: { $prop: 'task' },
                    size: 'sm',
                    weight: 'medium',
                },
            },
            subtitleText: {
                type: 'Text',
                props: {
                    text: { $prop: 'subtitle' },
                    size: 'xs',
                    tone: 'muted',
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
 *   initials      (string)  — 2-letter avatar, e.g. "PN"
 *   statusTone    (string)  — system tone for avatar + status badge: "success" | "destructive" | "muted"
 *   nameWithCount (string)  — combined name + job count, e.g. "Priya Nair · 4 jobs today"
 *   role          (string)  — job title / role
 *   statusLabel   (string)  — display text for status badge, e.g. "On track"
 *
 * Usage:
 *   { "type": "xero-practice-manager/StaffRow",
 *     "props": { "initials": "PN", "statusTone": "success",
 *                "nameWithCount": "Priya Nair · 4 jobs today",
 *                "role": "Senior Accountant", "statusLabel": "On track" } }
 */
const StaffRow = {
    kind: 'composite',
    props: ['initials', 'statusTone', 'nameWithCount', 'role', 'statusLabel'],
    spec: {
        root: 'row',
        elements: {
            // Outer row: [avatar] [nameStack] [statusBadge]
            row: {
                type: 'Row',
                props: { gap: 'sm', align: 'center' },
                children: ['avatar', 'nameStack', 'statusBadge'],
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
            // Name · job count (one line) + role below
            nameStack: {
                type: 'Stack',
                props: { gap: 'none', style: { flex: 1, minWidth: 0 } },
                children: ['nameText', 'roleText'],
            },
            nameText: {
                type: 'Text',
                props: { text: { $prop: 'nameWithCount' }, size: 'sm', weight: 'medium', truncate: true },
            },
            roleText: {
                type: 'Text',
                props: { text: { $prop: 'role' }, size: 'xs', tone: 'muted', truncate: true },
            },
            // Status badge
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
const elements = {
    slug: 'xero-practice-manager',
    components: { TimeBlock, StaffRow },
};
export default elements;
