import { describe, it, expect } from 'vitest';
import { bridgeConfigSchema } from './config.js';

const base = {
  workspaceMcpUrl: 'https://qa.example/mcp',
  approverUserIds: ['00000000-0000-4000-8000-000000000001'],
  intakeAllowlistUserIds: ['00000000-0000-4000-8000-000000000001'],
  repoPath: 'C:/repo',
};

describe('bridgeConfigSchema — mode selection', () => {
  it('accepts v2 (agentKey only)', () => {
    const r = bridgeConfigSchema.safeParse({ ...base, agentKey: 'myconnect-builder' });
    expect(r.success).toBe(true);
  });

  it('accepts v1 (builderUserId only)', () => {
    const r = bridgeConfigSchema.safeParse({
      ...base,
      builderUserId: '00000000-0000-4000-8000-000000000009',
    });
    expect(r.success).toBe(true);
  });

  it('rejects BOTH agentKey and builderUserId', () => {
    const r = bridgeConfigSchema.safeParse({
      ...base,
      agentKey: 'myconnect-builder',
      builderUserId: '00000000-0000-4000-8000-000000000009',
    });
    expect(r.success).toBe(false);
  });

  it('rejects NEITHER', () => {
    const r = bridgeConfigSchema.safeParse({ ...base });
    expect(r.success).toBe(false);
  });
});
