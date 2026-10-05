import type { ComputedFunction, PluginElementsModule } from './types.js';

/** `2026-10-05T06:00:00Z` → `Oct 5, 2026 · 6:00 AM` (falls back to the raw value on a bad date). */
const format_datetime: ComputedFunction = (args) => {
  const value = args.value;
  if (!value || typeof value !== 'string') return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const datePart = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
};

/** Builds the meeting picker's options from list_recordings' `meetings` array. */
const recording_options: ComputedFunction = (args) => {
  const meetings = Array.isArray(args.meetings) ? (args.meetings as Record<string, unknown>[]) : [];
  return meetings
    .map((m) => {
      const id = String(m.id ?? '').trim();
      if (!id) return null;
      const topic = String(m.topic ?? 'Untitled meeting').trim();
      const date = format_datetime({ value: m.start_time });
      return { value: id, label: date ? `${topic} — ${date}` : topic };
    })
    .filter((o): o is { value: string; label: string } => o !== null);
};

/** Finds the selected meeting's full record (topic, start_time, duration, recording_files) by id. */
const selected_meeting: ComputedFunction = (args) => {
  const meetings = Array.isArray(args.meetings) ? (args.meetings as Record<string, unknown>[]) : [];
  const id = String(args.meetingId ?? '').trim();
  if (!id) return null;
  return meetings.find((m) => String(m.id ?? '') === id) ?? null;
};

/** Minutes → `1h 5m` / `45m`. */
const format_duration: ComputedFunction = (args) => {
  const minutes = Number(args.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
};

/** `00:01:02.500` → `1:02` (drops the hour segment when it's zero, drops milliseconds). */
function formatVttTimestamp(raw: string): string {
  const [h, m, s] = raw.split(':');
  const seconds = (s ?? '0').split('.')[0];
  const hours = Number(h) || 0;
  if (hours > 0) return `${hours}:${m.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
  return `${Number(m)}:${seconds.padStart(2, '0')}`;
}

/**
 * Parses Zoom's raw WebVTT transcript text into clean `{ start, text }` cues
 * for a scrollable line-by-line display — the raw VTT (cue-number lines,
 * `HH:MM:SS.mmm --> HH:MM:SS.mmm` timecodes) is unreadable as-is.
 */
const transcript_lines: ComputedFunction = (args) => {
  const raw = String(args.transcript ?? '');
  if (!raw.trim()) return [];
  const blocks = raw.replace(/\r\n/g, '\n').split(/\n\n+/);
  const cues: { start: string; text: string }[] = [];
  const timeRe = /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/;

  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() && l.trim() !== 'WEBVTT');
    const timeLineIndex = lines.findIndex((l) => timeRe.test(l));
    if (timeLineIndex === -1) continue;
    const match = lines[timeLineIndex].match(timeRe);
    const start = match ? formatVttTimestamp(match[1]) : '';
    const text = lines
      .slice(timeLineIndex + 1)
      .join(' ')
      .trim();
    if (text) cues.push({ start, text });
  }
  return cues;
};

/** Tone for the transcript-availability banner: success when ready, warning otherwise. */
const transcript_tone: ComputedFunction = (args) => (args.available ? 'success' : 'warning');

/**
 * Zoom's list_recordings defaults to a same-day window when no from/to is
 * given (confirmed live) — without an explicit range the picker would almost
 * always look empty. Returns a 30-day lookback window ending today.
 * Optional { field } arg extracts "from" or "to"; omit for the full object.
 */
const recent_window: ComputedFunction = (args) => {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 30);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const result = { from: fmt(from), to: fmt(today) };
  const field = args.field as string | undefined;
  return field ? result[field as keyof typeof result] : result;
};

/**
 * Tone for how soon a meeting starts — warning (today/tomorrow), muted
 * (further out) — so the Upcoming Meetings list reads at a glance without
 * requiring the viewer to parse every date. Deliberately NOT "accent": that
 * tone collapses to plain foreground text and a near-neutral background in
 * this design system (see @myhub/widget-tokens), so it renders as no color
 * at all — "success"/"warning"/"destructive"/"muted" are the tones with
 * actual distinct colors.
 */
const meeting_urgency_tone: ComputedFunction = (args) => {
  const value = args.startTime;
  if (!value || typeof value !== 'string') return 'muted';
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return 'muted';
  const now = new Date();
  const diffDays = (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= 1 ? 'warning' : 'muted';
};

/**
 * Zoom's recording `type` field (confirmed against the live OpenAPI spec)
 * overloads meeting/webinar type codes with two special values on this
 * endpoint: "96" = generated by My Notes, "99" = uploaded via the web
 * portal. "Cloud recordings" (Zoom's own Hub naming) means everything
 * EXCEPT My Notes — the two are shown as separate tabs in Zoom's own UI.
 */
const filter_cloud_recordings: ComputedFunction = (args) => {
  const meetings = Array.isArray(args.meetings) ? (args.meetings as Record<string, unknown>[]) : [];
  return meetings.filter((m) => String(m.type ?? '') !== '96');
};

/** My Notes recordings — `type: "96"` on the same recordings response. */
const filter_my_notes: ComputedFunction = (args) => {
  const meetings = Array.isArray(args.meetings) ? (args.meetings as Record<string, unknown>[]) : [];
  return meetings.filter((m) => String(m.type ?? '') === '96');
};

/** Only meetings that actually have a TRANSCRIPT file among their recording_files. */
const filter_transcribable: ComputedFunction = (args) => {
  const meetings = Array.isArray(args.meetings) ? (args.meetings as Record<string, unknown>[]) : [];
  return meetings.filter((m) => {
    const files = Array.isArray(m.recording_files) ? (m.recording_files as Record<string, unknown>[]) : [];
    return files.some((f) => f.file_type === 'TRANSCRIPT');
  });
};

/** Button variant for a tab strip — filled when active, ghost otherwise. */
const tab_variant: ComputedFunction = (args) => (String(args.active ?? '') === String(args.match ?? '') ? 'primary' : 'ghost');

/** Whether a tab strip's content panel should be visible. */
const is_active_tab: ComputedFunction = (args) => String(args.active ?? '') === String(args.match ?? '');

const elements: PluginElementsModule = {
  slug: 'zoom',
  functions: {
    recording_options,
    selected_meeting,
    format_datetime,
    format_duration,
    transcript_lines,
    transcript_tone,
    recent_window,
    meeting_urgency_tone,
    filter_cloud_recordings,
    filter_my_notes,
    filter_transcribable,
    tab_variant,
    is_active_tab,
  },
};

export default elements;
