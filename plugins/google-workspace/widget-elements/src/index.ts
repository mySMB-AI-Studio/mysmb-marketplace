/**
 * google-workspace — widget-elements module
 *
 * Helpers tailored to Google Workspace API response shapes:
 *
 *  - `list_messages` (Gmail) returns `{ messages: [...], resultSizeEstimate }`.
 *    Each message has `id`, `threadId`, and optional payload headers including
 *    `from`, `subject`, `date`, and `internalDate` (epoch ms string).
 *
 *  - `list_recent_files` (Drive) returns `{ files: [...], nextPageToken? }`.
 *    Each file has `id`, `name`, `mimeType`, `modifiedTime`, `webViewLink`.
 *
 *  - `list_events` (Calendar) returns `{ items: [...], summary, ... }`.
 *    Each event has `id`, `summary`, `start`, `end`, `status`, `location`.
 *
 *  - `get_meeting_dashboard` (Meet) returns `{ latestMeeting, recentMeetings }`.
 *    `latestMeeting.transcriptStatus` / `recentMeetings[].status` are one of
 *    `"ready" | "processing" | "none"`. `latestMeeting.talkTime` is an array
 *    of `{ speaker, words, percent }` sorted desc by percent.
 *    `latestMeeting.entries` is the full transcript as `{ speaker, text, startTime }`.
 *
 * Keeping the shape-wrangling here means the widget JSON stays a flat,
 * declarative description of the layout.
 */

import type { ComputedFunction, PluginElementsModule } from './types.js';

// ── shared helpers ───────────────────────────────────────────────────

function str(value: unknown): string {
  return value == null ? '' : String(value);
}

// Parse an ISO-ish datetime/date string into epoch ms, treating a string
// with no timezone marker as UTC (matches how most connector APIs emit
// date-only or "naive" timestamps — avoids an off-by-one day depending on
// the viewer's browser offset).
function parseUtcMs(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value) return null;
  const hasTz = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(value);
  const parsed = Date.parse(hasTz ? value : `${value}Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

const MONTH_ABBREV = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];
const WEEKDAY_ABBREV = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TRANSCRIPT_STATUSES = ['ready', 'processing', 'none'] as const;
type TranscriptStatus = (typeof TRANSCRIPT_STATUSES)[number];

function normalizeStatus(value: unknown): TranscriptStatus {
  const s = str(value).toLowerCase();
  return (TRANSCRIPT_STATUSES as readonly string[]).includes(s) ? (s as TranscriptStatus) : 'none';
}

// Non-semantic tone cycle for distinguishing speakers — deliberately
// excludes success/warning/destructive, which are reserved for transcript
// status (ready/processing/none) elsewhere in the same tile.
const SPEAKER_TONES = ['accent', 'info', 'brand', 'muted', 'default'];

// ── mime_label ─────────────────────────────────────────────────────────
// Referenced in widget JSON as "google-workspace_mime_label" — the slug
// prefix is added automatically by the platform, not baked in here.
//
// Maps a Google Drive MIME type to a short human-readable label.
//
// Examples:
//   "application/vnd.google-apps.document"     → "Doc"
//   "application/vnd.google-apps.spreadsheet"  → "Sheet"
//   "application/vnd.google-apps.presentation" → "Slide"
//   "application/vnd.google-apps.folder"       → "Folder"
//   "application/pdf"                          → "PDF"
//   anything else → last segment after "/" or "File"
//
// Args: { value: string } — the file's mimeType field

const mime_label: ComputedFunction = (args) => {
  const mime = str(args.value).toLowerCase();

  if (mime === 'application/vnd.google-apps.document') return 'Doc';
  if (mime === 'application/vnd.google-apps.spreadsheet') return 'Sheet';
  if (mime === 'application/vnd.google-apps.presentation') return 'Slide';
  if (mime === 'application/vnd.google-apps.folder') return 'Folder';
  if (mime === 'application/vnd.google-apps.form') return 'Form';
  if (mime === 'application/vnd.google-apps.drawing') return 'Drawing';
  if (mime === 'application/vnd.google-apps.site') return 'Site';
  if (mime === 'application/vnd.google-apps.shortcut') return 'Shortcut';
  if (mime === 'application/pdf') return 'PDF';
  if (mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/gif' || mime === 'image/webp') return 'Image';
  if (mime.startsWith('video/')) return 'Video';
  if (mime.startsWith('audio/')) return 'Audio';
  if (mime === 'text/plain') return 'Text';
  if (mime === 'application/zip' || mime === 'application/x-zip-compressed') return 'ZIP';

  // Fall back to the last segment after "/"
  const slash = mime.lastIndexOf('/');
  if (slash !== -1 && slash < mime.length - 1) {
    const seg = mime.slice(slash + 1);
    return seg.charAt(0).toUpperCase() + seg.slice(1);
  }
  return 'File';
};

// ── mime_tone ──────────────────────────────────────────────────────────
//
// Maps a Google Drive MIME type to a badge tone:
//   Docs     → "info"
//   Sheets   → "success"
//   Slides   → "warning"
//   PDF      → "danger"
//   Folder   → "muted"
//   else     → "default"
//
// Args: { value: string } — the file's mimeType field

const mime_tone: ComputedFunction = (args) => {
  const mime = str(args.value).toLowerCase();

  if (mime === 'application/vnd.google-apps.document') return 'info';
  if (mime === 'application/vnd.google-apps.spreadsheet') return 'success';
  if (mime === 'application/vnd.google-apps.presentation') return 'warning';
  if (mime === 'application/pdf') return 'danger';
  if (mime === 'application/vnd.google-apps.folder') return 'muted';
  return 'default';
};

// ── sender_name ────────────────────────────────────────────────────────
//
// Extracts the display name from a Gmail "From" header string.
//
// Examples:
//   "Alice Smith <alice@example.com>" → "Alice Smith"
//   "alice@example.com"               → "alice@example.com"
//   "<bob@example.com>"               → "bob@example.com"
//
// Args: { value: string } — the message's `from` field

const sender_name: ComputedFunction = (args) => {
  const raw = str(args.value).trim();
  if (!raw) return '';

  // Match: Display Name <email@example.com>
  const match = raw.match(/^([^<>]+?)\s*<[^>]+>$/);
  if (match) {
    const name = match[1].trim();
    if (name) return name;
  }

  // Strip angle brackets if only email present: <email@example.com>
  const bracketOnly = raw.match(/^<([^>]+)>$/);
  if (bracketOnly) return bracketOnly[1].trim();

  return raw;
};

// ── header_date_label ────────────────────────────────────────────────
//
// Short weekday + day + month for a Meet dashboard header subtitle.
//
// Examples:
//   "2026-10-05T10:00:00Z" → "Mon 5 Oct"
//   null                   → ""
//
// Args: { value: string | null } — an ISO datetime, e.g. latestMeeting.startTime

const header_date_label: ComputedFunction = (args) => {
  const ms = parseUtcMs(args.value);
  if (ms == null) return '';
  const d = new Date(ms);
  const weekday = WEEKDAY_ABBREV[d.getUTCDay()];
  const day = d.getUTCDate();
  const month = MONTH_ABBREV[d.getUTCMonth()];
  const monthTitle = month.charAt(0) + month.slice(1).toLowerCase();
  return `${weekday} ${day} ${monthTitle}`;
};

// ── day_number ────────────────────────────────────────────────────────
//
// UTC day-of-month, no leading zero — the top half of a two-line date
// badge (day over month abbreviation).
//
// Examples: "2026-10-02T09:00:00Z" → "2"
//
// Args: { value: string | null }

const day_number: ComputedFunction = (args) => {
  const ms = parseUtcMs(args.value);
  if (ms == null) return '–';
  return String(new Date(ms).getUTCDate());
};

// ── month_abbrev ─────────────────────────────────────────────────────
//
// Upper-case 3-letter UTC month abbreviation — the bottom half of a
// two-line date badge.
//
// Examples: "2026-10-02T09:00:00Z" → "OCT"
//
// Args: { value: string | null }

const month_abbrev: ComputedFunction = (args) => {
  const ms = parseUtcMs(args.value);
  if (ms == null) return '';
  return MONTH_ABBREV[new Date(ms).getUTCMonth()];
};

// ── transcript_status_tone ──────────────────────────────────────────
//
// Maps a transcript status to a token tone for a Badge/Dot/Icon.
//   "ready"      → "success"
//   "processing" → "warning"
//   "none"       → "muted"
//
// Args: { value: "ready" | "processing" | "none" }

const transcript_status_tone: ComputedFunction = (args) => {
  const status = normalizeStatus(args.value);
  if (status === 'ready') return 'success';
  if (status === 'processing') return 'warning';
  return 'muted';
};

// ── transcript_status_title ──────────────────────────────────────────
//
// Title-Case label for a transcript status, for the recent-meetings list
// pill. Never render the raw enum value.
//   "ready" → "Ready", "processing" → "Processing", "none" → "No transcript"
//
// Args: { value: "ready" | "processing" | "none" }

const transcript_status_title: ComputedFunction = (args) => {
  const status = normalizeStatus(args.value);
  if (status === 'ready') return 'Ready';
  if (status === 'processing') return 'Processing';
  return 'No transcript';
};

// ── transcript_status_icon ───────────────────────────────────────────
//
// Lucide outline icon name for a transcript status badge.
//   "ready" → "CheckCircle2", "processing" → "Clock", "none" → "CircleSlash"
//
// Args: { value: "ready" | "processing" | "none" }

const transcript_status_icon: ComputedFunction = (args) => {
  const status = normalizeStatus(args.value);
  if (status === 'ready') return 'CheckCircle2';
  if (status === 'processing') return 'Clock';
  return 'CircleSlash';
};

// ── transcript_banner_label ──────────────────────────────────────────
//
// Full status line for the meeting header pill, e.g.
//   ("ready", 6240)      → "Transcript ready · 6,240 words"
//   ("processing", null) → "Transcript processing…"
//   ("none", null)       → "No transcript available"
//
// Args: { status: "ready" | "processing" | "none", wordCount: number | null }

const transcript_banner_label: ComputedFunction = (args) => {
  const status = normalizeStatus(args.status);
  if (status === 'ready') {
    const words = Number(args.wordCount);
    const wordsLabel = Number.isFinite(words) ? `${words.toLocaleString('en-US')} words` : 'word count unavailable';
    return `Transcript ready · ${wordsLabel}`;
  }
  if (status === 'processing') return 'Transcript processing…';
  return 'No transcript available';
};

// ── speaker_tone ─────────────────────────────────────────────────────
//
// Assigns a stable tone to a speaker by their rank in the talk-time list
// (sorted desc by percent), so the same speaker's talk-time bar and their
// transcript-search result dot always match colors.
//
// Args:
//   speaker:  string — the current row's speaker name
//   talkTime: { speaker: string }[] — the full talk-time list for the meeting

const speaker_tone: ComputedFunction = (args) => {
  const speaker = str(args.speaker).trim().toLowerCase();
  const talkTime = Array.isArray(args.talkTime) ? args.talkTime : [];
  const idx = talkTime.findIndex(
    (row) => str((row as Record<string, unknown>)?.speaker).trim().toLowerCase() === speaker,
  );
  const safeIdx = idx === -1 ? 0 : idx;
  return SPEAKER_TONES[safeIdx % SPEAKER_TONES.length];
};

// ── entry_matches_query ──────────────────────────────────────────────
//
// Case-insensitive substring match for live transcript search. Returns
// false (hide the row) when the query is blank, so nothing renders until
// the user types.
//
// Args: { speaker: string, text: string, query: string }

const entry_matches_query: ComputedFunction = (args) => {
  const query = str(args.query).trim().toLowerCase();
  if (!query) return false;
  const haystack = `${str(args.speaker)} ${str(args.text)}`.toLowerCase();
  return haystack.includes(query);
};

// ── count_transcript_matches ─────────────────────────────────────────
//
// Counts transcript entries whose speaker or text contains the query
// (case-insensitive substring). Returns 0 for a blank query.
//
// Args: { entries: { speaker: string, text: string }[], query: string }

const count_transcript_matches: ComputedFunction = (args) => {
  const query = str(args.query).trim().toLowerCase();
  if (!query) return 0;
  const entries = Array.isArray(args.entries) ? args.entries : [];
  return entries.reduce((count, entry) => {
    const row = entry as Record<string, unknown>;
    const haystack = `${str(row?.speaker)} ${str(row?.text)}`.toLowerCase();
    return haystack.includes(query) ? count + 1 : count;
  }, 0);
};

// ── module export ────────────────────────────────────────────────────

const elements: PluginElementsModule = {
  slug: 'google-workspace',
  functions: {
    mime_label,
    mime_tone,
    sender_name,
    header_date_label,
    day_number,
    month_abbrev,
    transcript_status_tone,
    transcript_status_title,
    transcript_status_icon,
    transcript_banner_label,
    speaker_tone,
    entry_matches_query,
    count_transcript_matches,
  },
};

export default elements;
