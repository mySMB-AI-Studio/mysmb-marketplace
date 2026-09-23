import type { ComputedFunction, PluginElementsModule } from './types';

// ── sinch_message_stats ───────────────────────────────────────────────────────
// Formats delivery stats from get_sinch_delivery_stats into display-ready
// values for the Messaging Status Overview tile.
// Args: { value: { total?, delivered, pending, failed, rejected } }
const sinch_message_stats: ComputedFunction = (args) => {
  const stats = args.value as Record<string, unknown> | null | undefined;
  if (!stats || typeof stats !== 'object') return null;

  const delivered = Math.max(0, Number(stats.delivered ?? 0));
  const pending   = Math.max(0, Number(stats.pending   ?? 0));
  const failed    = Math.max(0, Number(stats.failed    ?? 0));
  const rejected  = Math.max(0, Number(stats.rejected  ?? 0));
  const total     = Math.max(0, Number(stats.total ?? (delivered + pending + failed + rejected)));

  const pct = (n: number): number =>
    total > 0 ? Math.round((n / total) * 100) : 0;

  const fmt = (n: number): string =>
    n.toLocaleString('en-AU');

  const countPct = (n: number): string =>
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

const elements: PluginElementsModule = {
  slug: 'sinch',
  functions: {
    sinch_message_stats,
  },
};

export default elements;
