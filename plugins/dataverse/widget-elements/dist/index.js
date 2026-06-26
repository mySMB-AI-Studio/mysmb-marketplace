/**
 * dataverse — widget-elements module
 *
 * Helpers tailored to Dataverse OData payload shapes:
 *  - Opportunity `salesstagecode` is a global option-set int. The
 *    default ships with four stages (Qualify=0, Develop=1, Propose=2,
 *    Close=3). Tenants can extend it — for v1 we hardcode the
 *    defaults; a future helper can call `describe_picklist` to fetch
 *    the tenant's actual labels.
 *  - `estimatedvalue` is a money column (number) and
 *    `closeprobability` is an int 0-100 — weighted forecast is
 *    `estimatedvalue * closeprobability / 100`.
 *  - `customerid_account` arrives as a nested object when fetched
 *    with `$expand=customerid_account($select=name)`.
 */
// ── Stage labels ────────────────────────────────────────────────────
//
// Default D365 Sales `salesstagecode` option-set values. Tone palette
// mirrors the AR-aging pattern from xero-accounting: more advanced
// stages get warmer tones culminating in success at close.
const STAGE_ORDER = [0, 1, 2, 3];
const STAGE_LABELS = {
    0: { label: 'Qualify', tone: 'muted' },
    1: { label: 'Develop', tone: 'info' },
    2: { label: 'Propose', tone: 'warning' },
    3: { label: 'Close', tone: 'success' },
};
function asOppArray(value) {
    return Array.isArray(value) ? value : [];
}
function weightedValueOf(op) {
    const v = Number(op.estimatedvalue ?? 0);
    const p = Number(op.closeprobability ?? 0);
    if (!Number.isFinite(v) || !Number.isFinite(p))
        return 0;
    return v * (p / 100);
}
// ── pipeline_stages ─────────────────────────────────────────────────
//
// Group opportunities by `salesstagecode` into the four default
// stages and return a fixed-order array so the widget can render a
// stable shape — even buckets with zero opportunities are emitted so
// the layout doesn't flicker as deals move.
//
// Args: { value: Opportunity[] }
// Returns: Array<{ key, code, count, total, weighted, tone }>
const pipeline_stages = (args) => {
    const opps = asOppArray(args.value);
    const buckets = new Map();
    for (const code of STAGE_ORDER) {
        buckets.set(code, { count: 0, total: 0, weighted: 0 });
    }
    for (const op of opps) {
        const code = typeof op.salesstagecode === 'number' ? op.salesstagecode : 0;
        if (!buckets.has(code))
            buckets.set(code, { count: 0, total: 0, weighted: 0 });
        const b = buckets.get(code);
        b.count += 1;
        b.total += Number(op.estimatedvalue ?? 0) || 0;
        b.weighted += weightedValueOf(op);
    }
    return STAGE_ORDER.map((code) => {
        const b = buckets.get(code);
        const meta = STAGE_LABELS[code] ?? { label: `Stage ${code}`, tone: 'muted' };
        return {
            key: meta.label,
            code,
            count: b.count,
            total: b.total,
            weighted: b.weighted,
            tone: meta.tone,
        };
    });
};
// ── ops_in_stage ────────────────────────────────────────────────────
//
// Filter the opportunity list down to a single stage. We accept the
// stage *label* (e.g. "Qualify") rather than the numeric code so the
// widget's `selectedStage` state can stay human-readable.
//
// Args: { value: Opportunity[], stage: string }
const ops_in_stage = (args) => {
    const opps = asOppArray(args.value);
    const wanted = typeof args.stage === 'string' ? args.stage : '';
    if (!wanted)
        return [];
    const entry = Object.entries(STAGE_LABELS).find(([, v]) => v.label === wanted);
    if (!entry)
        return [];
    const code = Number(entry[0]);
    return opps.filter((op) => Number(op.salesstagecode ?? 0) === code);
};
// ── weighted ────────────────────────────────────────────────────────
//
// Compute the weighted value of one opportunity: estimated value
// scaled by the close probability percentage. Used inline so each
// opportunity row can show its own forecast contribution.
//
// Args: { value: number, probability: number (0-100) }
const weighted = (args) => {
    const v = Number(args.value ?? 0);
    const p = Number(args.probability ?? 0);
    if (!Number.isFinite(v) || !Number.isFinite(p))
        return 0;
    return v * (p / 100);
};
// ── close_label ─────────────────────────────────────────────────────
//
// Friendly relative-time label for an estimated close date:
//   "closes today" / "closes in 14d" / "14d past due" / "no date"
// Mirrors the spirit of the xero-accounting overdue_label helper.
//
// Args: { value: string | undefined } — ISO date
const close_label = (args) => {
    const raw = args.value;
    if (!raw || typeof raw !== 'string')
        return 'no date';
    const ms = Date.parse(raw);
    if (!Number.isFinite(ms))
        return 'no date';
    const day = 24 * 60 * 60 * 1000;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(ms);
    target.setHours(0, 0, 0, 0);
    const diff = Math.round((target.getTime() - today.getTime()) / day);
    if (diff === 0)
        return 'closes today';
    if (diff > 0)
        return `closes in ${diff}d`;
    return `${-diff}d past due`;
};
// ── close_tone ──────────────────────────────────────────────────────
//
// Tone for a close-date badge — flags slipping deals visually.
//
// Args: { value: string | undefined } — ISO date
const close_tone = (args) => {
    const raw = args.value;
    if (!raw || typeof raw !== 'string')
        return 'muted';
    const ms = Date.parse(raw);
    if (!Number.isFinite(ms))
        return 'muted';
    const day = 24 * 60 * 60 * 1000;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(ms);
    target.setHours(0, 0, 0, 0);
    const diff = Math.round((target.getTime() - today.getTime()) / day);
    if (diff < 0)
        return 'destructive';
    if (diff <= 7)
        return 'warning';
    return 'muted';
};
// ── task_overdue_count ───────────────────────────────────────────────
//
// Count tasks where scheduledend is in the past (overdue).
//
// Args: { value: unknown[] }
const task_overdue_count = (args) => {
    const tasks = Array.isArray(args.value)
        ? args.value
        : [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return tasks.filter((t) => {
        const due = t.scheduledend;
        if (!due || typeof due !== 'string')
            return false;
        const d = new Date(due);
        return !isNaN(d.getTime()) && d < today;
    }).length;
};
// ── task_priority_label ──────────────────────────────────────────────
//
// Human-readable priority label from Dataverse task prioritycode.
// Widget spec: 1=High, 2=Normal, 3=Low.
//
// Args: { value: number }
const task_priority_label = (args) => {
    const code = Number(args.value);
    if (code === 1)
        return 'High';
    if (code === 2)
        return 'Normal';
    if (code === 3)
        return 'Low';
    return '';
};
// ── task_priority_tone ───────────────────────────────────────────────
//
// Tone badge colour for task priority.
// 1=High → destructive, 2=Normal → muted, 3=Low → info.
//
// Args: { value: number }
const task_priority_tone = (args) => {
    const code = Number(args.value);
    if (code === 1)
        return 'destructive';
    if (code === 3)
        return 'info';
    return 'muted';
};
// ── account_risk_label ───────────────────────────────────────────────
//
// Risk label based on days since modifiedon:
//   ≥30 days → "At Risk", ≥14 days → "Warning", else "".
//
// Args: { value: string | undefined } — ISO datetime (modifiedon)
const account_risk_label = (args) => {
    const raw = args.value;
    if (!raw || typeof raw !== 'string')
        return '';
    const ms = Date.parse(raw);
    if (!Number.isFinite(ms))
        return '';
    const daysSince = Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
    if (daysSince >= 30)
        return 'At Risk';
    if (daysSince >= 14)
        return 'Warning';
    return '';
};
// ── account_risk_tone ────────────────────────────────────────────────
//
// Tone for the account risk badge.
//   ≥30 days → destructive, ≥14 days → warning, else muted.
//
// Args: { value: string | undefined } — ISO datetime (modifiedon)
const account_risk_tone = (args) => {
    const raw = args.value;
    if (!raw || typeof raw !== 'string')
        return 'muted';
    const ms = Date.parse(raw);
    if (!Number.isFinite(ms))
        return 'muted';
    const daysSince = Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
    if (daysSince >= 30)
        return 'destructive';
    if (daysSince >= 14)
        return 'warning';
    return 'muted';
};
// ── activity_type_icon ───────────────────────────────────────────────
//
// Lucide icon name for a Dataverse activitytypecode string.
//
// Args: { value: string | undefined }
const activity_type_icon = (args) => {
    switch (String(args.value ?? '').toLowerCase()) {
        case 'email': return 'Mail';
        case 'phonecall': return 'Phone';
        case 'task': return 'CheckSquare';
        case 'appointment': return 'Calendar';
        case 'letter': return 'FileText';
        case 'fax': return 'Printer';
        default: return 'Activity';
    }
};
// ── qa_grade_tone ────────────────────────────────────────────────────
//
// Tone for a QA grade badge.
// PASS → success, NEEDS COACHING → warning, FAIL → destructive.
//
// Args: { value: string | undefined }
const qa_grade_tone = (args) => {
    const grade = String(args.value ?? '').toUpperCase();
    if (grade === 'PASS')
        return 'success';
    if (grade === 'NEEDS COACHING')
        return 'warning';
    if (grade === 'FAIL')
        return 'destructive';
    return 'muted';
};
// ── qa_score_tone ────────────────────────────────────────────────────
//
// Tone for a QA numeric score badge.
// ≥80 → success, ≥60 → warning, <60 → destructive.
//
// Args: { value: number | undefined }
const qa_score_tone = (args) => {
    const score = Number(args.value ?? 0);
    if (score >= 80)
        return 'success';
    if (score >= 60)
        return 'warning';
    return 'destructive';
};
// ── Owner-grouped "All opportunities" helpers ────────────────────────
//
// These back the dataverse-opportunities-by-owner widget. The pipeline
// tool now returns owner_name + modifiedon per deal, so we can group by
// owner / stage / age and flag stalled deals (no movement in 30+ days,
// reusing the account-at-risk thresholds above).
const DAY_MS = 24 * 60 * 60 * 1000;
function daysSince(raw) {
    if (!raw || typeof raw !== 'string')
        return null;
    const ms = Date.parse(raw);
    if (!Number.isFinite(ms))
        return null;
    return Math.floor((Date.now() - ms) / DAY_MS);
}
function stageMeta(code) {
    const c = Number(code);
    return STAGE_LABELS[c] ?? { label: Number.isFinite(c) ? `Stage ${c}` : 'Unknown', tone: 'muted' };
}
function ageMeta(modifiedon) {
    const d = daysSince(modifiedon);
    if (d == null)
        return { label: 'No activity', tone: 'muted', bucket: 'Stalled (30d+)', sort: 0 };
    if (d >= 30)
        return { label: `Stalled · ${d}d`, tone: 'destructive', bucket: 'Stalled (30d+)', sort: 0 };
    if (d >= 14)
        return { label: `Watch · ${d}d`, tone: 'warning', bucket: 'Watch (14–29d)', sort: 1 };
    return { label: `Fresh · ${d}d`, tone: 'success', bucket: 'Fresh (<14d)', sort: 2 };
}
function sumValue(opps) {
    return opps.reduce((t, o) => t + (Number(o.estimatedvalue ?? 0) || 0), 0);
}
function accountNameOf(o) {
    return o.customerid_account?.name ?? '';
}
function initialsOf(name) {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length)
        return '—';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (parts[0][0] + last).toUpperCase();
}
// ── stage_label / stage_tone ─────────────────────────────────────────
//
// Resolve a deal's salesstagecode to its display label / badge tone.
//
// Args: { value: number } — salesstagecode
//
// Spec example:
//   { "$computed": "dataverse_stage_label", "args": { "value": { "$item": "salesstagecode" } } }
const stage_label = (args) => stageMeta(args.value).label;
const stage_tone = (args) => stageMeta(args.value).tone;
// ── age_label / age_tone ─────────────────────────────────────────────
//
// Days-since-last-touched badge for a deal: "Fresh · 4d" / "Watch · 21d"
// / "Stalled · 48d". Uses modifiedon as the activity signal.
//
// Args: { value: string } — ISO datetime (modifiedon)
//
// Spec example:
//   { "$computed": "dataverse_age_label", "args": { "value": { "$item": "modifiedon" } } }
const age_label = (args) => ageMeta(args.value).label;
const age_tone = (args) => ageMeta(args.value).tone;
// ── count_stalled ────────────────────────────────────────────────────
//
// Count opportunities not touched in 30+ days (the "stalled" header stat).
//
// Args: { value: Opportunity[] }
//
// Spec example:
//   { "$computed": "dataverse_count_stalled", "args": { "value": { "$state": "/dataverse/list_opportunity_pipeline/items" } } }
const count_stalled = (args) => {
    const opps = asOppArray(args.value);
    return opps.filter((o) => {
        const d = daysSince(o.modifiedon);
        return d != null && d >= 30;
    }).length;
};
// ── is_mode ──────────────────────────────────────────────────────────
//
// Highlight helper for the group-by segmented control. Returns true when
// the current groupBy state equals `mode`, treating an empty/undefined
// state as the default 'owner' mode so the Owner chip is lit on first
// paint without having to seed state (which would clobber on refetch).
//
// Args: { value: string (current /ui/groupBy), mode: string }
//
// Spec example:
//   { "$computed": "dataverse_is_mode", "args": { "value": { "$state": "/ui/groupBy" }, "mode": "owner" } }
const is_mode = (args) => {
    const current = args.value == null || args.value === '' ? 'owner' : String(args.value);
    return current === String(args.mode);
};
// ── group_opportunities ──────────────────────────────────────────────
//
// Flatten opportunities into a single render list of header + deal rows
// so the widget can show every group expanded inline with one repeat.
// Each group emits a header row (with count/stalled/total rollups) followed
// by its deal rows (pre-computed stage + age badges + amount). Owner groups
// sort by total value desc; stage/age groups use their natural order.
//
// Args: { value: Opportunity[], mode?: 'owner' | 'stage' | 'age', search?: string }
// Returns: Array<{ rowkey, kind: 'header' | 'deal', ... }>
//
// Spec example:
//   { "$computed": "dataverse_group_opportunities", "args": {
//       "value": { "$state": "/dataverse/list_opportunity_pipeline/items" },
//       "mode":  { "$state": "/ui/groupBy" },
//       "search":{ "$state": "/ui/search" } } }
const group_opportunities = (args) => {
    const opps = (Array.isArray(args.value) ? args.value : []);
    const mode = args.mode === 'stage' || args.mode === 'age' ? args.mode : 'owner';
    const search = String(args.search ?? '').trim().toLowerCase();
    const filtered = search
        ? opps.filter((o) => `${o.name ?? ''} ${accountNameOf(o)} ${o.owner_name ?? ''}`.toLowerCase().includes(search))
        : opps;
    const groups = new Map();
    for (const o of filtered) {
        let key;
        let label;
        let sort;
        let initials = '';
        if (mode === 'stage') {
            const m = stageMeta(o.salesstagecode);
            key = m.label;
            label = m.label;
            const idx = STAGE_ORDER.indexOf(Number(o.salesstagecode));
            sort = idx < 0 ? 99 : idx;
        }
        else if (mode === 'age') {
            const m = ageMeta(o.modifiedon);
            key = m.bucket;
            label = m.bucket;
            sort = m.sort;
        }
        else {
            const name = o.owner_name && String(o.owner_name).trim() ? String(o.owner_name) : 'Unassigned';
            key = name;
            label = name;
            sort = 0;
            initials = initialsOf(name);
        }
        let g = groups.get(key);
        if (!g) {
            g = { key, label, sort, initials, deals: [] };
            groups.set(key, g);
        }
        g.deals.push(o);
    }
    const groupArr = [...groups.values()];
    if (mode === 'owner') {
        groupArr.sort((a, b) => sumValue(b.deals) - sumValue(a.deals));
    }
    else {
        groupArr.sort((a, b) => a.sort - b.sort);
    }
    const out = [];
    for (const g of groupArr) {
        const deals = g.deals
            .slice()
            .sort((a, b) => (daysSince(b.modifiedon) ?? -1) - (daysSince(a.modifiedon) ?? -1));
        const stalled = deals.filter((o) => {
            const d = daysSince(o.modifiedon);
            return d != null && d >= 30;
        }).length;
        out.push({
            rowkey: `h:${g.key}`,
            kind: 'header',
            isHeader: true,
            isDeal: false,
            label: g.label,
            initials: g.initials,
            count: deals.length,
            stalled,
            total: sumValue(deals),
        });
        for (const o of deals) {
            const sm = stageMeta(o.salesstagecode);
            const am = ageMeta(o.modifiedon);
            out.push({
                rowkey: `d:${o.opportunityid}`,
                kind: 'deal',
                isHeader: false,
                isDeal: true,
                opportunityid: o.opportunityid,
                name: o.name ?? 'Untitled opportunity',
                account: accountNameOf(o),
                stageLabel: sm.label,
                stageTone: sm.tone,
                ageLabel: am.label,
                ageTone: am.tone,
                amount: Number(o.estimatedvalue ?? 0) || 0,
            });
        }
    }
    return out;
};
const elements = {
    slug: 'dataverse',
    functions: {
        pipeline_stages,
        ops_in_stage,
        weighted,
        close_label,
        close_tone,
        task_overdue_count,
        task_priority_label,
        task_priority_tone,
        account_risk_label,
        account_risk_tone,
        activity_type_icon,
        qa_grade_tone,
        qa_score_tone,
        stage_label,
        stage_tone,
        age_label,
        age_tone,
        count_stalled,
        is_mode,
        group_opportunities,
    },
};
export default elements;
