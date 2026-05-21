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
const elements = {
    slug: 'dataverse',
    functions: {
        pipeline_stages,
        ops_in_stage,
        weighted,
        close_label,
        close_tone,
    },
};
export default elements;
