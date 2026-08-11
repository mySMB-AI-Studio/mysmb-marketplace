/**
 * PM gate-command grammar (design spec §5): commands are read from the FIRST
 * non-empty line of a comment, case-insensitively. Anything else is
 * discussion — relayed to the builder session as context, never a state
 * change. Author authorization happens in the pipeline (comment author id
 * must be on the approver allowlist); this module only parses.
 */

export type GateCommand =
  | { type: 'approve_plan' }
  | { type: 'approve_release' }
  | { type: 'request_changes'; notes: string }
  | { type: 'hold' }
  | { type: 'resume' };

export function parseCommand(body: string): GateCommand | null {
  const firstLine = body
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!firstLine) return null;
  const lower = firstLine.toLowerCase();

  if (lower === 'approve plan') return { type: 'approve_plan' };
  if (lower === 'approve release') return { type: 'approve_release' };
  if (lower === 'hold') return { type: 'hold' };
  if (lower === 'resume') return { type: 'resume' };
  if (lower.startsWith('request changes:')) {
    // Notes = everything after the colon on the first line plus the rest of
    // the comment body verbatim.
    const idx = body.toLowerCase().indexOf('request changes:');
    const notes = body.slice(idx + 'request changes:'.length).trim();
    return { type: 'request_changes', notes };
  }
  return null;
}

/** Pipeline stages carried as mcb:* labels on the WorkQ item. */
export const STAGES = [
  'planning',
  'plan-review',
  'executing',
  'qa-review',
  'deploying',
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL_PREFIX = 'mcb:';
export const BLOCKED_LABEL = 'mcb:blocked';
export const HOLD_LABEL = 'mcb:hold';

/** Derive the pipeline stage from an item's labels. Null = not yet picked up. */
export function stageFromLabels(labels: string[]): Stage | null {
  for (const s of STAGES) {
    if (labels.includes(`${STAGE_LABEL_PREFIX}${s}`)) return s;
  }
  return null;
}

/** Replace all mcb:* stage/flag labels with the given stage (+ optional flags), preserving foreign labels. */
export function withStageLabels(
  labels: string[],
  stage: Stage | null,
  flags: { blocked?: boolean; hold?: boolean } = {},
): string[] {
  const kept = labels.filter((l) => !l.startsWith(STAGE_LABEL_PREFIX));
  const next = [...kept];
  if (stage) next.push(`${STAGE_LABEL_PREFIX}${stage}`);
  if (flags.blocked) next.push(BLOCKED_LABEL);
  if (flags.hold) next.push(HOLD_LABEL);
  return next;
}
