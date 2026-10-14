/**
 * Binding expressions — the `{{ … }}` micro-language that connects node params
 * to the run context (architecture/technical/automations.md §5).
 *
 * A binding is one expression of the form
 *   {{ <path> }}            or
 *   {{ <path> ?? <path> ?? … }}
 * where <path> starts at one of four roots:
 *   trigger — the frozen trigger payload (trigger.event.subject.x, trigger.actor_user_id)
 *   params  — the automation-level params resolved for this run
 *   steps   — upstream node outputs, ONLY as steps.<nodeId>.outputs.<name>[.deeper…]
 *   item    — the enclosing foreach's per-iteration variable
 *
 * Whole-value only: a param is either a literal `value` or exactly one binding
 * expression — string interpolation happens in Python code, not in bindings.
 * `??` falls through null/undefined (NOT falsy values like 0 or "").
 *
 * One implementation is shared by the executor (resolve at run time), the
 * semantic validator (upstream/output checks) and the editor's design-time
 * content picker (which serializes picks into these expressions).
 */

export const BINDING_ROOTS = ['trigger', 'params', 'steps', 'item'] as const;
export type BindingRoot = (typeof BINDING_ROOTS)[number];

export interface BindingPath {
  root: BindingRoot;
  /** Path segments after the root (may be empty for bare `{{ item }}`). */
  path: string[];
}

export interface ParsedBinding {
  /** Fallback alternatives in `??` order — first defined, non-null wins. */
  alternatives: BindingPath[];
  /** The original source text, for error messages and re-serialization. */
  source: string;
}

export interface StepRef {
  stepId: string;
  output: string;
}

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** True when `value` is exactly one binding expression (allowing outer whitespace). */
export function isBindingString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const t = value.trim();
  return t.startsWith('{{') && t.endsWith('}}') && !t.slice(2, -2).includes('{{');
}

function parsePath(raw: string, source: string): BindingPath {
  const segments = raw.split('.').map((s) => s.trim());
  if (segments.length === 0 || segments.some((s) => s === '')) {
    throw new Error(`Invalid binding path "${raw}" in ${source}`);
  }
  const [root, ...rest] = segments as [string, ...string[]];
  if (!(BINDING_ROOTS as readonly string[]).includes(root)) {
    throw new Error(
      `Unknown binding root "${root}" in ${source} — expected one of ${BINDING_ROOTS.join(', ')}`,
    );
  }
  for (const seg of rest) {
    if (!IDENT.test(seg)) throw new Error(`Invalid binding segment "${seg}" in ${source}`);
  }
  if (root === 'steps') {
    // steps bindings must name a node output: steps.<id>.outputs.<name>[.deeper]
    if (rest.length < 3 || rest[1] !== 'outputs') {
      throw new Error(
        `steps bindings must have the shape steps.<nodeId>.outputs.<name> — got ${source}`,
      );
    }
  }
  if ((root === 'trigger' || root === 'params') && rest.length === 0) {
    throw new Error(`Binding "${source}" must select a field under ${root}`);
  }
  return { root: root as BindingRoot, path: rest };
}

/** Parse a binding expression. Throws with a descriptive message when malformed. */
export function parseBinding(expression: string): ParsedBinding {
  const trimmed = expression.trim();
  if (!trimmed.startsWith('{{') || !trimmed.endsWith('}}')) {
    throw new Error(`Binding must be a single {{ … }} expression — got "${expression}"`);
  }
  const inner = trimmed.slice(2, -2).trim();
  if (inner.length === 0) throw new Error('Empty binding expression');
  if (inner.includes('{{') || inner.includes('}}')) {
    throw new Error(`Nested braces are not allowed in bindings: "${expression}"`);
  }
  const alternatives = inner.split('??').map((part) => parsePath(part.trim(), expression));
  return { alternatives, source: trimmed };
}

/** All `steps.<id>.outputs.<name>` references across the fallback chain. */
export function stepRefsOf(binding: ParsedBinding): StepRef[] {
  return binding.alternatives
    .filter((a) => a.root === 'steps')
    .map((a) => ({ stepId: a.path[0]!, output: a.path[2]! }));
}

export interface BindingContext {
  trigger?: unknown;
  params?: unknown;
  steps?: unknown;
  item?: unknown;
}

function walk(value: unknown, path: string[]): unknown {
  let current = value;
  for (const seg of path) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

/**
 * Resolve a parsed binding against a run context. Returns the first
 * alternative whose value is neither null nor undefined; undefined otherwise.
 */
export function resolveBinding(binding: ParsedBinding, ctx: BindingContext): unknown {
  for (const alt of binding.alternatives) {
    const value = walk(ctx[alt.root], alt.path);
    if (value !== null && value !== undefined) return value;
  }
  return undefined;
}
