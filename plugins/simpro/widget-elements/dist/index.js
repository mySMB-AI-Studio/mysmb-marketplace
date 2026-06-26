export const slug = 'simpro';
// ─── Computed functions ───────────────────────────────────────────────────────
/**
 * Map a SimPro invoice status to a badge tone.
 * Args: { value: string }
 */
const invoice_tone = (args) => {
    const v = String(args.value ?? '');
    if (v === 'Paid')
        return 'success';
    if (v === 'Sent')
        return 'accent';
    if (v === 'Pending')
        return 'warning';
    if (v === 'Overdue')
        return 'destructive';
    if (v === 'Void')
        return 'muted';
    return 'muted';
};
/**
 * Map a SimPro job status to a badge tone.
 * Args: { value: string }
 *
 * In Progress      → "warning"   (active, ongoing)
 * Scheduled        → "accent"    (booked, not started)
 * Pending          → "accent"
 * Awaiting Parts   → "destructive" (blocked)
 * Awaiting Materials → "destructive"
 * Completed / Complete → "success"
 * Ready to Invoice → "success"
 * (default)        → "muted"
 */
const job_status_tone = (args) => {
    const v = String(args.value ?? '');
    if (v === 'In Progress')
        return 'warning';
    if (v === 'Scheduled' || v === 'Pending')
        return 'accent';
    if (v === 'Awaiting Parts' || v === 'Awaiting Materials')
        return 'destructive';
    if (v === 'Completed' || v === 'Complete' || v === 'Ready to Invoice')
        return 'success';
    return 'muted';
};
// ─── Composite components ─────────────────────────────────────────────────────
/**
 * Two-line time pill showing scheduled start and end time.
 * Props: start (string), end (string)
 *
 * Usage:
 *   { "type": "simpro/TimePill", "props": { "start": "07:30", "end": "10:00" } }
 */
const TimePill = {
    kind: 'composite',
    props: ['start', 'end'],
    spec: {
        root: 'pill',
        elements: {
            pill: { type: 'Stack', props: { gap: 'none', align: 'center' }, children: ['s', 'e'] },
            s: { type: 'Caption', props: { text: { $prop: 'start' } } },
            e: { type: 'Caption', props: { text: { $prop: 'end' }, tone: 'muted' } },
        },
    },
};
// ─── Module export ────────────────────────────────────────────────────────────
const elements = {
    slug: 'simpro',
    functions: { invoice_tone, job_status_tone },
    components: { TimePill },
};
export default elements;
