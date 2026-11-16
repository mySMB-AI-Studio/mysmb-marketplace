/**
 * clickup — widget-elements module
 * ──────────────────────────────────────────────────────────────────
 * Contributed `$computed` helpers. The host prepends the slug
 * `clickup_` to every name, so e.g. the spec-side reference is
 * `clickup_date`.
 */

import type { ComputedFunction, PluginElementsModule } from './types';

// ClickUp's v2 REST API (tasks, comments) returns due_date / date_created /
// date_updated / a comment's date as a STRING of Unix milliseconds (e.g.
// "1699920000000"), confirmed against ClickUp's own live docs (Get Tasks,
// Get Task Comments) -- not a plain number and not ISO-8601, so the
// system's generic format_date_au/due_date_au/is_overdue helpers (which
// expect YYYY-MM-DD, /Date(...)/ or an ISO string) silently fail to parse
// it. Chat's v3 API (channels) documents its created_at/updated_at/
// latest_comment_at fields only as `"type": "string"` with no format
// given -- not confirmed epoch-ms like v2, and not confirmed ISO either.
// This parser tries epoch-ms first (the v2-confirmed shape), then falls
// back to Date.parse (covers ISO-8601) so either API version's date shape
// resolves correctly without guessing which one v3 actually uses.
function parseClickUpMs(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

// ── date ─────────────────────────────────────────────────────────────
// Any ClickUp epoch-ms date field (due_date, date_created, date_updated,
// a comment's date) as dd/mm/yyyy. "—" when missing/unparseable.
// Args: { value: string | number | null }
const date: ComputedFunction = (args) => {
  const ms = parseClickUpMs(args.value);
  if (ms == null) return '—';
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};

function daysUntil(ms: number): number {
  const due = new Date(ms);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - due.getTime()) / 86_400_000);
}

// ── due_status_text ──────────────────────────────────────────────────
// "Nd overdue" / "Due today" / "Not yet due" / "No due date" -- same
// phrasing convention as this marketplace's other aging-style reports.
// Args: { value: string | number | null } (a task's due_date)
const due_status_text: ComputedFunction = (args) => {
  const ms = parseClickUpMs(args.value);
  if (ms == null) return 'No due date';
  const days = daysUntil(ms);
  if (days > 0) return `${days}d overdue`;
  if (days === 0) return 'Due today';
  return 'Not yet due';
};

// ── due_status_tone ──────────────────────────────────────────────────
// Tone for the due_status_text pill: destructive (overdue), warning (due
// today), success (not yet due), muted (no due date set).
// Args: { value: string | number | null }
const due_status_tone: ComputedFunction = (args) => {
  const ms = parseClickUpMs(args.value);
  if (ms == null) return 'muted';
  const days = daysUntil(ms);
  if (days > 0) return 'destructive';
  if (days === 0) return 'warning';
  return 'success';
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
};
const PRIORITY_TONES: Record<string, string> = {
  urgent: 'destructive',
  high: 'warning',
  normal: 'muted',
  low: 'muted',
};

// ── priority_label ───────────────────────────────────────────────────
// ClickUp's priority object's own `priority` field is already lower-case
// ("urgent" | "high" | "normal" | "low" -- note "normal", not "medium")
// and the field itself is null when no priority is set on the task.
// Title-cases it, or "No priority" when null. Args: { value: string | null }
const priority_label: ComputedFunction = (args) => {
  const v = args.value == null ? '' : String(args.value);
  return PRIORITY_LABELS[v] ?? (v ? v : 'No priority');
};

// ── priority_tone ────────────────────────────────────────────────────
// Args: { value: string | null }
const priority_tone: ComputedFunction = (args) => {
  const v = args.value == null ? '' : String(args.value);
  return PRIORITY_TONES[v] ?? 'muted';
};

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  CHANNEL: 'Channel',
  DM: 'Direct message',
  GROUP_DM: 'Group DM',
  ASK_AI: 'Ask AI',
};

// ── channel_type_label ───────────────────────────────────────────────
// Args: { value: string | null } -- a channel's `type` field
const channel_type_label: ComputedFunction = (args) => {
  const v = args.value == null ? '' : String(args.value);
  return CHANNEL_TYPE_LABELS[v] ?? (v || 'Channel');
};

// Decorative categorical colors (chart-1..5), not status tones -- a
// channel's type isn't "good" or "bad", it's one of several kinds, same
// reasoning as @myhub/widget-tokens' own chart-N doc comment.
const CHANNEL_TYPE_TONES: Record<string, string> = {
  CHANNEL: 'chart-1',
  DM: 'chart-2',
  GROUP_DM: 'chart-3',
  ASK_AI: 'chart-4',
};

// ── channel_type_tone ────────────────────────────────────────────────
// Args: { value: string | null } -- a channel's `type` field
const channel_type_tone: ComputedFunction = (args) => {
  const v = args.value == null ? '' : String(args.value);
  return CHANNEL_TYPE_TONES[v] ?? 'chart-5';
};

const CHANNEL_VISIBILITY_LABELS: Record<string, string> = {
  PUBLIC: 'Public',
  PRIVATE: 'Private',
};

// ── channel_visibility_label ─────────────────────────────────────────
// Args: { value: string | null } -- a channel's `visibility` field
const channel_visibility_label: ComputedFunction = (args) => {
  const v = args.value == null ? '' : String(args.value);
  return CHANNEL_VISIBILITY_LABELS[v] ?? (v || '');
};

// ── assignee_names ───────────────────────────────────────────────────
// ClickUp's assignees array carries full user objects; join their
// usernames for a compact display line. "Unassigned" when empty.
// Args: { value: Array<{ username?: string }> | null | undefined }
const assignee_names: ComputedFunction = (args) => {
  const arr = Array.isArray(args.value) ? (args.value as Array<{ username?: string }>) : [];
  const names = arr.map((a) => a?.username).filter((n): n is string => !!n);
  return names.length ? names.join(', ') : 'Unassigned';
};

// ── task_url ─────────────────────────────────────────────────────────
// ClickUp's stable public task URL pattern (app.clickup.com/t/<task_id>).
// The Get Task / Get Tasks responses don't document a ready-made `url`
// field, so this is constructed, not passed through.
// Args: { task_id: string }
const task_url: ComputedFunction = (args) => {
  const id = args.task_id == null ? '' : String(args.task_id);
  return id ? `https://app.clickup.com/t/${id}` : '';
};

const elements: PluginElementsModule = {
  slug: 'clickup',
  functions: {
    date,
    due_status_text,
    due_status_tone,
    priority_label,
    priority_tone,
    assignee_names,
    task_url,
    channel_type_label,
    channel_type_tone,
    channel_visibility_label,
  },
};
export default elements;
