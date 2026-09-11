import type { ComputedFunction, PluginElementsModule } from './types';

/**
 * Maps the `list_clients` response into display rows for the Client Health tile.
 *
 * Row 0 carries `stat_total` (string, total client count) and `footer_label`.
 * Every row has:
 *   id           — client id
 *   name         — client name
 *   health_score — string representation of healthScore (0–100)
 *   alert_level  — raw alertLevel string ("low" | "medium" | "high")
 *   alert_tone   — widget tone: "destructive" | "warning" | "success"
 *   badge_label  — Title Case label: "High" | "Medium" | "Low"
 *   stat_total   — string total count (only meaningful on row 0)
 *   footer_label — e.g. "12 clients monitored" (only meaningful on row 0)
 *
 * Args: { value: array }
 *
 * Spec example:
 *   { "$computed": "dext_flatten_client_health", "args": { "value": { "$state": "/dext/list_clients/data" } } }
 */
const flatten_client_health: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  if (raw.length === 0) return [];

  const toneMap: Record<string, string> = {
    high:   'destructive',
    medium: 'warning',
    low:    'success',
  };
  const labelMap: Record<string, string> = {
    high:   'High',
    medium: 'Medium',
    low:    'Low',
  };

  const rows = raw.map((client) => {
    const id          = String(client.id          ?? '');
    const name        = String(client.name        ?? '');
    const healthScore = client.healthScore != null ? String(client.healthScore) : '—';
    const alertLevel  = String(client.alertLevel  ?? '').toLowerCase();
    const alertTone   = toneMap[alertLevel]  ?? 'muted';
    const badgeLabel  = labelMap[alertLevel] ?? String(client.alertLevel ?? '');

    return {
      id,
      name,
      health_score: healthScore,
      alert_level:  alertLevel,
      alert_tone:   alertTone,
      badge_label:  badgeLabel,
      stat_total:   '',
      footer_label: '',
    };
  });

  const total = raw.length;
  rows[0].stat_total   = String(total);
  rows[0].footer_label = `${total} client${total === 1 ? '' : 's'} monitored`;

  return rows;
};

/**
 * Aggregates the `list_clients` response into a single-row summary for the
 * Activity Stats tile.
 *
 * Returns an array with exactly one summary object:
 *   stat_total        — total client count (string)
 *   stat_avg_health   — average health score rounded to nearest integer (string)
 *   stat_high_alert   — count of clients with alertLevel "high" (string)
 *   stat_medium_alert — count of clients with alertLevel "medium" (string)
 *   stat_low_alert    — count of clients with alertLevel "low" (string)
 *   footer_label      — e.g. "12 clients monitored"
 *
 * Returns [] if the input is empty, which triggers the Empty element in the tile.
 *
 * Args: { value: array }
 *
 * Spec example:
 *   { "$computed": "dext_flatten_activity_summary", "args": { "value": { "$state": "/dext/list_clients/data" } } }
 */
const flatten_activity_summary: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  if (raw.length === 0) return [];

  let totalHealth = 0;
  let highAlert   = 0;
  let mediumAlert = 0;
  let lowAlert    = 0;

  for (const client of raw) {
    const score = Number(client.healthScore ?? 0);
    if (!Number.isNaN(score)) totalHealth += score;

    const level = String(client.alertLevel ?? '').toLowerCase();
    if (level === 'high')        highAlert++;
    else if (level === 'medium') mediumAlert++;
    else if (level === 'low')    lowAlert++;
  }

  const total    = raw.length;
  const avgHealth = total > 0 ? Math.round(totalHealth / total) : 0;

  return [
    {
      stat_total:        String(total),
      stat_avg_health:   String(avgHealth),
      stat_high_alert:   String(highAlert),
      stat_medium_alert: String(mediumAlert),
      stat_low_alert:    String(lowAlert),
      footer_label:      `${total} client${total === 1 ? '' : 's'} monitored`,
    },
  ];
};

const elements: PluginElementsModule = {
  slug: 'dext',
  functions: {
    flatten_client_health,
    flatten_activity_summary,
  },
};

export default elements;
