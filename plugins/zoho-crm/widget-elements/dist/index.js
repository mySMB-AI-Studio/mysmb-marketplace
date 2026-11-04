/**
 * Zoho CRM's default Deals pipeline, in order. Stages not listed here (custom
 * stages) sort after these, largest value first.
 */
const STAGE_ORDER = [
    'Qualification',
    'Needs Analysis',
    'Value Proposition',
    'Identify Decision Makers',
    'Id. Decision Makers',
    'Perception Analysis',
    'Proposal/Price Quote',
    'Negotiation/Review',
];
/**
 * Currency symbol prefix. USD shows as a bare `$` — a recorded decision to
 * match the Deal Pipeline Snapshot mock (see the tile's PR); other codes use
 * the platform's prefixed symbols.
 */
const SYMBOLS = {
    USD: '$', AUD: 'A$', NZD: 'NZ$', CAD: 'C$', GBP: '£', EUR: '€', INR: '₹', JPY: '¥',
};
function symbolFor(currency) {
    const code = String(currency || 'USD').toUpperCase();
    return SYMBOLS[code] ?? `${code} `;
}
/** `$734,500` — whole units (deliberate 0dp, per the mock). */
function formatWhole(n, currency) {
    return `${symbolFor(currency)}${Math.round(n).toLocaleString('en-US')}`;
}
/** `$268.5K`, `$1.2M`, `$950` — compact, at most one decimal, no trailing `.0`. */
function formatCompact(n, currency) {
    const abs = Math.abs(n);
    const [div, unit] = abs >= 1e9 ? [1e9, 'B'] : abs >= 1e6 ? [1e6, 'M'] : abs >= 1e3 ? [1e3, 'K'] : [1, ''];
    const v = Math.round((n / div) * 10) / 10;
    return `${symbolFor(currency)}${v.toLocaleString('en-US', { maximumFractionDigits: 1 })}${unit}`;
}
/**
 * Decorative per-stage colour, by position in the pipeline (TILE-DISPLAY-STANDARDS
 * §10 categorical palette, led by the tile's brand blue). Not a status: no stage
 * is better or worse than another. Cycles if an org has more than six open stages.
 */
const STAGE_TONES = ['brand', 'chart-2', 'chart-1', 'chart-3', 'chart-4', 'chart-5'];
/**
 * Zoho writes `Proposal/Price Quote`; show `Proposal / Price Quote`. Its
 * abbreviated `Id. Decision Makers` value shows as the spelled-out stage name.
 */
function stageLabel(stage) {
    if (stage === 'Id. Decision Makers')
        return 'Identify Decision Makers';
    return stage.replace(/\s*\/\s*/g, ' / ');
}
/**
 * Summarise open Zoho CRM deals (rows from `coql_query`) for the Deal Pipeline
 * Snapshot tile: total value, deal and stage counts, and one row per stage in
 * pipeline order with its value and bar width (percent of the largest stage).
 *
 * Args:
 *   value       — the COQL `data` array: `{ id, Deal_Name, Stage, Amount, Currency? }[]`
 *   moreRecords — COQL `info.more_records`; true when the 200-row limit cut the list
 *   currency    — fallback ISO code when a deal has no `Currency` (single-currency orgs)
 *   selected    — the expanded stage's `key` (`/ui/selectedStage`), or empty for none
 *
 * Spec: `{ "$computed": "zoho-crm_pipeline_snapshot_dashboard", "args": { "value": { "$state": "/zoho-crm/coql_query/data" }, "currency": "USD" } }`
 */
const pipeline_snapshot_dashboard = (args) => {
    const rows = Array.isArray(args.value) ? args.value : [];
    const currency = rows.find((r) => typeof r.Currency === 'string' && r.Currency)?.Currency ?? args.currency;
    const byStage = new Map();
    let total = 0;
    for (const r of rows) {
        const stage = String(r.Stage ?? '').trim() || 'No stage';
        const amount = Number(r.Amount);
        const value = Number.isFinite(amount) ? amount : 0;
        const s = byStage.get(stage) ?? { amount: 0, count: 0 };
        s.amount += value;
        s.count += 1;
        byStage.set(stage, s);
        total += value;
    }
    const rank = (stage) => {
        const i = STAGE_ORDER.indexOf(stage);
        return i === -1 ? STAGE_ORDER.length : i;
    };
    const ordered = [...byStage.entries()].sort(([a, x], [b, y]) => rank(a) - rank(b) || y.amount - x.amount);
    const max = Math.max(0, ...ordered.map(([, s]) => s.amount));
    const dealCount = rows.length;
    const stageCount = ordered.length;
    const truncated = args.moreRecords === true;
    const selected = String(args.selected ?? '');
    return {
        totalDisplay: formatWhole(total, currency),
        dealCount,
        dealLabel: dealCount === 1 ? 'Deal' : 'Deals',
        stageCount,
        stageLabel: stageCount === 1 ? 'Stage' : 'Stages',
        stages: ordered.map(([stage, s], i) => ({
            key: stage,
            label: stageLabel(stage),
            count: s.count,
            pct: max > 0 ? Math.round((s.amount / max) * 100) : 0,
            amountDisplay: formatCompact(s.amount, currency),
            tone: STAGE_TONES[i % STAGE_TONES.length],
            expanded: stage === selected,
            // What a click on this row writes to `/ui/selectedStage`: open it, or close it if already open.
            toggleValue: stage === selected ? '' : stage,
            chevron: stage === selected ? 'ChevronDown' : 'ChevronRight',
        })),
        // The expanded stage's deals, largest first. Returned here rather than by a
        // second watch action: a watch stops its action list once one action writes state.
        openDeals: rows
            .filter((r) => selected && (String(r.Stage ?? '').trim() || 'No stage') === selected)
            .map((r) => ({ id: String(r.id ?? ''), name: String(r.Deal_Name ?? 'Untitled deal'), amount: Number(r.Amount) || 0 }))
            .sort((a, b) => b.amount - a.amount)
            .map((d) => ({ id: d.id, name: d.name, amountDisplay: formatCompact(d.amount, currency) })),
        truncated,
        coverageText: truncated ? `Showing the first ${dealCount} open deals` : '',
    };
};
const elements = {
    slug: 'zoho-crm',
    functions: {
        pipeline_snapshot_dashboard,
    },
};
export default elements;
