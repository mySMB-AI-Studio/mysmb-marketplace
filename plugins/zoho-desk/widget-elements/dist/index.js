/** The statuses the Ticket Status Overview tile shows, in card order. */
const STATUSES = [
    { key: 'open', value: 'open' },
    { key: 'onHold', value: 'on hold' },
    { key: 'escalated', value: 'escalated' },
    { key: 'closed', value: 'closed' },
];
/**
 * Display-ready state for the Ticket Status Overview tile, from
 * `tickets_count_by_field` with `field: "status"`, which returns
 * `{ status: [{ value: "open", count: "3" }, ...] }` (counts are strings,
 * values lowercase). Statuses other than the four shown still count towards
 * the total.
 *
 * Spec: `{ "$computed": "zoho-desk_ticket_status_dashboard", "args": { "report": { "$state": "/zoho-desk/tickets_count_by_field" } } }`
 */
const ticket_status_dashboard = (args) => {
    const report = (args.report && typeof args.report === 'object' ? args.report : {});
    const loaded = Array.isArray(report.status);
    const counts = {};
    let total = 0;
    for (const row of loaded ? report.status : []) {
        const n = Number(row?.count) || 0;
        const value = String(row?.value ?? '').trim().toLowerCase();
        counts[value] = (counts[value] ?? 0) + n;
        total += n;
    }
    const out = {
        loaded,
        hasData: total > 0,
        total,
        totalLabel: `${total.toLocaleString('en-US')} ${total === 1 ? 'ticket' : 'tickets'} total`,
    };
    for (const s of STATUSES) {
        const n = counts[s.value] ?? 0;
        out[`${s.key}Display`] = n.toLocaleString('en-US');
        // Share of all tickets, for the bar on each card.
        out[`${s.key}Pct`] = total > 0 ? Math.round((n / total) * 100) : 0;
    }
    return out;
};
/** Rows shown in the ticket list (TILE-DISPLAY-STANDARDS §11). */
const MAX_TICKET_ROWS = 20;
const STATUS_TONE = {
    open: 'brand',
    'on hold': 'warning',
    escalated: 'destructive',
};
/** `ChevronUp` while the ticket list is open, else `ChevronDown`. */
const ticket_list_chevron = (args) => (args.expanded === true ? 'ChevronUp' : 'ChevronDown');
/**
 * Shows or hides the ticket list under the total. The first open fetches the
 * newest tickets with `list_tickets`; later toggles reuse them. Writes
 * `/ui/tickets/{expanded,loading,error,list,note}`.
 *
 * Spec: `{ "action": "zoho-desk_toggle_ticket_list", "params": {} }`
 */
async function toggleTicketList(_params, ctx) {
    const store = ctx.store;
    if (!store)
        return;
    const expanded = store.get('/ui/tickets/expanded') !== true;
    store.set('/ui/tickets/expanded', expanded);
    if (!expanded || Array.isArray(store.get('/ui/tickets/list')) || store.get('/ui/tickets/loading') === true)
        return;
    store.set('/ui/tickets/loading', true);
    store.set('/ui/tickets/error', '');
    try {
        const res = await fetch('/api/widgets-system/call-tool', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                mcp: 'zoho-desk',
                tool: 'list_tickets',
                params: { limit: MAX_TICKET_ROWS, sortBy: '-createdTime' },
            }),
        });
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        const body = (await res.json());
        const tickets = Array.isArray(body.data?.data) ? body.data.data : [];
        const list = tickets.map((t) => {
            const status = String(t.status ?? '').trim() || 'Unknown';
            return {
                id: String(t.id ?? t.ticketNumber),
                number: `#${String(t.ticketNumber ?? '')}`,
                subject: String(t.subject ?? '').trim() || '(No subject)',
                status,
                tone: STATUS_TONE[status.toLowerCase()] ?? 'muted',
            };
        });
        const total = Number(store.get('/ui/ticketStatus/total')) || 0;
        store.set('/ui/tickets/note', total > list.length ? `Showing ${list.length} of ${total.toLocaleString('en-US')} tickets, newest first.` : '');
        store.set('/ui/tickets/list', list);
    }
    catch {
        store.set('/ui/tickets/error', "Couldn't load the tickets. Please try again.");
    }
    finally {
        store.set('/ui/tickets/loading', false);
    }
}
const toggle_ticket_list = {
    description: 'Show or hide the newest Zoho Desk tickets (up to 20) under the ticket total, fetching them on first open.',
    schema: { type: 'object', properties: {} },
    handler: toggleTicketList,
};
/** Most tickets the Priority Breakdown tile reads (`list_tickets` max). */
const PRIORITY_TICKET_CAP = 100;
/** Priority rows, in order. Medium's bar is `chart-3` because `warning` renders brown in solid fills. */
const PRIORITIES = [
    { id: 'high', label: 'High', tone: 'destructive' },
    { id: 'medium', label: 'Medium', tone: 'chart-3' },
    { id: 'low', label: 'Low', tone: 'success' },
];
/**
 * Display-ready state for the Priority Breakdown tile, from `list_tickets`
 * with `status: "${OPEN}"` (Open and Escalated, not On Hold or Closed).
 * High, Medium and Low always show; a "No priority" row appears only when a
 * ticket has none (or one outside those three), so the rows add up to the total.
 *
 * Spec: `{ "$computed": "zoho-desk_priority_breakdown_dashboard", "args": { "report": { "$state": "/zoho-desk/list_tickets" }, "showList": { "$state": "/ui/showPriorityTickets" }, "showHigh": { "$state": "/ui/showHighTickets" } } }`
 */
const priority_breakdown_dashboard = (args) => {
    const report = (args.report && typeof args.report === 'object' ? args.report : {});
    const loaded = Array.isArray(report.data);
    const tickets = loaded ? report.data : [];
    const counts = {};
    for (const t of tickets) {
        const p = String(t?.priority ?? '').trim().toLowerCase();
        const id = PRIORITIES.some((x) => x.id === p) ? p : 'none';
        counts[id] = (counts[id] ?? 0) + 1;
    }
    const total = tickets.length;
    const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);
    const rows = PRIORITIES.map((x) => ({
        id: x.id,
        label: x.label,
        tone: x.tone,
        pct: pct(counts[x.id] ?? 0),
        countDisplay: (counts[x.id] ?? 0).toLocaleString('en-US'),
    }));
    if (counts.none) {
        rows.push({ id: 'none', label: 'No priority', tone: 'default', pct: pct(counts.none), countDisplay: counts.none.toLocaleString('en-US') });
    }
    const high = counts.high ?? 0;
    // Ticket list under the total, newest first (the provider sorts by -createdTime).
    const showList = args.showList === true;
    const toItem = (t) => {
        const status = String(t.status ?? '').trim() || 'Unknown';
        return {
            id: String(t.id ?? t.ticketNumber),
            number: `#${String(t.ticketNumber ?? '')}`,
            subject: String(t.subject ?? '').trim() || '(No subject)',
            status,
            tone: STATUS_TONE[status.toLowerCase()] ?? 'muted',
        };
    };
    const ticketList = tickets.slice(0, MAX_TICKET_ROWS).map(toItem);
    // High-priority tickets under the callout.
    const showHigh = args.showHigh === true;
    const highList = tickets
        .filter((t) => String(t?.priority ?? '').trim().toLowerCase() === 'high')
        .slice(0, MAX_TICKET_ROWS)
        .map(toItem);
    return {
        highExpanded: showHigh,
        // What a click on the callout writes to `/ui/showHighTickets`.
        highToggle: !showHigh,
        highChevron: showHigh ? 'ChevronUp' : 'ChevronDown',
        highList,
        highNote: showHigh && high > highList.length
            ? `Showing ${highList.length} of ${high.toLocaleString('en-US')} high-priority tickets, newest first.`
            : '',
        loaded,
        hasData: total > 0,
        rows,
        listExpanded: showList,
        // What a click on the total writes to `/ui/showPriorityTickets`.
        listToggle: !showList,
        listChevron: showList ? 'ChevronUp' : 'ChevronDown',
        ticketList,
        listNote: showList && total > ticketList.length
            ? `Showing ${ticketList.length} of ${total.toLocaleString('en-US')} tickets, newest first.`
            : '',
        highCount: high,
        alertText: `${high.toLocaleString('en-US')} high-priority ${high === 1 ? 'ticket needs' : 'tickets need'} attention first`,
        totalLabel: `${total.toLocaleString('en-US')} open ${total === 1 ? 'ticket' : 'tickets'} total`,
        capNote: total >= PRIORITY_TICKET_CAP ? `Based on the newest ${PRIORITY_TICKET_CAP} open tickets.` : '',
    };
};
const elements = {
    slug: 'zoho-desk',
    functions: {
        ticket_status_dashboard,
        ticket_list_chevron,
        priority_breakdown_dashboard,
    },
    actions: {
        toggle_ticket_list,
    },
};
export default elements;
