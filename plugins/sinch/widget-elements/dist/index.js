// ── sinch_activity_events ──────────────────────────────────────────────────────
// Adds display-ready `label` and `tone` fields to each event in the
// list_sinch_message_events response for the Recent Message Activity tile.
// Args: { value: Array<{ status?: string, direction?: string, ... }> }
const sinch_activity_events = (args) => {
    const events = args.value;
    if (!Array.isArray(events))
        return null;
    return events.map(ev => {
        const status = (ev.status ?? '').toUpperCase();
        const direction = ev.direction ?? '';
        let label;
        let tone;
        if (direction === 'inbound') {
            label = 'Inbound Reply';
            tone = 'accent';
        }
        else {
            switch (status) {
                case 'DELIVERED':
                    label = 'Delivered';
                    tone = 'success';
                    break;
                case 'DISPATCHED':
                case 'DISPATCHING':
                case 'QUEUED':
                    label = 'Sent';
                    tone = 'info';
                    break;
                case 'FAILED':
                case 'UNDELIVERED':
                    label = 'Failed';
                    tone = 'destructive';
                    break;
                case 'SWITCHING_CHANNEL':
                    label = 'Retrying';
                    tone = 'warning';
                    break;
                default:
                    label = ev.status || 'Unknown';
                    tone = 'muted';
            }
        }
        return { ...ev, label, tone };
    });
};
// ── sinch_registration_counts ─────────────────────────────────────────────────
// Counts sender-ID registrations by status for the Registration Status Overview
// tile. Status values as returned by the Sinch Registration API (case-mixed):
//   approved, PENDING, IN_QUEUE, rejected, DRAFT
// Args: { value: Array<{ status?: string }> }
const sinch_registration_counts = (args) => {
    const registrations = args.value;
    if (!Array.isArray(registrations))
        return null;
    const countByStatus = (target) => registrations.filter(r => (r.status ?? '').toLowerCase() === target.toLowerCase()).length;
    const approved = countByStatus('approved');
    const pending = countByStatus('PENDING');
    const inQueue = countByStatus('IN_QUEUE');
    const rejected = countByStatus('rejected');
    const draft = countByStatus('DRAFT');
    const total = registrations.length;
    const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0;
    const label = (n) => `${n} · ${pct(n)}%`;
    return {
        total: String(total),
        approvedPct: pct(approved), approvedLabel: label(approved),
        pendingPct: pct(pending), pendingLabel: label(pending),
        inQueuePct: pct(inQueue), inQueueLabel: label(inQueue),
        rejectedPct: pct(rejected), rejectedLabel: label(rejected),
        draftPct: pct(draft), draftLabel: label(draft),
    };
};
const elements = {
    slug: 'sinch',
    functions: {
        sinch_activity_events,
        sinch_registration_counts,
    },
};
export default elements;
