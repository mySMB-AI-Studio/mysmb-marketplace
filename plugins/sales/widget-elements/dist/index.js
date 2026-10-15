const CLOSED_STAGES = new Set(['won', 'lost']);
const STAGE_TONE = {
    lead: 'muted',
    qualified: 'info',
    proposal: 'accent',
    negotiation: 'warning',
    won: 'success',
    lost: 'destructive',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function cents(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
function dollars(valueInCents) {
    return `$${Math.round(valueInCents / 100).toLocaleString('en-AU')}`;
}
/** `{ cents }` → `$24,000`; a deal without a value reads as a dash. */
const deal_value = (args) => {
    if (typeof args.cents !== 'number')
        return '—';
    return dollars(cents(args.cents));
};
/** `{ records }` → `$123,400 open across 5 deals` (won and lost deals are not pipeline). */
const pipeline_total = (args) => {
    const records = Array.isArray(args.records) ? args.records : [];
    let total = 0;
    let open = 0;
    for (const record of records) {
        if (!record || typeof record !== 'object')
            continue;
        const row = record;
        if (typeof row.stage === 'string' && CLOSED_STAGES.has(row.stage))
            continue;
        open += 1;
        total += cents(row.data?.value);
    }
    if (open === 0)
        return 'No open deals';
    return `${dollars(total)} open across ${open} deal${open === 1 ? '' : 's'}`;
};
/** `{ stage }` → a Badge tone. */
const stage_tone = (args) => {
    return typeof args.stage === 'string' ? (STAGE_TONE[args.stage] ?? 'default') : 'default';
};
/** `{ date, stage }` → `Closes 14 Nov`, `Won`, or `No close date`. */
const close_label = (args) => {
    if (args.stage === 'won')
        return 'Won';
    if (args.stage === 'lost')
        return 'Lost';
    if (typeof args.date !== 'string')
        return 'No close date';
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(args.date);
    if (!match)
        return 'No close date';
    return `Closes ${Number(match[3])} ${MONTHS[Number(match[2]) - 1] ?? match[2]}`;
};
const mod = {
    slug: 'sales',
    functions: { deal_value, pipeline_total, stage_tone, close_label },
};
export default mod;
