/**
 * microsoft-365 — widget-elements module
 * ──────────────────────────────────────────────────────────────────
 * Connector-specific `$computed` helpers contributed to the host's
 * widgets-system at runtime. The host prepends the slug `microsoft-365_`
 * to every name in `functions`, so e.g. the spec-side reference is
 * `microsoft-365_smart_day_label`.
 */

import type { ComputedFunction, PluginElementsModule } from './types';

// Graph returns dateTime strings without a timezone suffix on some fields
// (e.g. `2026-10-07T04:30:00.0000000`), which JS `Date()` would otherwise
// parse as local time. Append Z when no offset is present, matching the
// parsing convention used elsewhere in this codebase for Graph instants.
function toEpochMs(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') return null;
  const hasOffset = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(raw);
  const parsed = Date.parse(hasOffset ? raw : raw + 'Z');
  return Number.isFinite(parsed) ? parsed : null;
}

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ── smart_day_label ───────────────────────────────────────────────────
// "10:02 AM" for today, "Yesterday" for yesterday, a short weekday name
// ("Mon") for the rest of the past week, and a short date ("5 Jan") for
// anything older — the common "recent activity" day-bucketing pattern
// (seen in Teams/Outlook itself), which no system $computed provides.
// Args: { value: string | number }
const smart_day_label: ComputedFunction = (args) => {
  const ms = toEpochMs(args.value);
  if (ms == null) return '';

  const dayMs = 24 * 60 * 60 * 1000;
  const today = startOfLocalDay(Date.now());
  const day = startOfLocalDay(ms);
  const diffDays = Math.round((today - day) / dayMs);

  if (diffDays === 0) {
    return new Date(ms).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) {
    return new Date(ms).toLocaleDateString('en-AU', { weekday: 'short' });
  }
  // Future-dated (diffDays < 0) or older than a week — short absolute date.
  return new Date(ms).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
};

// ── name_tone ─────────────────────────────────────────────────────────
// Deterministic per-name color for an avatar chip, so the same person
// always gets the same color across rows. Uses the real `chart-1..5`
// decorative-color tokens (TILE-DISPLAY-STANDARDS.md §7) — 5 genuinely
// distinct hues — rather than the system's built-in avatar tint hash
// (ActivityItem's tintForInitials), which cycles through a 5-tone set
// where 3 of the 5 (info/muted/default) render as plain gray/foreground
// text, not a real color. Explicitly passing `tone` to Avatar bypasses
// that built-in hash entirely.
// Args: { value: string }
const name_tone: ComputedFunction = (args) => {
  const raw = String(args.value ?? '').trim();
  const CHART_TONES = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'];
  if (!raw) return CHART_TONES[0];
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return CHART_TONES[hash % CHART_TONES.length];
};

function emailDomain(address: unknown): string {
  const s = String(address ?? '').trim().toLowerCase();
  const at = s.lastIndexOf('@');
  return at >= 0 ? s.slice(at + 1) : '';
}

// ── meeting_type ──────────────────────────────────────────────────────
// "Internal" if every attendee shares the organizer's email domain,
// "External" if at least one attendee is on a different domain — the
// standard domain-comparison heuristic (Graph's calendar event resource
// has no dedicated internal/external field). Returns '' (unknown, not a
// guess) when the organizer's own address is missing, so callers can hide
// the indicator rather than show a wrong one.
// Args: { organizerEmail: string, attendees: { emailAddress: { address: string } }[] }
const meeting_type: ComputedFunction = (args) => {
  const organizerDomain = emailDomain(args.organizerEmail);
  if (!organizerDomain) return '';
  const attendees = Array.isArray(args.attendees) ? (args.attendees as Record<string, unknown>[]) : [];
  const isExternal = attendees.some((a) => {
    const addr = (a.emailAddress as Record<string, unknown> | undefined)?.address;
    const domain = emailDomain(addr);
    return domain !== '' && domain !== organizerDomain;
  });
  return isExternal ? 'External' : 'Internal';
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local "today" as "YYYY-MM-DD" — the format DateInput both expects and emits. */
function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/**
 * `/ui/selectedDate` starts unset until the user picks a date — seed it to
 * today once (idempotent: once `current` is truthy, this just echoes it back
 * unchanged, so it's safe to re-run every time the watched list re-fetches,
 * including after the user has picked a different date). Mirrors
 * zoom_seed_default_tab's exact current-or-fallback shape.
 * Args: { current: string }
 */
const seed_default_date: ComputedFunction = (args) => {
  const current = String(args.current ?? '').trim();
  return current || todayDateString();
};

function parseDateParts(raw: unknown): { y: number; mo: number; d: number } | null {
  const m = String(raw ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]) - 1, d: Number(m[3]) };
}

/** "YYYY-MM-DD" → local midnight of that day, as a UTC ISO string. Args: { value: string } */
const day_start_iso: ComputedFunction = (args) => {
  const p = parseDateParts(args.value);
  return p ? new Date(p.y, p.mo, p.d, 0, 0, 0, 0).toISOString() : '';
};

/** "YYYY-MM-DD" → local 23:59:59.999 of that day, as a UTC ISO string. Args: { value: string } */
const day_end_iso: ComputedFunction = (args) => {
  const p = parseDateParts(args.value);
  return p ? new Date(p.y, p.mo, p.d, 23, 59, 59, 999).toISOString() : '';
};

/**
 * "Today's Schedule" when `value` is today's date, otherwise "Schedule for
 * <weekday>, <day> <month>" — the heading needs to track whichever date is
 * actually selected once the date picker can show a day other than today.
 * Args: { value: string } — "YYYY-MM-DD"
 */
const schedule_title: ComputedFunction = (args) => {
  const raw = String(args.value ?? '').trim();
  if (!raw || raw === todayDateString()) return "Today's Schedule";
  const p = parseDateParts(raw);
  if (!p) return "Today's Schedule";
  const d = new Date(p.y, p.mo, p.d);
  return `Schedule for ${d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}`;
};

const elements: PluginElementsModule = {
  slug: 'microsoft-365',
  functions: {
    smart_day_label,
    name_tone,
    meeting_type,
    seed_default_date,
    day_start_iso,
    day_end_iso,
    schedule_title,
  },
};

export default elements;
