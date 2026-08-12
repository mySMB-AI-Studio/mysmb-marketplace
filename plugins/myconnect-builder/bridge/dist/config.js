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
    /** users.id of the "myConnect Builder" account items are assigned to
     *  (the poll target — what the PM assigns work to). */
    builderUserId: z.string().uuid(),
    /**
     * users.id the bridge is AUTHENTICATED as (its comment-author identity).
     * In v1's dry-run the OAuth login is a real human (the service account has
     * no Entra login), so this differs from builderUserId; the bridge uses it
     * to ignore its OWN comments. Defaults to builderUserId (v2: the platform
     * agent principal is both the assignee and the author).
     */
    selfUserId: z.string().uuid().optional(),
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
export function loadConfig(path) {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    const parsed = bridgeConfigSchema.safeParse(raw);
    if (!parsed.success) {
        throw new Error(`Invalid bridge config at ${path}: ${parsed.error.message}`);
    }
    return parsed.data;
}
