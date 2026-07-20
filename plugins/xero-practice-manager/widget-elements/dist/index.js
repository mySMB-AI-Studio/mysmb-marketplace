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
 *   task     (string)  — task name
 *   subtitle (string)  — optional "Client · Job #XXXX" muted line
 *   duration (string)  — right-aligned, e.g. "1h 38m"
 *   tone     (string)  — system tone: "success" (billable) | "warning" (admin) | "muted" (neutral)
 */
const TimeBlock = {
    kind: 'composite',
    props: ['task', 'subtitle', 'duration', 'tone'],
    spec: {
        root: 'rowCard',
        elements: {
            // Tinted card — tone drives background colour
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
 *   statusTone    (string)  — system tone: "success" | "destructive" | "muted"
 *   nameWithCount (string)  — combined name + job count, e.g. "Priya Nair · 4 jobs today"
 *   role          (string)  — job title / role
 *   loadLevel     (number)  — 0–5, drives the workload progress bar
 *   statusLabel   (string)  — display text for status badge, e.g. "On track"
 */
const StaffRow = {
    kind: 'composite',
    props: ['initials', 'statusTone', 'nameWithCount', 'role', 'loadPercent', 'statusLabel'],
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
            // Workload bar — ProgressBar treats value as 0-100 %, so pass pre-computed percent
            loadBar: {
                type: 'ProgressBar',
                props: {
                    value: { $prop: 'loadPercent' },
                    tone: { $prop: 'statusTone' },
                    style: { width: '60px', flexShrink: 0 },
                },
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
