import { describe, it, expect } from 'vitest';
import { parseCommand, stageFromLabels, withStageLabels } from './commands.js';
import { summarize } from './pipeline.js';

describe('parseCommand', () => {
  it('parses the four bare commands case-insensitively from the first non-empty line', () => {
    expect(parseCommand('Approve Plan')).toEqual({ type: 'approve_plan' });
    expect(parseCommand('\n\n  APPROVE RELEASE  \nthanks!')).toEqual({ type: 'approve_release' });
    expect(parseCommand('hold')).toEqual({ type: 'hold' });
    expect(parseCommand('Resume')).toEqual({ type: 'resume' });
  });

  it('captures request-changes notes across lines', () => {
    const cmd = parseCommand('request changes: tighten the rollout section\nand add a rollback step');
    expect(cmd).toEqual({
      type: 'request_changes',
      notes: 'tighten the rollout section\nand add a rollback step',
    });
  });

  it('returns null for discussion comments and near-misses', () => {
    expect(parseCommand('Looks good, will review tomorrow')).toBeNull();
    expect(parseCommand('can you approve plan for me?')).toBeNull(); // command must BE the first line
    expect(parseCommand('approved')).toBeNull();
    expect(parseCommand('')).toBeNull();
  });
});

describe('stage labels', () => {
  it('derives the stage from mcb:* labels and ignores foreign labels', () => {
    expect(stageFromLabels(['urgent', 'mcb:qa-review'])).toBe('qa-review');
    expect(stageFromLabels(['myconnect'])).toBeNull();
  });

  it('withStageLabels replaces every mcb:* label but preserves the rest', () => {
    const next = withStageLabels(['myconnect', 'mcb:planning', 'mcb:blocked'], 'plan-review');
    expect(next).toEqual(['myconnect', 'mcb:plan-review']);
  });

  it('supports clearing all mcb labels (completion) and flag labels', () => {
    expect(withStageLabels(['mcb:deploying', 'x'], null)).toEqual(['x']);
    expect(withStageLabels(['x'], 'executing', { blocked: true })).toEqual(['x', 'mcb:executing', 'mcb:blocked']);
  });
});

describe('summarize', () => {
  it('extracts the ## Summary section', () => {
    const plan = '## Summary\nDo A then B.\n\n## Steps\n1. A\n2. B\n';
    expect(summarize(plan)).toBe('Do A then B.');
  });

  it('falls back to the head of the plan when no Summary heading exists', () => {
    const plan = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n');
    const s = summarize(plan);
    expect(s).toContain('line 0');
    expect(s).toContain('…');
  });
});
