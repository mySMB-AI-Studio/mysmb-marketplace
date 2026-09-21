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
const flatten_client_health = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    if (raw.length === 0)
        return [];
    const toneMap = {
        error: 'destructive',
        high: 'destructive',
        medium: 'warning',
        low: 'success',
    };
    const labelMap = {
        error: 'Error',
        high: 'High',
        medium: 'Medium',
        low: 'Low',
    };
    let highAlert = 0, medAlert = 0, lowAlert = 0;
    for (const c of raw) {
        const lvl = String(c.alertLevel ?? '').toLowerCase();
        if (lvl === 'error' || lvl === 'high')
            highAlert++;
        else if (lvl === 'medium')
            medAlert++;
        else if (lvl === 'low')
            lowAlert++;
    }
    const rows = raw.map((client) => {
        const id = String(client.id ?? '');
        const name = String(client.name ?? '');
        const healthScore = client.healthScore != null ? String(client.healthScore) : '—';
        const alertLevel = String(client.alertLevel ?? '').toLowerCase();
        const alertTone = toneMap[alertLevel] ?? 'muted';
        const badgeLabel = labelMap[alertLevel] ?? String(client.alertLevel ?? '');
        return {
            id,
            name,
            health_score: healthScore,
            alert_level: alertLevel,
            alert_tone: alertTone,
            badge_label: badgeLabel,
            stat_total: '',
            stat_high_alert: '',
            stat_low_alert: '',
            footer_label: '',
        };
    });
    const total = raw.length;
    rows[0].stat_total = String(total);
    rows[0].stat_high_alert = String(highAlert);
    rows[0].stat_low_alert = String(lowAlert);
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
const flatten_activity_summary = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    if (raw.length === 0)
        return [];
    let totalHealth = 0;
    let highAlert = 0;
    let mediumAlert = 0;
    let lowAlert = 0;
    for (const client of raw) {
        const score = Number(client.healthScore ?? 0);
        if (!Number.isNaN(score))
            totalHealth += score;
        const level = String(client.alertLevel ?? '').toLowerCase();
        if (level === 'error' || level === 'high')
            highAlert++;
        else if (level === 'medium')
            mediumAlert++;
        else if (level === 'low')
            lowAlert++;
    }
    const total = raw.length;
    const avgHealth = total > 0 ? Math.round(totalHealth / total) : 0;
    return [
        {
            stat_total: String(total),
            stat_avg_health: String(avgHealth),
            stat_high_alert: String(highAlert),
            stat_medium_alert: String(mediumAlert),
            stat_low_alert: String(lowAlert),
            footer_label: `${total} client${total === 1 ? '' : 's'} monitored`,
        },
    ];
};
/**
 * Splits the list_clients response into All / Needs Review / Healthy tabs
 * for the Client Portfolio Health tile.
 *
 * Buckets: healthy = alertLevel "low"; needs_review = everything else.
 * Each row: id, name, provider_label (providerName), score_label (healthScore),
 * circle_tone ("success" | "warning" | "destructive").
 *
 * Args: { value: array }
 */
const flatten_portfolio_health = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    if (raw.length === 0)
        return { all: [], needs_review: [], healthy: [] };
    const all = [];
    const needs_review = [];
    const healthy = [];
    for (const client of raw) {
        const id = String(client.id ?? '');
        const name = String(client.name ?? '');
        const providerLabel = String(client.providerName ?? '');
        const healthScore = Number(client.healthScore ?? 0);
        const alertLevel = String(client.alertLevel ?? '').toLowerCase();
        const scoreLabel = String(healthScore);
        // Bucket and colour by healthScore — alertLevel values from list_clients
        // are inconsistent across accounts, so score is the reliable signal.
        const isHealthy = healthScore >= 70;
        const circleTone = healthScore < 40 ? 'destructive' : healthScore < 70 ? 'warning' : 'success';
        const row = { id, name, provider_label: providerLabel, score_label: scoreLabel, circle_tone: circleTone };
        all.push(row);
        if (isHealthy)
            healthy.push(row);
        else
            needs_review.push(row);
    }
    return { all, needs_review, healthy, total_count: all.length, review_count: needs_review.length };
};
/**
 * Transforms the `get_client` response into display rows for the Client Data Health Detail tile.
 *
 * Each row:
 *   id          — unique key
 *   label       — row heading (e.g. "GST method")
 *   sub_label   — secondary line (e.g. "Cash basis")
 *   badge_label — right-side value chip (e.g. "Quarterly")
 *   badge_tone  — Badge tone: "default" | "warning" | "destructive" | "success"
 *   dot_tone    — Icon/Circle tone: "muted" | "warning" | "destructive" | "success"
 *
 * Args: { client: object }
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtMonth(dateStr) {
    const parts = dateStr.split('-');
    const idx = parts.length >= 2 ? parseInt(parts[1], 10) - 1 : -1;
    return (idx >= 0 && idx <= 11) ? MONTHS[idx] : dateStr;
}
function fmtYearEnd(dateStr) {
    const parts = dateStr.split('-');
    if (parts.length < 3)
        return dateStr;
    const day = parseInt(parts[2], 10);
    const mIdx = parseInt(parts[1], 10) - 1;
    return `${day} ${MONTHS[mIdx] ?? ''}`;
}
const GST_CYCLE_LABELS = {
    QUARTERLY1: 'Quarterly', QUARTERLY2: 'Quarterly', QUARTERLY3: 'Quarterly',
    QUARTERLY: 'Quarterly', MONTHLY: 'Monthly', ANNUAL: 'Annual', ANNUALLY: 'Annual',
};
const GST_SCHEME_LABELS = {
    ACCRUALS: 'Accruals basis', ACCRUAL: 'Accruals basis',
    CASH: 'Cash basis', CASH_ACCOUNTING: 'Cash basis',
};
const flatten_client_detail_rows = (args) => {
    const client = args.client;
    if (!client || typeof client !== 'object' || Array.isArray(client))
        return [];
    const vatDetails = (client.vatDetails ?? {});
    const metrics = (client.metrics ?? {});
    const bankRec = (client.bankReconciliation ?? {});
    const rows = [];
    // GST method — humanize raw API values
    const vatSchemeRaw = String(vatDetails.scheme ?? '').trim();
    const vatCycleRaw = String(vatDetails.reportingCycle ?? '').trim();
    const vatCycleLabel = (GST_CYCLE_LABELS[vatCycleRaw.toUpperCase()] ?? vatCycleRaw) || '—';
    const vatSchemeLabel = (GST_SCHEME_LABELS[vatSchemeRaw.toUpperCase()] ?? vatSchemeRaw) || '—';
    rows.push({
        id: 'gst_method',
        label: 'GST method',
        sub_label: vatSchemeLabel,
        badge_label: vatCycleLabel,
        badge_tone: 'default',
        dot_tone: 'muted',
    });
    // Current BAS period — "Jul–Sep" range + "Q2 FY27 · year end 30 Jun" sub-label
    const periodStart = String(vatDetails.periodStart ?? '').trim();
    const periodEnd = String(vatDetails.periodEnd ?? '').trim();
    const periodLabel = periodStart && periodEnd
        ? `${fmtMonth(periodStart)}–${fmtMonth(periodEnd)}`
        : (periodStart ? fmtMonth(periodStart) : (periodEnd ? fmtMonth(periodEnd) : '—'));
    const yearEnd = String(client.yearEnd ?? '').trim();
    let basSub = yearEnd ? `Year end ${fmtYearEnd(yearEnd)}` : '—';
    if (periodStart && yearEnd) {
        const pParts = periodStart.split('-');
        const yParts = yearEnd.split('-');
        const pMonth = parseInt(pParts[1] ?? '0', 10);
        const pYear = parseInt(pParts[0] ?? '0', 10);
        const yeMonth = parseInt(yParts[1] ?? '0', 10);
        if (pMonth && yeMonth) {
            const rel = ((pMonth - yeMonth - 1 + 12) % 12);
            const quarter = Math.floor(rel / 3) + 1;
            const fyYear = pMonth > yeMonth ? pYear + 1 : pYear;
            const fyLabel = `FY${String(fyYear).slice(-2)}`;
            basSub = yearEnd
                ? `Q${quarter} ${fyLabel} · year end ${fmtYearEnd(yearEnd)}`
                : `Q${quarter} ${fyLabel}`;
        }
    }
    rows.push({
        id: 'bas_period',
        label: 'Current BAS period',
        sub_label: basSub,
        badge_label: periodLabel,
        badge_tone: 'default',
        dot_tone: 'muted',
    });
    // Debtor balance
    const debtorBalance = Number(metrics.debtorBalance ?? 0);
    const avgDebtorDays = Number(metrics.avgDebtorDays ?? 0);
    const balanceLabel = debtorBalance
        ? `A$${debtorBalance.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '—';
    rows.push({
        id: 'debtor_balance',
        label: 'Debtor balance',
        sub_label: avgDebtorDays ? `Avg. ${avgDebtorDays} days outstanding` : '—',
        badge_label: balanceLabel,
        badge_tone: 'default',
        dot_tone: 'muted',
    });
    // Bank reconciliation
    const bankAccounts = bankRec.bankAccounts;
    const manualFeeds = bankRec.manualFeeds;
    const accountCount = Array.isArray(bankAccounts) ? bankAccounts.length : (typeof bankAccounts === 'number' ? bankAccounts : 0);
    const feedCount = Array.isArray(manualFeeds) ? manualFeeds.length : (typeof manualFeeds === 'number' ? manualFeeds : 0);
    rows.push({
        id: 'bank_rec',
        label: 'Bank reconciliation',
        sub_label: feedCount ? `${feedCount} manual feed${feedCount !== 1 ? 's' : ''}` : '—',
        badge_label: accountCount ? `${accountCount} account${accountCount !== 1 ? 's' : ''}` : '—',
        badge_tone: 'default',
        dot_tone: 'muted',
    });
    // ATO status — normalize underscored API values (e.g. NOT_CONNECTED → not connected)
    const hmrcStatus = String(client.hmrcStatus ?? '').trim();
    const oneDayImpact = Number(metrics.oneDayImpact ?? 0);
    const normalized = hmrcStatus.toLowerCase().replace(/_/g, ' ');
    let dotTone = 'muted';
    if (normalized === 'not connected' || normalized === 'disconnected') {
        dotTone = 'warning';
    }
    else if (normalized === 'connected') {
        dotTone = 'success';
    }
    else if (normalized === 'error' || normalized === 'failed') {
        dotTone = 'destructive';
    }
    rows.push({
        id: 'ato_status',
        label: 'ATO status',
        sub_label: oneDayImpact ? `One-day impact A$${oneDayImpact.toFixed(2)}` : '—',
        badge_label: normalized || '—',
        badge_tone: dotTone,
        dot_tone: dotTone,
    });
    return rows;
};
/**
 * Transforms the `get_client_activity_stats` response into row arrays for the
 * Client Activity Stats tile. Returns one array per tab: annual, quarterly, monthly.
 *
 * Each row:
 *   id          — unique key ("turnover" | "sales" | "bills" | "bank_transactions")
 *   label       — row heading
 *   sub_label   — change indicator or "This period"
 *   badge_label — formatted value (currency or count)
 *   badge_tone  — "default"
 *   dot_tone    — "success" | "destructive" | "muted" (driven by YoY/MoM change on turnover)
 *
 * Args: { stats: object }
 */
const flatten_activity_stats_rows = (args) => {
    const stats = args.stats;
    if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
        return { annual: [], quarterly: [], monthly: [] };
    }
    function fmtAmount(n) {
        return `A$${Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    function buildRows(period, changeValue, changeLabel) {
        const counts = (period.counts ?? {});
        const turnover = Number(period.turnover ?? 0);
        let dotTone = 'muted';
        let turnoverSub = 'This period';
        let turnoverBadgeTone = 'default';
        if (changeValue !== null && changeValue !== 0) {
            const sign = changeValue > 0 ? '+' : '−';
            turnoverSub = `${sign}${fmtAmount(changeValue)} ${changeLabel}`;
            dotTone = changeValue > 0 ? 'success' : 'destructive';
            turnoverBadgeTone = changeValue > 0 ? 'success' : 'destructive';
        }
        return [
            {
                id: 'turnover',
                label: 'Turnover',
                sub_label: turnoverSub,
                badge_label: turnover ? fmtAmount(turnover) : '—',
                badge_tone: turnoverBadgeTone,
                dot_tone: dotTone,
            },
            {
                id: 'sales',
                label: 'Sales invoices',
                sub_label: 'This period',
                badge_label: String(Number(counts.sales ?? 0)),
                badge_tone: 'default',
                dot_tone: 'muted',
            },
            {
                id: 'bills',
                label: 'Bills',
                sub_label: 'This period',
                badge_label: String(Number(counts.bills ?? 0)),
                badge_tone: 'default',
                dot_tone: 'muted',
            },
            {
                id: 'bank_transactions',
                label: 'Bank transactions',
                sub_label: 'This period',
                badge_label: String(Number(counts.bankTransactions ?? 0)),
                badge_tone: 'default',
                dot_tone: 'muted',
            },
        ];
    }
    const annual = (stats.annual ?? {});
    const quarterly = (stats.quarterlyAverage ?? {});
    const monthly = (stats.monthlyAverage ?? {});
    return {
        annual: buildRows(annual, annual.yearOverYearChange != null ? Number(annual.yearOverYearChange) : null, 'YoY'),
        quarterly: buildRows(quarterly, quarterly.yearOverYearChange != null ? Number(quarterly.yearOverYearChange) : null, 'YoY'),
        monthly: buildRows(monthly, monthly.monthOverMonthChange != null ? Number(monthly.monthOverMonthChange) : null, 'MoM'),
    };
};
const compute_health_tone = (args) => {
    const score = Number(args.score ?? 0);
    if (score >= 70)
        return 'success';
    if (score >= 40)
        return 'warning';
    return 'destructive';
};
const compute_health_tone_flags = (args) => {
    const score = Number(args.score ?? 0);
    return {
        success:     score >= 70,
        warning:     score >= 40 && score < 70,
        destructive: score < 40,
    };
};
/**
 * Converts a 0–100 health score into a 100-item synthetic array for the Donut
 * component. `score` items fill the arc; `rest` items form the empty background.
 *
 * Args: { score: number }
 *
 * Spec example:
 *   { "$computed": "dext_score_to_donut_data", "args": { "score": { "$state": "/dext/get_client/healthScore" } } }
 */
const score_to_donut_data = (args) => {
    const score = Math.max(0, Math.min(100, Math.round(Number(args.score ?? 0))));
    const result = [];
    for (let i = 0; i < score; i++)
        result.push({ s: 'score' });
    for (let i = score; i < 100; i++)
        result.push({ s: 'rest' });
    return result;
};
const elements = {
    slug: 'dext',
    functions: {
        flatten_client_health,
        flatten_activity_summary,
        flatten_portfolio_health,
        flatten_client_detail_rows,
        flatten_activity_stats_rows,
        compute_health_tone,
        compute_health_tone_flags,
        score_to_donut_data,
    },
};
export default elements;
