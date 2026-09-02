import type { ComputedFunction, PluginElementsModule } from './types';

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Format an ISO date string to dd-mmm-yy (e.g. "12-Aug-26").
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "surveymonkey_format_date", "args": { "value": { "$item": "date_modified" } } }
 */
const format_date: ComputedFunction = (args) => {
  const raw = args.value;
  if (!raw) return '';
  const ms = Date.parse(String(raw));
  if (Number.isNaN(ms)) return '';
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
const response_rate: ComputedFunction = (args) => {
  const responses = Number(args.responses ?? 0);
  const sent = Number(args.sent ?? 0);
  if (sent === 0) return 0;
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
const survey_status_tone: ComputedFunction = (args) => {
  const v = String(args.value ?? '').toLowerCase();
  if (v === 'open') return 'success';
  if (v === 'closed') return 'muted';
  if (v === 'draft') return 'warning';
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
const recency_tone: ComputedFunction = (args) => {
  const raw = args.value;
  if (!raw) return 'muted';
  const ms = Date.parse(String(raw));
  if (Number.isNaN(ms)) return 'muted';
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
const add_ranks: ComputedFunction = (args) => {
  const arr = Array.isArray(args.value) ? args.value : [];
  return arr.map((item, i) => ({ ...(item as object), rank: i + 1 }));
};

/**
 * Returns the current month and year as a label, e.g. "August 2026".
 * Used as the Survey Calendar tile subtitle.
 *
 * Args: {}
 */
const current_month_label: ComputedFunction = () => {
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
const to_calendar_events: ComputedFunction = (args) => {
  const surveys = Array.isArray(args.value) ? args.value : [];
  const n = typeof args.n === 'number' ? args.n : 20;

  const events: Array<{ date: string; label: string; dateLabel: string }> = [];

  for (const s of surveys) {
    const survey = s as Record<string, unknown>;
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

function _fmtShort(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const d = new Date(ms);
  return `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Returns the current week Mon–Sun as a label, e.g. "Sep 1 – Sep 7, 2026".
 * Used as the This Week's Surveys tile eyebrow.
 *
 * Args: {}
 */
const current_week_label: ComputedFunction = () => {
  const now = new Date();
  const dow = now.getDay();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleString('en-AU', { month: 'short', day: 'numeric' }).toUpperCase();
  return `${fmt(monday)} – ${fmt(sunday)}, ${sunday.getFullYear()}`;
};

/**
 * Transforms a survey list into a week summary object for the This Week's Surveys tile.
 * Returns: { days[7], stat_launching, stat_closing, stat_responses, event_rows[], has_events }.
 * "Launching" = date_created falls in current Mon–Sun.
 * "Closing"   = date_modified falls in current Mon–Sun but NOT created this week.
 *
 * Args: { value: array }
 */
const flatten_week_surveys: ComputedFunction = (args) => {
  const surveys = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];

  const now = new Date();
  const dow = now.getDay();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const monMs = monday.getTime();
  const sunMs = sunday.getTime();

  const DAY_ABBRS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      key: DAY_ABBRS[i],
      abbr: DAY_ABBRS[i],
      num: String(d.getDate()),
      is_today: d.toDateString() === now.toDateString(),
      has_event: false,
    };
  });

  type EventRow = { id: string; title: string; date_label: string; event_label: string; event_tone: string };
  const eventRows: EventRow[] = [];
  let statLaunching = 0;
  let statClosing = 0;
  let statResponses = 0;

  for (const s of surveys) {
    const id = String(s.id ?? '');
    const title = String(s.title ?? '');
    const dateCreated = String(s.date_created ?? '');
    const dateModified = String(s.date_modified ?? '');
    const responseCount = Number(s.response_count ?? 0);
    const createdMs = Date.parse(dateCreated);
    const modifiedMs = Date.parse(dateModified);
    const createdInWeek = !Number.isNaN(createdMs) && createdMs >= monMs && createdMs <= sunMs;
    const modifiedInWeek = !Number.isNaN(modifiedMs) && modifiedMs >= monMs && modifiedMs <= sunMs;

    if (createdInWeek) {
      statLaunching++;
      statResponses += responseCount;
      const dayIdx = (new Date(createdMs).getDay() + 6) % 7;
      if (dayIdx < 7) days[dayIdx].has_event = true;
      eventRows.push({ id: `${id}-launch`, title, date_label: _fmtShort(dateCreated), event_label: 'Launching', event_tone: 'success' });
    } else if (modifiedInWeek) {
      statClosing++;
      statResponses += responseCount;
      const dayIdx = (new Date(modifiedMs).getDay() + 6) % 7;
      if (dayIdx < 7) days[dayIdx].has_event = true;
      eventRows.push({ id: `${id}-modified`, title, date_label: _fmtShort(dateModified), event_label: 'Closing', event_tone: 'warning' });
    }
  }

  eventRows.sort((a, b) => (a.event_label === b.event_label ? 0 : a.event_label === 'Launching' ? -1 : 1));

  return {
    days,
    stat_launching: String(statLaunching),
    stat_closing: String(statClosing),
    stat_responses: statResponses.toLocaleString(),
    event_rows: eventRows,
    has_events: eventRows.length > 0,
  };
};

/**
 * Flattens the list_surveys_in_progress data array into display rows.
 * Row 0 carries aggregate stats (stat_active, stat_total_responses, stat_avg_completion).
 * Handles optional collector fields: collector_name (audience), max_responses (goal),
 * close_date (closes date) — all gracefully empty when not yet provided by the MCP tool.
 * Status (On Track / Behind Pace) is derived only when close_date + max_responses are present.
 *
 * Args: { value: array }
 */
const flatten_surveys_in_progress: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  if (raw.length === 0) return [];

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
        } else {
          statusLabel = 'Behind Pace';
          statusTone = 'warning';
        }
      }
    }

    const progressPct = goal > 0 ? Math.min(100, Math.round((rc / goal) * 100)) : 0;
    const progressTone = statusTone !== 'muted' ? statusTone : 'success';

    return {
      id:                   String(s.id ?? ''),
      title:                String(s.title ?? ''),
      audience:             String(s.collector_name ?? ''),
      responses_label:      responsesLabel,
      closes_label:         closesLabel,
      status_label:         statusLabel,
      status_tone:          statusTone,
      progress_pct:         progressPct,
      progress_tone:        progressTone,
      has_progress:         goal > 0,
      stat_active:          '',
      stat_total_responses: '',
      stat_avg_completion:  '',
    };
  });

  const avgComp = pctCount > 0 ? `${Math.round(totalPct / pctCount)}%` : '--';
  rows[0].stat_active          = String(raw.length);
  rows[0].stat_total_responses = String(totalResponses);
  rows[0].stat_avg_completion  = avgComp;

  return rows;
};

/**
 * Flattens the list_closed_surveys data array into display rows for the Surveys Completed tile.
 * Row[0] carries aggregate stats: stat_quarter_count, stat_total_responses, stat_avg_rate.
 *
 * Args: { value: array }
 */
const flatten_closed_surveys: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  if (raw.length === 0) return [];

  const now = new Date();
  const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const qStartMs = qStart.getTime();

  let totalResponses = 0;
  let totalRate = 0;
  let rateCount = 0;
  let quarterCount = 0;

  const rows = raw.map((s) => {
    const rc = Number(s.response_count ?? 0);
    const sent = Number(s.recipient_count ?? 0);
    totalResponses += rc;

    const closedDateRaw = String(s.date_modified ?? s.closed_date ?? '');
    const closedMs = Date.parse(closedDateRaw);
    if (!Number.isNaN(closedMs) && closedMs >= qStartMs) quarterCount++;

    let ratePct = 0;
    let rateLabel = '';
    let rateTone = 'muted';
    if (sent > 0) {
      ratePct = Math.round((rc / sent) * 100);
      rateLabel = `${ratePct}%`;
      rateTone = ratePct >= 60 ? 'success' : ratePct >= 30 ? 'warning' : 'danger';
      totalRate += ratePct;
      rateCount++;
    }

    return {
      id: String(s.id ?? ''),
      title: String(s.title ?? ''),
      audience: String(s.collector_name ?? ''),
      responses_label: rc.toLocaleString(),
      closed_label: closedDateRaw ? _fmtShort(closedDateRaw) : '',
      rate_label: rateLabel,
      rate_tone: rateTone,
      stat_quarter_count: '',
      stat_total_responses: '',
      stat_avg_rate: '',
    };
  });

  const avgRate = rateCount > 0 ? `${Math.round(totalRate / rateCount)}%` : '--';
  rows[0].stat_quarter_count   = String(quarterCount);
  rows[0].stat_total_responses = totalResponses.toLocaleString();
  rows[0].stat_avg_rate        = avgRate;

  return rows;
};

/**
 * Flattens list_surveys data into chronologically-sorted event rows for the Survey Calendar tile.
 * Each survey contributes a Launching event (date_created) and optionally a Closing event
 * (date_modified when it differs from date_created by more than 60 s).
 * Shows events within the past 30 days, sorted ascending (oldest → newest).
 *
 * Args: { value: array }
 */
const flatten_upcoming_calendar: ComputedFunction = (args) => {
  const surveys = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  if (surveys.length === 0) return [];

  type EventRow = {
    id: string;
    _sort: number;
    date_label: string;
    title: string;
    audience: string;
    event_label: string;
    event_tone: string;
    dot_tone: string;
  };

  const events: EventRow[] = [];

  for (const s of surveys) {
    const id = String(s.id ?? '');
    const title = String(s.title ?? '');
    const audience = String(s.collector_name ?? s.nickname ?? '');
    const createdRaw = String(s.date_created ?? '');
    const modifiedRaw = String(s.date_modified ?? '');
    const createdMs = Date.parse(createdRaw);
    const modifiedMs = Date.parse(modifiedRaw);

    if (!Number.isNaN(createdMs)) {
      events.push({
        id: `${id}-launch`,
        _sort: createdMs,
        date_label: _fmtShort(createdRaw).toUpperCase(),
        title,
        audience,
        event_label: 'Launching',
        event_tone: 'accent',
        dot_tone: 'accent',
      });
    }

    if (
      !Number.isNaN(modifiedMs) &&
      Math.abs(modifiedMs - (Number.isNaN(createdMs) ? 0 : createdMs)) > 60000
    ) {
      events.push({
        id: `${id}-close`,
        _sort: modifiedMs,
        date_label: _fmtShort(modifiedRaw).toUpperCase(),
        title,
        audience,
        event_label: 'Closing',
        event_tone: 'warning',
        dot_tone: 'warning',
      });
    }
  }

  // Most recent 20 events, displayed in ascending chronological order
  events.sort((a, b) => b._sort - a._sort);
  const top = events.slice(0, 20).reverse();
  return top.map(({ _sort, ...rest }) => rest);
};

/**
 * Returns a single spotlight object from the most recently modified survey.
 * Fields: title, status_label, status_tone, launched_label, response_count_label, response_count.
 *
 * Args: { value: array }
 */
const flatten_recent_survey: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  if (raw.length === 0) return {};

  const sorted = [...raw].sort((a, b) => {
    const aMs = Date.parse(String((a as Record<string, unknown>).date_modified ?? ''));
    const bMs = Date.parse(String((b as Record<string, unknown>).date_modified ?? ''));
    return (Number.isNaN(bMs) ? 0 : bMs) - (Number.isNaN(aMs) ? 0 : aMs);
  });

  const s = sorted[0] as Record<string, unknown>;
  const status = String(s.status ?? '').toLowerCase();
  let statusLabel = 'Unknown';
  let statusTone = 'muted';
  if (status === 'open')   { statusLabel = 'Live';   statusTone = 'accent'; }
  if (status === 'closed') { statusLabel = 'Closed'; statusTone = 'muted'; }
  if (status === 'draft')  { statusLabel = 'Draft';  statusTone = 'warning'; }

  const dateCreated = String(s.date_created ?? '');
  let launchedLabel = '';
  if (dateCreated) {
    const ms = Date.parse(dateCreated);
    if (!Number.isNaN(ms)) {
      const d = new Date(ms);
      const month = d.toLocaleString('en-AU', { month: 'long' });
      launchedLabel = `Launched ${month} ${d.getDate()}, ${d.getFullYear()}`;
    }
  }

  const rc = Number(s.response_count ?? 0);

  return {
    title:                String(s.title ?? ''),
    status_label:         statusLabel,
    status_tone:          statusTone,
    launched_label:       launchedLabel,
    response_count_label: rc.toLocaleString(),
  };
};

const elements: PluginElementsModule = {
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
    current_week_label,
    flatten_week_surveys,
    flatten_closed_surveys,
    flatten_recent_survey,
    flatten_upcoming_calendar,
  },
};

export default elements;
