/** Age groups the Pending Signatures tile shows, in row order. `max` is the last day count in the group. */
const AGE_GROUPS = [
    { id: 'fresh', label: '0–2 days pending', tone: 'chart-3', countTone: 'default', max: 2 },
    { id: 'aging', label: '3–5 days pending', tone: 'warning', countTone: 'default', max: 5 },
    { id: 'overdue', label: '6+ days — overdue', tone: 'destructive', countTone: 'destructive', max: Infinity },
];
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DOC_ROWS = 20;
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Signer actions that still need doing; everything else (SIGNED, APPROVED, …) is finished. */
const DONE_ACTION = new Set(['SIGNED', 'APPROVED', 'VIEWED_AND_SIGNED', 'DECLINED']);
/** "05-Nov-26" in the viewer's time zone. */
function ddMmmYy(d) {
    return `${String(d.getDate()).padStart(2, '0')}-${MONTH_ABBR[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
}
/** Local midnight of an epoch-ms time. */
function startOfDay(ms) {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
/** Zoho Sign returns times as epoch milliseconds (number or numeric string). */
function toDate(v) {
    if (v === null || v === undefined || v === '')
        return null;
    const n = typeof v === 'number' ? v : /^\d+$/.test(String(v)) ? Number(v) : Date.parse(String(v));
    const d = new Date(n);
    return Number.isNaN(d.getTime()) ? null : d;
}
/** The `requests` array, whether the tool returns Zoho's body as-is or wrapped in `data`. */
function requestList(report) {
    if (Array.isArray(report.requests))
        return report.requests;
    const data = report.data;
    if (data && Array.isArray(data.requests))
        return data.requests;
    if (Array.isArray(report.data))
        return report.data;
    return null;
}
/** First signer still to act, in signing order. */
function nextSigner(r) {
    const actions = (Array.isArray(r.actions) ? r.actions : []);
    const waiting = actions
        .filter((a) => !DONE_ACTION.has(String(a.action_status ?? '').toUpperCase()))
        .filter((a) => String(a.action_type ?? 'SIGN').toUpperCase() !== 'VIEW')
        .sort((a, b) => (Number(a.signing_order) || 0) - (Number(b.signing_order) || 0));
    const a = waiting[0];
    if (!a)
        return '';
    return String(a.recipient_name ?? '').trim() || String(a.recipient_email ?? '').trim();
}
/**
 * Display-ready state for the Pending Signatures tile, from `list_requests`.
 * Keeps requests still in progress, ages each from when it was sent
 * (`sign_submitted_time`, else `created_time`) and groups them as 0–2 days,
 * 3–5 days or 6+ days overdue. `selected` is the group whose documents show
 * under its row.
 *
 * Spec: `{ "$computed": "zoho-sign_pending_signatures_dashboard", "args": { "report": { "$state": "/zoho-sign/list_requests" }, "selected": { "$state": "/ui/signBucket" } } }`
 */
const pending_signatures_dashboard = (args) => {
    // The MCP passes Zoho API failures (expired token, bad request) back as a plain error string.
    if (typeof args.report === 'string' && args.report.trim())
        return { loaded: false, failed: true, hasData: false };
    const report = (args.report && typeof args.report === 'object' ? args.report : {});
    const list = requestList(report);
    const loaded = list !== null;
    const all = list ?? [];
    const selected = typeof args.selected === 'string' ? args.selected : '';
    const now = Date.now();
    const pending = all
        .filter((r) => String(r.request_status ?? '').toLowerCase() === 'inprogress')
        .map((r) => {
        const sent = toDate(r.sign_submitted_time) ?? toDate(r.created_time);
        // Calendar days in the viewer's time zone, so "sent yesterday" reads 1 day even under 24 hours.
        const days = sent ? Math.max(0, Math.round((startOfDay(now) - startOfDay(sent.getTime())) / DAY_MS)) : 0;
        const group = AGE_GROUPS.find((g) => days <= g.max);
        return { r, sent, days, group };
    })
        // Longest waiting first.
        .sort((a, b) => b.days - a.days);
    const counts = { fresh: 0, aging: 0, overdue: 0 };
    for (const p of pending)
        counts[p.group.id] += 1;
    const total = pending.length;
    const inGroup = selected ? pending.filter((p) => p.group.id === selected) : [];
    const selectedDocs = inGroup.slice(0, MAX_DOC_ROWS).map(({ r, sent, days, group }) => {
        const signer = nextSigner(r);
        return {
            id: String(r.request_id ?? r.request_name ?? Math.random()),
            name: String(r.request_name ?? '').trim() || 'Untitled document',
            detail: [signer ? `Awaiting ${signer}` : 'Awaiting signer', sent ? `sent ${ddMmmYy(sent)}` : ''].filter(Boolean).join(' · '),
            ageText: days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`,
            tone: group.tone,
            badgeTone: group.id === 'overdue' ? 'destructive' : group.id === 'aging' ? 'warning' : 'muted',
        };
    });
    const pageContext = (report.page_context ?? report.data?.page_context);
    return {
        loaded,
        hasData: total > 0,
        totalDisplay: total.toLocaleString('en-US'),
        totalLabel: total === 1 ? 'document waiting on a signer' : 'documents waiting on a signer',
        rows: AGE_GROUPS.map((g) => ({
            id: g.id,
            label: g.label,
            tone: g.tone,
            countTone: counts[g.id] > 0 ? g.countTone : 'default',
            countDisplay: counts[g.id].toLocaleString('en-US'),
            expanded: g.id === selected,
            chevron: g.id === selected ? 'ChevronUp' : 'ChevronDown',
            // What a click on this row writes to `/ui/signBucket`.
            toggle: g.id === selected ? '' : g.id,
        })),
        selectedDocs,
        selectedEmpty: !!selected && selectedDocs.length === 0,
        selectedNote: inGroup.length > selectedDocs.length
            ? `Showing ${selectedDocs.length} of ${inGroup.length.toLocaleString('en-US')} documents, longest waiting first.`
            : '',
        capNote: pageContext?.has_more_rows === true ? `Based on the newest ${all.length.toLocaleString('en-US')} signature requests.` : '',
    };
};
/** Status groups the Document Status Tracker shows, in row and bar order. */
const DOC_STATUS_GROUPS = [
    { id: 'signed', label: 'Signed', tone: 'success' },
    { id: 'viewed', label: 'Viewed', tone: 'info' },
    { id: 'sent', label: 'Sent, not yet viewed', tone: 'muted' },
    { id: 'declined', label: 'Declined', tone: 'chart-3' },
    { id: 'expired', label: 'Expired', tone: 'destructive' },
];
const DOC_BADGE_TONE = {
    signed: 'success',
    viewed: 'info',
    sent: 'muted',
    declined: 'warning',
    expired: 'destructive',
};
/** Signer actions that mean the recipient has opened the document. */
const OPENED_ACTION = new Set(['VIEWED', 'SIGNED', 'APPROVED', 'VIEWED_AND_SIGNED', 'DECLINED']);
/** Signers (not view-only recipients) on a request. */
function signerActions(r) {
    const actions = (Array.isArray(r.actions) ? r.actions : []);
    return actions.filter((a) => String(a.action_type ?? 'SIGN').toUpperCase() !== 'VIEW');
}
/** Which tracker group a request falls in; null for drafts, recalled and deleted requests. */
function docStatusGroup(r) {
    const status = String(r.request_status ?? '').toLowerCase();
    if (status === 'completed')
        return 'signed';
    if (status === 'declined')
        return 'declined';
    if (status === 'expired')
        return 'expired';
    if (status !== 'inprogress')
        return null;
    const opened = signerActions(r).some((a) => OPENED_ACTION.has(String(a.action_status ?? '').toUpperCase()));
    return opened ? 'viewed' : 'sent';
}
/**
 * Display-ready state for the Document Status Tracker, from `list_requests`.
 * Keeps requests sent this calendar month (`sign_submitted_time`, viewer's
 * time zone), groups them as Signed, Viewed, Sent but not yet viewed,
 * Declined or Expired.
 * `selected` is the group whose documents show under its row.
 *
 * Spec: `{ "$computed": "zoho-sign_document_status_dashboard", "args": { "report": { "$state": "/zoho-sign/list_requests" }, "selected": { "$state": "/ui/docStatusGroup" } } }`
 */
const document_status_dashboard = (args) => {
    // The MCP passes Zoho API failures (expired token, bad request) back as a plain error string.
    if (typeof args.report === 'string' && args.report.trim())
        return { loaded: false, failed: true, hasData: false };
    const report = (args.report && typeof args.report === 'object' ? args.report : {});
    const list = requestList(report);
    const loaded = list !== null;
    const all = list ?? [];
    const selected = typeof args.selected === 'string' ? args.selected : '';
    const now = new Date();
    const sentThisMonth = all
        .map((r) => ({ r, sent: toDate(r.sign_submitted_time), group: docStatusGroup(r) }))
        .filter((d) => !!d.group && !!d.sent && d.sent.getFullYear() === now.getFullYear() && d.sent.getMonth() === now.getMonth())
        // Newest first.
        .sort((a, b) => b.sent.getTime() - a.sent.getTime());
    const counts = { signed: 0, viewed: 0, sent: 0, declined: 0, expired: 0 };
    for (const d of sentThisMonth)
        counts[d.group] += 1;
    const total = sentThisMonth.length;
    const inGroup = selected ? sentThisMonth.filter((d) => d.group === selected) : [];
    const selectedDocs = inGroup.slice(0, MAX_DOC_ROWS).map(({ r, sent, group }) => {
        const signers = signerActions(r);
        const recipients = signers
            .map((a) => String(a.recipient_name ?? '').trim() || String(a.recipient_email ?? '').trim())
            .filter(Boolean);
        const signed = signers.filter((a) => ['SIGNED', 'APPROVED', 'VIEWED_AND_SIGNED'].includes(String(a.action_status ?? '').toUpperCase())).length;
        return {
            id: String(r.request_id ?? r.request_name),
            name: String(r.request_name ?? '').trim() || 'Untitled document',
            detail: [recipients.length > 2 ? `${recipients[0]} +${recipients.length - 1}` : recipients.join(', '), `sent ${ddMmmYy(sent)}`]
                .filter(Boolean)
                .join(' · '),
            progressText: signers.length ? `${signed}/${signers.length} signed` : DOC_STATUS_GROUPS.find((g) => g.id === group).label,
            badgeTone: DOC_BADGE_TONE[group],
        };
    });
    const pageContext = report.page_context;
    return {
        loaded,
        hasData: total > 0,
        totalDisplay: total.toLocaleString('en-US'),
        totalLabel: total === 1 ? 'document sent this month' : 'documents sent this month',
        rows: DOC_STATUS_GROUPS.map((g) => ({
            id: g.id,
            label: g.label,
            tone: g.tone,
            countDisplay: counts[g.id].toLocaleString('en-US'),
            expanded: g.id === selected,
            chevron: g.id === selected ? 'ChevronUp' : 'ChevronDown',
            // What a click on this row writes to `/ui/docStatusGroup`.
            toggle: g.id === selected ? '' : g.id,
        })),
        selectedDocs,
        selectedEmpty: !!selected && selectedDocs.length === 0,
        selectedNote: inGroup.length > selectedDocs.length
            ? `Showing ${selectedDocs.length} of ${inGroup.length.toLocaleString('en-US')} documents, newest first.`
            : '',
        capNote: pageContext?.has_more_rows === true ? `Based on the newest ${all.length.toLocaleString('en-US')} signature requests.` : '',
    };
};
// Quick Send via Template -------------------------------------------------------------------
const TOP_TEMPLATES = 3;
// One categorical colour per listed template: blue, teal, violet, amber.
const TEMPLATE_TONES = ['chart-5', 'chart-2', 'chart-1', 'chart-3'];
/** Template id → name from a `list_templates` response. */
function templateNames(templates) {
    const t = (templates && typeof templates === 'object' ? templates : {});
    const list = Array.isArray(t.templates) ? t.templates : [];
    return new Map(list.map((x) => [String(x.template_id ?? ''), String(x.template_name ?? '').trim()]));
}
/** Names of the templates a request was created from (`templates_used` holds template names; ids or objects are also accepted). */
function templatesUsed(r, names) {
    const used = Array.isArray(r.templates_used) ? r.templates_used : [];
    return used
        .map((u) => {
        if (u && typeof u === 'object') {
            const o = u;
            return String(o.template_name ?? '').trim() || names.get(String(o.template_id ?? '')) || '';
        }
        const v = String(u ?? '').trim();
        return names.get(v) || v;
    })
        .map((n) => n || 'Unnamed template');
}
const quick_send_dashboard = (args) => {
    // The MCP passes Zoho API failures (expired token, bad request) back as a plain error string.
    if (typeof args.report === 'string' && args.report.trim())
        return { loaded: false, failed: true, hasData: false };
    const report = (args.report && typeof args.report === 'object' ? args.report : {});
    const list = requestList(report);
    const loaded = list !== null;
    const all = list ?? [];
    const names = templateNames(args.templates);
    const libraryOpen = args.libraryOpen === true || args.libraryOpen === 'open';
    const now = new Date();
    // Each document counts once, under the first template it was created from.
    const counts = new Map();
    for (const r of all) {
        const sent = toDate(r.sign_submitted_time);
        if (!sent || sent.getFullYear() !== now.getFullYear() || sent.getMonth() !== now.getMonth())
            continue;
        const [name] = templatesUsed(r, names);
        if (name)
            counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const total = ranked.reduce((n, [, c]) => n + c, 0);
    const top = ranked.length > TOP_TEMPLATES + 1 ? ranked.slice(0, TOP_TEMPLATES) : ranked;
    const otherCount = ranked.slice(top.length).reduce((n, [, c]) => n + c, 0);
    const rows = top.map(([label, count], i) => ({
        id: `t${i}`,
        label,
        tone: TEMPLATE_TONES[i % TEMPLATE_TONES.length],
        countDisplay: count.toLocaleString('en-US'),
    }));
    if (otherCount)
        rows.push({ id: 'other', label: 'Other templates', tone: 'muted', countDisplay: otherCount.toLocaleString('en-US') });
    // Library size: only once `list_templates` has answered with a real response.
    const tpl = (args.templates && typeof args.templates === 'object' ? args.templates : null);
    const tplContext = tpl?.page_context;
    const libraryCount = tpl && Array.isArray(tpl.templates)
        ? typeof tplContext?.total_count === 'number'
            ? tplContext.total_count
            : tpl.templates.length
        : null;
    // Library drill-down: most used this month first, then by name.
    const libraryList = tpl && Array.isArray(tpl.templates) ? tpl.templates : [];
    const libraryRows = libraryList
        .map((t) => {
        const name = String(t.template_name ?? '').trim() || 'Unnamed template';
        const roles = (Array.isArray(t.actions) ? t.actions : [])
            .map((a) => String(a.role ?? a.recipient_name ?? '').trim())
            .filter(Boolean);
        const updated = toDate(t.modified_time ?? t.created_time);
        const sent = counts.get(name) ?? 0;
        return {
            id: String(t.template_id ?? name),
            name,
            detail: [roles.length > 2 ? `${roles[0]} +${roles.length - 1}` : roles.join(', '), updated ? `updated ${ddMmmYy(updated)}` : '']
                .filter(Boolean)
                .join(' · '),
            sent,
            usageText: `${sent.toLocaleString('en-US')} sent`,
            badgeTone: sent > 0 ? 'brand' : 'muted',
        };
    })
        .sort((a, b) => b.sent - a.sent || a.name.localeCompare(b.name));
    const shownTemplates = libraryRows.slice(0, MAX_DOC_ROWS);
    const pageContext = report.page_context;
    return {
        loaded,
        hasData: total > 0,
        totalDisplay: total.toLocaleString('en-US'),
        totalLabel: 'sent via template this month',
        rows,
        libraryDisplay: libraryCount === null ? '' : libraryCount.toLocaleString('en-US'),
        libraryExpanded: libraryOpen,
        libraryChevron: libraryOpen ? 'ChevronUp' : 'ChevronDown',
        // What a click on the library row writes to `/ui/quickSendLibrary`.
        libraryToggle: libraryOpen ? '' : 'open',
        libraryTemplates: shownTemplates,
        libraryEmpty: libraryOpen && shownTemplates.length === 0,
        libraryNote: libraryCount !== null && libraryCount > shownTemplates.length && shownTemplates.length > 0
            ? `Showing ${shownTemplates.length} of ${libraryCount.toLocaleString('en-US')} templates.`
            : '',
        capNote: pageContext?.has_more_rows === true ? `Based on the newest ${all.length.toLocaleString('en-US')} signature requests.` : '',
    };
};
const elements = {
    slug: 'zoho-sign',
    functions: {
        pending_signatures_dashboard,
        document_status_dashboard,
        quick_send_dashboard,
    },
    actions: {},
};
export default elements;
