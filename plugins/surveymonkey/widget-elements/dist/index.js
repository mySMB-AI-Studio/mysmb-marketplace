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
    },
};
export default elements;
