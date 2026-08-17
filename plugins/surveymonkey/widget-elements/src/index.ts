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

const elements: PluginElementsModule = {
  slug: 'surveymonkey',
  functions: { format_date, response_rate, survey_status_tone },
};

export default elements;
