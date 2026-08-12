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
    /**
     * V2 mode (recommended): the KEY of the tenant-level platform agent this
     * bridge operates (agent_definitions.key, e.g. 'myconnect-builder'). When
     * set, the bridge authenticates as an ADMIN and acts AS the agent principal
     * via the workq_agent_* MCP tools — comments/status are attributed to the
     * agent, and it appears in the workspace Agents tab. Preferred over the v1
     * service-account path below.
     */
    agentKey: z.string().optional(),
    /**
     * V1 mode (legacy dry-run): users.id of the "myConnect Builder" service
     * account items are assigned to (the poll target). Required only when
     * agentKey is NOT set.
     */
    builderUserId: z.string().uuid().optional(),
    /**
     * V1 only: users.id the bridge is authenticated as (its comment-author
     * identity), used to ignore its own comments. Defaults to builderUserId.
     * Ignored in v2 (the agent principal is resolved from the inbox).
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
}).refine((c) => Boolean(c.agentKey) !== Boolean(c.builderUserId), {
    message: 'set exactly one of agentKey (v2) or builderUserId (v1)',
});
export function loadConfig(path) {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    const parsed = bridgeConfigSchema.safeParse(raw);
    if (!parsed.success) {
        throw new Error(`Invalid bridge config at ${path}: ${parsed.error.message}`);
    }
    return parsed.data;
}
