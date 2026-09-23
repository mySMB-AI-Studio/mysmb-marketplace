const sinch_message_stats = (args) => {
    const stats = args.value;
    if (!stats || typeof stats !== 'object') return null;

    const delivered = Math.max(0, Number(stats.delivered ?? 0));
    const pending   = Math.max(0, Number(stats.pending   ?? 0));
    const failed    = Math.max(0, Number(stats.failed    ?? 0));
    const rejected  = Math.max(0, Number(stats.rejected  ?? 0));
    const total     = Math.max(0, Number(stats.total ?? (delivered + pending + failed + rejected)));

    const pct = (n) =>
        total > 0 ? Math.round((n / total) * 100) : 0;

    const fmt = (n) =>
        n.toLocaleString('en-AU');

    const countPct = (n) =>
        `${fmt(n)} · ${pct(n)}%`;

    return {
        total:             fmt(total),
        deliveredCountPct: countPct(delivered),
        deliveredPct:      pct(delivered),
        pendingCountPct:   countPct(pending),
        pendingPct:        pct(pending),
        failedCountPct:    countPct(failed),
        failedPct:         pct(failed),
        rejectedCountPct:  countPct(rejected),
        rejectedPct:       pct(rejected),
    };
};

const elements = {
    slug: 'sinch',
    functions: {
        sinch_message_stats,
    },
};

export default elements;
