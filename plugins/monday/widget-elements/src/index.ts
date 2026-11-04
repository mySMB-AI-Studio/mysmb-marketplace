import type { ComputedFunction } from './types';
import type { PluginElementsModule } from './types';

/**
 * monday.com's board activity log reports events as internal snake_case
 * codes (e.g. "create_pulse", "change_column_value") — not something to
 * show a user as-is. Maps the common codes to a short human phrase;
 * anything unrecognised falls back to a humanized version of the code
 * itself (underscores → spaces, first letter capitalized) rather than
 * hiding or erroring on an event monday adds later.
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "monday_activity_label", "args": { "value": { "$item": "event" } } }
 */
const KNOWN_EVENTS: Record<string, string> = {
  create_pulse: 'created an item',
  delete_pulse: 'deleted an item',
  archive_pulse: 'archived an item',
  duplicate_pulse: 'duplicated an item',
  move_pulse_into_group: 'moved an item',
  create_update: 'posted an update',
  delete_update: 'deleted an update',
  create_column: 'added a column',
  delete_column: 'deleted a column',
  change_column_value: 'updated a column value',
  change_column_metadata: 'renamed a column',
  create_group: 'added a group',
  delete_group: 'deleted a group',
  archive_group: 'archived a group',
  create_board: 'created the board',
  archive_board: 'archived the board',
  add_subscribers_to_board: 'added subscribers',
  remove_subscribers_from_board: 'removed subscribers',
};

function labelForEvent(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const known = KNOWN_EVENTS[trimmed];
  if (known) return known;
  const humanized = trimmed.replace(/_/g, ' ');
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}

const activity_label: ComputedFunction = (args) => labelForEvent(String(args.value ?? ''));

const KNOWN_ENTITIES: Record<string, string> = { pulse: 'Item', board: 'Board' };

/**
 * Humanizes monday's `entity` field ("pulse" → "Item", "board" → "Board").
 * monday calls board items "pulses" internally — not a word to show a user.
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "monday_entity_label", "args": { "value": { "$item": "entity" } } }
 */
const entity_label: ComputedFunction = (args) => {
  const raw = String(args.value ?? '').trim();
  if (!raw) return '';
  return KNOWN_ENTITIES[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
};

/**
 * Pretty-prints a JSON string for display (monday's activity_logs `data`
 * field). Falls back to the raw string unchanged if it isn't valid JSON —
 * never hides or errors on a shape monday changes later.
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "monday_pretty_json", "args": { "value": { "$item": "data" } } }
 */
const pretty_json: ComputedFunction = (args) => {
  const raw = String(args.value ?? '');
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
};

/**
 * Flattens monday's board_activity rows (nested `user: { name }`, raw
 * `event` codes) into render-ready fields for a repeat list: `actor_name`,
 * `action_text`, `created_at`, plus the raw `event`/`entity`/`data` fields
 * for an expanded detail view. Mirrors the shape widget specs need from a
 * `$item` binding inside a `repeat` — nested-path `$item` reads aren't
 * something to assume support for, so flatten here instead.
 *
 * Args: { value: array }
 *
 * Spec example:
 *   { "$computed": "monday_flatten_activity", "args": { "value": { "$state": "/monday/get_board_activity" } } }
 */
const flatten_activity: ComputedFunction = (args) => {
  const arr = Array.isArray(args.value) ? args.value : [];
  return arr.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    const user = (r.user ?? null) as Record<string, unknown> | null;
    const actorName = typeof user?.name === 'string' && user.name ? user.name : 'Someone';
    return {
      id: r.id,
      actor_name: actorName,
      action_text: labelForEvent(String(r.event ?? '')),
      created_at: r.created_at,
      event: r.event,
      entity: r.entity,
      data: r.data,
    };
  });
};

const elements: PluginElementsModule = {
  slug: 'monday',
  functions: { activity_label, entity_label, pretty_json, flatten_activity },
};
export default elements;
