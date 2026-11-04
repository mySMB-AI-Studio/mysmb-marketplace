const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const n = (v) => {
    const x = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(x) ? x : 0;
};
const s = (v) => (v === null || v === undefined ? '' : String(v));
// ── Formatting helpers ────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** YYYY-MM-DD (or ISO) → dd-Mmm-yy (§1). Plain dates are not timezone-shifted. */
export function fmtDate(value) {
    const raw = s(value);
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m)
        return '';
    return `${m[3]}-${MONTHS[Number(m[2]) - 1]}-${m[1].slice(2)}`;
}
/** Amount → A$1,234.56 / £1,234.56 (§2: symbol prefix, 2dp). */
export function fmtMoney(value, currency, fractionDigits = 2) {
    const code = s(currency) === 'GBP' ? 'GBP' : 'AUD';
    const symbol = code === 'GBP' ? '£' : 'A$';
    const amount = n(value);
    const body = Math.abs(amount).toLocaleString('en-AU', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    });
    return `${amount < 0 ? '-' : ''}${symbol}${body}`;
}
/** Compact money for tight labels: A$12.4k */
function fmtMoneyShort(value, currency) {
    const amount = n(value);
    if (Math.abs(amount) < 10_000)
        return fmtMoney(amount, currency, 0);
    const symbol = s(currency) === 'GBP' ? '£' : 'A$';
    return `${symbol}${(amount / 1000).toFixed(1)}k`;
}
const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const hours = (h) => {
    const v = n(h);
    return `${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10} h`;
};
/** Days between two YYYY-MM-DD dates (b - a). */
function dayDiff(a, b) {
    return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
/** "3h ago" style, from an ISO timestamp, relative to now. */
function ago(iso, now = Date.now()) {
    const t = Date.parse(s(iso));
    if (!Number.isFinite(t))
        return '';
    const mins = Math.max(0, Math.round((now - t) / 60_000));
    if (mins < 1)
        return 'Just now';
    if (mins < 60)
        return `${mins}m ago`;
    const h = Math.round(mins / 60);
    if (h < 24)
        return `${h}h ago`;
    const d = Math.round(h / 24);
    if (d < 30)
        return `${d}d ago`;
    return fmtDate(new Date(t).toISOString());
}
const joinDot = (...parts) => parts.map(s).filter(Boolean).join(' · ');
/**
 * Due-date wording + tone, matching WorkQ's overdue escalation (§7):
 * muted before the due date → warning on the day → destructive after.
 */
function dueLabel(dueYmd, today) {
    if (!dueYmd)
        return { text: 'No due date', tone: 'muted' };
    const d = dayDiff(today, dueYmd);
    if (d < 0)
        return { text: `${-d}d overdue`, tone: 'destructive' };
    if (d === 0)
        return { text: 'Due today', tone: 'warning' };
    if (d === 1)
        return { text: 'Tomorrow', tone: 'muted' };
    if (d < 7)
        return { text: `${DAYS[new Date(`${dueYmd}T00:00:00Z`).getUTCDay()]} ${fmtDate(dueYmd)}`, tone: 'muted' };
    return { text: fmtDate(dueYmd), tone: 'muted' };
}
const CHART_TONES = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'];
/** Segmented-bar template (§10): zero segments are left out entirely. */
function segTemplate(values) {
    const total = values.reduce((a, b) => a + b, 0);
    if (total <= 0)
        return 'minmax(0, 1fr)';
    return values
        .filter((v) => v > 0)
        .map((v) => `minmax(0, ${Math.max(1, Math.round((v / total) * 1000))}fr)`)
        .join(' ');
}
// ── 1. Open jobs by state ─────────────────────────────────────────────────
const jobs_state_dashboard = (args) => {
    const totals = obj(args.totals);
    const byState = arr(args.by_state);
    const today = s(args.as_of);
    // Donut: top 4 states + "Other" (§10: 2–5 parts). On-hold states read muted.
    const top = byState.slice(0, 4);
    const rest = byState.slice(4).reduce((a, r) => a + n(r.count), 0);
    let toneIdx = 0;
    const ring = top.map((r) => ({
        label: s(r.state),
        value: n(r.count),
        tone: s(r.type) === 'on_hold' ? 'muted' : CHART_TONES[toneIdx++ % CHART_TONES.length],
    }));
    if (rest > 0)
        ring.push({ label: 'Other', value: rest, tone: 'muted' });
    const overdueRows = arr(args.overdue)
        .slice(0, 4)
        .map((j) => ({
        id: s(j.id),
        title: s(j.name) || 'Untitled job',
        subtitle: joinDot(j.client_name, j.manager ?? 'Unassigned', j.job_state),
        valueText: `${n(j.days_overdue)}d overdue`,
    }));
    const overdue = n(totals.overdue);
    return {
        ring,
        open: n(totals.open),
        heroSub: joinDot(plural(overdue, 'overdue', 'overdue'), `${n(totals.due_soon)} due this week`, `${n(totals.on_hold)} on hold`),
        hasOverdue: overdue > 0,
        overdueTitle: overdue > 4 ? `Most overdue · ${overdue} in total` : 'Overdue',
        overdueRows,
        footerLeft: `${plural(n(args.jobs_read), 'job')} read${args.truncated ? ' (capped)' : ''}`,
        footerRight: today ? `As of ${fmtDate(today)}` : '',
    };
};
// ── 2. Recent jobs ────────────────────────────────────────────────────────
const recent_jobs_dashboard = (args) => {
    const rows = arr(args.recent).map((j) => ({
        id: s(j.id),
        title: s(j.name) || 'Untitled job',
        subtitle: joinDot(j.client_name, j.manager ?? 'Unassigned'),
        state: s(j.job_state) || 'No state',
        due: dueLabel(s(j.due_date), s(args.as_of)),
        updated: ago(j.last_modified_on),
    }));
    return {
        rows: rows.map(({ due, ...r }) => ({ ...r, dueText: due.text, dueTone: due.tone })),
        count: rows.length,
        footerLeft: `${plural(n(args.jobs_read), 'job')} read${args.truncated ? ' (capped)' : ''}`,
        footerRight: s(args.as_of) ? `As of ${fmtDate(args.as_of)}` : '',
    };
};
// ── 3. Open tasks due soon ────────────────────────────────────────────────
const tasks_dashboard = (args) => {
    const totals = obj(args.totals);
    const today = s(args.as_of);
    const cards = [
        { key: 'overdue', label: 'Overdue', value: n(totals.overdue), tone: n(totals.overdue) > 0 ? 'destructive' : 'muted' },
        { key: 'today', label: 'Due today', value: n(totals.due_today), tone: n(totals.due_today) > 0 ? 'warning' : 'muted' },
        { key: 'soon', label: `Next ${n(args.due_soon_days) || 7} days`, value: n(totals.due_soon), tone: 'default' },
    ];
    const rows = arr(args.upcoming)
        .slice(0, 6)
        .map((t) => {
        const due = dueLabel(s(t.due_local) || s(t.due_date).slice(0, 10), today);
        return {
            id: s(t.id),
            title: s(t.subject) || 'Untitled task',
            subtitle: joinDot(t.client_name, t.assigned_to ?? 'Unassigned'),
            dueText: due.text,
            tone: due.tone,
        };
    });
    return {
        cards,
        rows,
        hasRows: rows.length > 0,
        footerLeft: `${plural(n(totals.open), 'open task')}${n(totals.no_due_date) ? ` · ${n(totals.no_due_date)} undated` : ''}`,
        footerRight: today ? `As of ${fmtDate(today)}` : '',
    };
};
// ── 4. Recently filed documents ───────────────────────────────────────────
const documents_dashboard = (args) => {
    const totals = obj(args.totals);
    const today = s(args.as_of);
    const byDay = arr(args.by_day);
    const max = Math.max(1, ...byDay.map((d) => n(d.count)));
    const days = byDay.map((d) => {
        const date = s(d.date);
        const isToday = date === today;
        return {
            key: date,
            count: n(d.count),
            pct: Math.round((n(d.count) / max) * 100),
            dayLabel: DAYS[new Date(`${date}T00:00:00Z`).getUTCDay()] ?? '',
            sub: date.slice(8, 10),
            isToday,
        };
    });
    const rows = arr(args.recent)
        .slice(0, 5)
        .map((d) => ({
        id: s(d.id),
        title: s(d.name) || 'Untitled document',
        subtitle: joinDot(d.client_name, d.document_type, d.cabinet),
        savedText: ago(d.last_saved_on ?? d.created_on),
    }));
    const topType = arr(args.by_type)[0];
    return {
        filed: n(totals.filed),
        heroSub: joinDot(`${n(totals.today)} today`, topType ? `mostly ${s(topType.document_type)}` : ''),
        days,
        dayCount: days.length || 1,
        rows,
        footerLeft: `${plural(n(totals.filed), 'document')} in ${n(args.days) || days.length} days${args.truncated ? ' (capped)' : ''}`,
        footerRight: today ? `As of ${fmtDate(today)}` : '',
    };
};
// ── 5. Outstanding invoices ───────────────────────────────────────────────
const invoices_dashboard = (args) => {
    const totals = obj(args.totals);
    const currency = s(args.currency) || 'AUD';
    const aging = new Map(arr(args.aging).map((b) => [s(b.bucket), b]));
    const amt = (k) => n(aging.get(k)?.amount);
    const cnt = (k) => n(aging.get(k)?.count);
    // Three bar segments (§7: overdue = destructive from the day after due; 1–30 days kept warning so the bar stays readable).
    const segs = [
        { key: 'current', label: 'Not yet due', amount: amt('current'), count: cnt('current'), tone: 'muted' },
        { key: 'early', label: '1–30 days', amount: amt('1-30'), count: cnt('1-30'), tone: 'warning' },
        {
            key: 'late',
            label: '31+ days',
            amount: amt('31-60') + amt('61-90') + amt('90+'),
            count: cnt('31-60') + cnt('61-90') + cnt('90+'),
            tone: 'destructive',
        },
    ];
    const rows = arr(args.top)
        .slice(0, 5)
        .map((i) => {
        const daysOverdue = n(i.days_overdue);
        return {
            id: s(i.id),
            title: s(i.client_name) || 'Unknown customer',
            subtitle: joinDot(i.invoice_number, i.due_date ? `Due ${fmtDate(i.due_date)}` : ''),
            amountText: fmtMoney(i.amount_outstanding, currency),
            dueText: daysOverdue > 0 ? `${daysOverdue}d overdue` : 'Not yet due',
            tone: daysOverdue > 0 ? 'destructive' : 'muted',
        };
    });
    return {
        outstandingText: fmtMoney(totals.outstanding, currency),
        heroSub: joinDot(`${fmtMoney(totals.overdue_amount, currency)} overdue`, plural(n(totals.overdue_count), 'invoice')),
        hasOverdue: n(totals.overdue_count) > 0,
        barTemplate: segTemplate(segs.map((x) => x.amount)),
        showCurrent: segs[0].amount > 0,
        showEarly: segs[1].amount > 0,
        showLate: segs[2].amount > 0,
        legend: segs.map((x) => ({ key: x.key, label: x.label, tone: x.tone, amountText: fmtMoneyShort(x.amount, currency), countText: plural(x.count, 'inv', 'inv') })),
        over90Text: amt('90+') > 0 ? `${fmtMoney(amt('90+'), currency)} is more than 90 days overdue` : '',
        rows,
        footerLeft: `${plural(n(totals.open_count), 'open invoice')}${args.truncated ? ' (capped)' : ''}`,
        footerRight: s(args.as_of) ? `As of ${fmtDate(args.as_of)}` : '',
    };
};
// ── 6. Chargeable time this month ─────────────────────────────────────────
const time_dashboard = (args) => {
    const totals = obj(args.totals);
    const currency = s(args.currency) || 'AUD';
    const users = arr(args.by_user);
    const max = Math.max(0.01, ...users.map((u) => n(u.chargeable_hours)));
    const rows = users.slice(0, 6).map((u) => {
        const h = n(u.hours);
        const c = n(u.chargeable_hours);
        return {
            key: s(u.user_id) || s(u.user_name),
            name: s(u.user_name) || 'Unknown',
            pct: Math.round((c / max) * 100),
            hoursText: hours(c),
            shareText: h > 0 ? `${Math.round((c / h) * 100)}%` : '–',
        };
    });
    const from = s(args.from);
    const to = s(args.to);
    return {
        chargeableText: hours(totals.chargeable_hours),
        pct: n(totals.chargeable_pct),
        pctText: `${n(totals.chargeable_pct)}%`,
        heroSub: joinDot(`of ${hours(totals.hours)} recorded`, `${fmtMoney(totals.billable_amount, currency, 0)} billable`),
        rows,
        hasRows: rows.length > 0,
        period: from && to ? `${fmtDate(from)} – ${fmtDate(to)}` : '',
        footerLeft: `${plural(n(totals.entries), 'time entry', 'time entries')}${n(totals.draft_entries) ? ` · ${n(totals.draft_entries)} draft` : ''}${args.truncated ? ' (capped)' : ''}`,
        footerRight: s(args.as_of) ? `As of ${fmtDate(args.as_of)}` : '',
    };
};
// ── 7. Workload by manager ────────────────────────────────────────────────
const workload_dashboard = (args) => {
    const managers = arr(args.by_manager);
    const rows = managers.slice(0, 7).map((m) => {
        const open = n(m.open);
        const overdue = n(m.overdue);
        const soon = n(m.due_soon);
        const other = Math.max(0, open - overdue - soon);
        return {
            key: s(m.manager_id) || s(m.manager),
            name: s(m.manager) || 'Unassigned',
            openText: plural(open, 'job'),
            overdueText: overdue > 0 ? `${overdue} overdue` : '',
            template: segTemplate([overdue, soon, other]),
            showOverdue: overdue > 0,
            showSoon: soon > 0,
            showOther: other > 0,
        };
    });
    const totals = obj(args.totals);
    const top = rows[0];
    return {
        rows,
        heroSub: top ? `Busiest: ${top.name} · ${top.openText}` : '',
        managers: managers.length,
        footerLeft: `${plural(n(totals.open), 'open job')} across ${plural(managers.length, 'manager')}`,
        footerRight: s(args.as_of) ? `As of ${fmtDate(args.as_of)}` : '',
    };
};
const elements = {
    slug: 'fyi',
    functions: {
        jobs_state_dashboard,
        recent_jobs_dashboard,
        tasks_dashboard,
        documents_dashboard,
        invoices_dashboard,
        time_dashboard,
        workload_dashboard,
    },
};
export default elements;
