const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/**
 * Format an ISO date string to dd-mmm-yy (e.g. "12-Aug-26").
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "surveymonkey_format_date", "args": { "value": { "$item": "date_modified" } } }
 */
const format_date = (args) => {
    const raw = args.value;
    if (!raw)
        return '';
    const ms = Date.parse(String(raw));
    if (Number.isNaN(ms))
        return '';
    const d = new Date(ms);
    const day = String(d.getDate()).padStart(2, '0');
    const month = MONTH_ABBR[d.getMonth()];
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
};
/**
 * Compute the response rate as a whole-number percentage.
 * Returns Math.round((responses / sent) * 100), or 0 if sent is 0.
 *
 * Args: { responses: number, sent: number }
 *
 * Spec example:
 *   { "$computed": "surveymonkey_response_rate", "args": { "responses": { "$item": "response_count" }, "sent": 100 } }
 */
const response_rate = (args) => {
    const responses = Number(args.responses ?? 0);
    const sent = Number(args.sent ?? 0);
    if (sent === 0)
        return 0;
    return Math.round((responses / sent) * 100);
};
/**
 * Map a SurveyMonkey survey status string to a semantic tone.
 * "open" → "success", "closed" → "muted", "draft" → "warning", default → "muted".
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "surveymonkey_survey_status_tone", "args": { "value": { "$item": "status" } } }
 */
const survey_status_tone = (args) => {
    const v = String(args.value ?? '').toLowerCase();
    if (v === 'open')
        return 'success';
    if (v === 'closed')
        return 'muted';
    if (v === 'draft')
        return 'warning';
    return 'muted';
};
/**
 * Returns "success" if the date is within the last 48 hours, "muted" otherwise.
 * Used to colour the recency dot and date caption in the Recent Surveys tile.
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "surveymonkey_recency_tone", "args": { "value": { "$item": "date_modified" } } }
 */
const recency_tone = (args) => {
    const raw = args.value;
    if (!raw)
        return 'muted';
    const ms = Date.parse(String(raw));
    if (Number.isNaN(ms))
        return 'muted';
    return Date.now() - ms <= 48 * 60 * 60 * 1000 ? 'success' : 'muted';
};
/**
 * Injects a 1-based rank field into each item of a sorted array.
 * Use after top_n to add rank numbers for display.
 *
 * Args: { value: array }
 *
 * Spec example:
 *   { "$computed": "surveymonkey_add_ranks", "args": { "value": { "$state": "/ui/topSurveys" } } }
 */
const add_ranks = (args) => {
    const arr = Array.isArray(args.value) ? args.value : [];
    return arr.map((item, i) => ({ ...item, rank: i + 1 }));
};
/**
 * Returns the current month and year as a label, e.g. "August 2026".
 * Used as the Survey Calendar tile subtitle.
 *
 * Args: {}
 */
const current_month_label = () => {
    const d = new Date();
    const month = d.toLocaleString('en-AU', { month: 'long' });
    return `${month} ${d.getFullYear()}`;
};
/**
 * Transforms a survey list into calendar event objects sorted by date descending.
 * Each survey contributes a "created" event and, if date_modified differs, a "modified" event.
 * Each event has: date (ISO), label (display title), dateLabel (e.g. "Aug 18").
 *
 * Args: { value: array, n?: number (default 20) }
 */
const to_calendar_events = (args) => {
    const surveys = Array.isArray(args.value) ? args.value : [];
    const n = typeof args.n === 'number' ? args.n : 20;
    const events = [];
    for (const s of surveys) {
        const survey = s;
        const title = String(survey.title ?? '');
        const created = String(survey.date_created ?? '');
        const modified = String(survey.date_modified ?? '');
        if (created) {
            events.push({ date: created, label: title, dateLabel: _fmtShort(created) });
        }
        if (modified && modified !== created) {
            events.push({ date: modified, label: `${title} — modified`, dateLabel: _fmtShort(modified) });
        }
    }
    events.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    return events.slice(0, n);
};
function _fmtShort(iso) {
    const ms = Date.parse(iso);
    if (Number.isNaN(ms))
        return '';
    const d = new Date(ms);
    return `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
}
/**
 * Flattens the list_surveys_in_progress data array into display rows.
 * Row 0 carries aggregate stats (stat_active, stat_total_responses, stat_avg_completion).
 * Handles optional collector fields: collector_name (audience), max_responses (goal),
 * close_date (closes date) — all gracefully empty when not yet provided by the MCP tool.
 * Status (On Track / Behind Pace) is derived only when close_date + max_responses are present.
 *
 * Args: { value: array }
 */
const flatten_surveys_in_progress = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    if (raw.length === 0)
        return [];
    let totalResponses = 0;
    let totalPct = 0;
    let pctCount = 0;
    const rows = raw.map((s) => {
        const rc = Number(s.response_count ?? 0);
        const goal = Number(s.max_responses ?? s.response_limit ?? 0);
        totalResponses += rc;
        const responsesLabel = goal > 0 ? `${rc} / ${goal}` : String(rc);
        const rawClose = String(s.close_date ?? s.collector_close_date ?? '');
        let closesLabel = '';
        if (rawClose) {
            const ms = Date.parse(rawClose);
            if (!Number.isNaN(ms)) {
                const d = new Date(ms);
                closesLabel = `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
            }
        }
        if (goal > 0) {
            totalPct += Math.round((rc / goal) * 100);
            pctCount++;
        }
        let statusLabel = '';
        let statusTone = 'muted';
        if (rawClose && goal > 0) {
            const closeMs = Date.parse(rawClose);
            const sinceMs = Date.parse(String(s.collecting_since ?? s.date_created ?? ''));
            if (!Number.isNaN(closeMs) && !Number.isNaN(sinceMs) && closeMs > sinceMs) {
                const totalSpan = closeMs - sinceMs;
                const elapsed = Date.now() - sinceMs;
                const expectedPct = (elapsed / totalSpan) * 100;
                const actualPct = (rc / goal) * 100;
                if (actualPct >= expectedPct * 0.8) {
                    statusLabel = 'On Track';
                    statusTone = 'success';
                }
                else {
                    statusLabel = 'Behind Pace';
                    statusTone = 'warning';
                }
            }
        }
        return {
            id: String(s.id ?? ''),
            title: String(s.title ?? ''),
            audience: String(s.collector_name ?? ''),
            responses_label: responsesLabel,
            closes_label: closesLabel,
            status_label: statusLabel,
            status_tone: statusTone,
            stat_active: '',
            stat_total_responses: '',
            stat_avg_completion: '',
        };
    });
    const avgComp = pctCount > 0 ? `${Math.round(totalPct / pctCount)}%` : '--';
    rows[0].stat_active = String(raw.length);
    rows[0].stat_total_responses = String(totalResponses);
    rows[0].stat_avg_completion = avgComp;
    return rows;
};
const elements = {
    slug: 'surveymonkey',
    functions: {
        format_date,
        response_rate,
        survey_status_tone,
        recency_tone,
        add_ranks,
        current_month_label,
        to_calendar_events,
        flatten_surveys_in_progress,
    },
};
export default elements;
