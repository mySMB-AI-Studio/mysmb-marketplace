import { readFileSync } from 'node:fs';
import { z } from 'zod';

const stageSchema = z.object({
  /** Claude Code permission mode for this stage's runs. */
  permissionMode: z.enum(['plan', 'default', 'acceptEdits', 'bypassPermissions']),
  timeoutMinutes: z.number().int().positive(),
});

export const bridgeConfigSchema = z.object({
  /** External MCP resource URI of the target workspace, e.g. https://host/mcp */
  workspaceMcpUrl: z.string().url(),
  /** users.id of the "myConnect Builder" account items are assigned to. */
  builderUserId: z.string().uuid(),
  /** Comment authors allowed to advance gates (approve plan / approve release). */
  approverUserIds: z.array(z.string().uuid()).min(1),
  /** Item creators the bridge accepts work from (prompt-injection boundary). */
  intakeAllowlistUserIds: z.array(z.string().uuid()).min(1),
  /** Local path of the myConnect repo Claude Code runs in. */
  repoPath: z.string().min(1),
  pollSeconds: z.number().int().min(10).default(45),
  claudeBin: z.string().default('claude'),
  oauthCallbackPort: z.number().int().default(8976),
  stages: z
    .object({
      planning: stageSchema.default({ permissionMode: 'plan', timeoutMinutes: 30 }),
      executing: stageSchema.default({ permissionMode: 'bypassPermissions', timeoutMinutes: 120 }),
      deploying: stageSchema.default({ permissionMode: 'bypassPermissions', timeoutMinutes: 60 }),
    })
    .default({}),
});

export type BridgeConfig = z.infer<typeof bridgeConfigSchema>;
export type StageConfig = z.infer<typeof stageSchema>;

export function loadConfig(path: string): BridgeConfig {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const parsed = bridgeConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid bridge config at ${path}: ${parsed.error.message}`);
  }
  return parsed.data;
}
