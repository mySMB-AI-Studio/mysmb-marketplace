/**
 * The myConnect Builder state machine (design spec §5). Stage lives in mcb:*
 * labels on the WorkQ item; approvals are comments verified by AUTHOR USER ID
 * against the approver allowlist; intake is verified against the item-creator
 * allowlist (the prompt-injection boundary — unlisted users' text never
 * reaches Claude Code).
 *
 * One item action runs at a time — the daemon tick is sequential by design
 * (one repo, one laptop).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runClaude } from './claude.js';
import { parseCommand, stageFromLabels, withStageLabels, BLOCKED_LABEL, HOLD_LABEL, } from './commands.js';
const SIGNATURE = '🔧 myConnect Builder';
export class Pipeline {
    cfg;
    ws;
    store;
    log;
    /** In v2, the platform agent's principal id (resolved from the inbox) — used
     *  to ignore the agent's OWN comments when scanning for approver commands. */
    agentPrincipalId;
    constructor(cfg, ws, store, log = console.log) {
        this.cfg = cfg;
        this.ws = ws;
        this.store = store;
        this.log = log;
    }
    get v2() {
        return Boolean(this.cfg.agentKey);
    }
    /** One full pass over the builder's queue. */
    async tick() {
        let items;
        if (this.v2) {
            const inbox = await this.ws.agentInbox(this.cfg.agentKey);
            this.agentPrincipalId = inbox.principalUserId;
            items = inbox.items;
        }
        else {
            items = await this.ws.listAssigned(this.cfg.builderUserId);
        }
        for (const item of items) {
            try {
                await this.processItem(item);
            }
            catch (err) {
                this.log(`[${item.id}] tick error: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    }
    // ── Write surface (mode-aware: v2 acts AS the agent; v1 as the OAuth user) ──
    writeComment(todoId, body, mentions = []) {
        return this.v2
            ? this.ws.agentComment(this.cfg.agentKey, todoId, body, mentions)
            : this.ws.addComment(todoId, body, mentions);
    }
    writeLabels(todoId, labels) {
        return this.v2
            ? this.ws.agentUpdate(this.cfg.agentKey, todoId, { labels })
            : this.ws.setLabels(todoId, labels);
    }
    writeStatus(todoId, status) {
        return this.v2
            ? this.ws.agentUpdate(this.cfg.agentKey, todoId, { status })
            : this.ws.setStatus(todoId, status);
    }
    async processItem(item) {
        const stage = stageFromLabels(item.labels);
        const blocked = item.labels.includes(BLOCKED_LABEL);
        const held = item.labels.includes(HOLD_LABEL);
        if (stage === null) {
            await this.intake(item, blocked);
            return;
        }
        // Review/hold/blocked states are driven by new approver comments.
        const commands = await this.newApproverCommands(item);
        if (held) {
            if (commands.some((c) => c.cmd.type === 'resume')) {
                await this.setStage(item, stage, {});
                await this.say(item.id, `Resumed at stage \`${stage}\`.`);
            }
            return;
        }
        if (blocked) {
            if (commands.some((c) => c.cmd.type === 'resume')) {
                await this.setStage(item, stage, {});
                // Runnable stages retry their Claude run; review stages just clear
                // the flag and fall back to waiting on gate commands.
                if (stage === 'planning' || stage === 'executing' || stage === 'deploying') {
                    await this.runStage(item, stage);
                }
            }
            return;
        }
        if (commands.some((c) => c.cmd.type === 'hold')) {
            await this.setStage(item, stage, { hold: true });
            await this.say(item.id, 'On hold. Comment `resume` to continue.');
            return;
        }
        switch (stage) {
            case 'planning':
                await this.runStage(item, 'planning');
                return;
            case 'plan-review': {
                const changes = commands.find((c) => c.cmd.type === 'request_changes');
                if (changes && changes.cmd.type === 'request_changes') {
                    this.pushNotes(item.id, changes.cmd.notes);
                    await this.setStage(item, 'planning', {});
                    await this.runStage(item, 'planning');
                    return;
                }
                if (commands.some((c) => c.cmd.type === 'approve_plan')) {
                    await this.setStage(item, 'executing', {});
                    await this.say(item.id, 'Plan approved — starting the build.');
                    await this.runStage(item, 'executing');
                }
                return;
            }
            case 'executing':
                await this.runStage(item, 'executing');
                return;
            case 'qa-review': {
                const changes = commands.find((c) => c.cmd.type === 'request_changes');
                if (changes && changes.cmd.type === 'request_changes') {
                    this.pushNotes(item.id, changes.cmd.notes);
                    await this.setStage(item, 'executing', {});
                    await this.runStage(item, 'executing');
                    return;
                }
                if (commands.some((c) => c.cmd.type === 'approve_release')) {
                    await this.setStage(item, 'deploying', {});
                    await this.say(item.id, 'Release approved — deploying to UAT, then Production.');
                    await this.runStage(item, 'deploying');
                }
                return;
            }
            case 'deploying':
                await this.runStage(item, 'deploying');
                return;
        }
    }
    // ── Intake ────────────────────────────────────────────────────────────────
    async intake(item, alreadyRejected) {
        if (!this.cfg.intakeAllowlistUserIds.includes(item.createdBy)) {
            if (!alreadyRejected) {
                await this.writeLabels(item.id, withStageLabels(item.labels, null, { blocked: true }));
                await this.say(item.id, 'This item was not created by a listed requester, so I will not act on it. ' +
                    'Ask a myConnect approver to re-file it.');
            }
            return;
        }
        this.store.update(item.id, { lastCommentIso: new Date().toISOString(), pendingNotes: [] });
        await this.writeStatus(item.id, 'in_progress');
        await this.setStage(item, 'planning', {});
        await this.say(item.id, 'Picked up — reading the request and attachments now. ' +
            'I will post an execution plan here for review.');
        await this.runStage({ ...item, status: 'in_progress' }, 'planning');
    }
    // ── Stage runners ─────────────────────────────────────────────────────────
    async runStage(item, stage) {
        const stageCfg = this.cfg.stages[stage];
        const st = this.store.item(item.id);
        const notes = (st.pendingNotes ?? []).splice(0);
        this.store.update(item.id, { pendingNotes: [] });
        const prompt = stage === 'planning'
            ? await this.planningPrompt(item, notes)
            : stage === 'executing'
                ? this.executingPrompt(item, notes)
                : this.deployingPrompt(item);
        this.log(`[${item.id}] running ${stage} (timeout ${stageCfg.timeoutMinutes}m)…`);
        const run = await runClaude({
            claudeBin: this.cfg.claudeBin,
            cwd: this.cfg.repoPath,
            prompt,
            permissionMode: stageCfg.permissionMode,
            timeoutMs: stageCfg.timeoutMinutes * 60_000,
            resumeSessionId: st.sessionId,
        });
        if (run.sessionId)
            this.store.update(item.id, { sessionId: run.sessionId });
        if (!run.ok) {
            await this.block(item, stage, run.output);
            return;
        }
        if (stage === 'planning') {
            await this.publishPlan(item, run.output);
        }
        else if (stage === 'executing') {
            await this.setStage(item, 'qa-review', {});
            await this.say(item.id, `**QA build is ready for review.**\n\n${clip(run.output, 2500)}\n\n` +
                'When it looks good, comment `approve release` to ship UAT + Production, ' +
                'or `request changes: <notes>` to send it back.', this.cfg.approverUserIds);
        }
        else {
            await this.ws.setLabels(item.id, withStageLabels(item.labels, null));
            await this.say(item.id, `**Shipped.** UAT and Production deploys are complete.\n\n${clip(run.output, 2500)}`, this.cfg.approverUserIds);
            await this.ws.setStatus(item.id, 'done');
            this.store.forget(item.id);
        }
    }
    async publishPlan(item, planText) {
        const planDir = join(this.cfg.repoPath, '.mcb', item.id);
        mkdirSync(planDir, { recursive: true });
        const planPath = join(planDir, 'plan.md');
        writeFileSync(planPath, planText, 'utf8');
        this.store.update(item.id, { planPath });
        try {
            await this.ws.uploadAttachment(item.id, 'execution-plan.md', 'text/markdown', Buffer.from(planText, 'utf8'));
        }
        catch (err) {
            // Non-fatal — the summary comment still carries the plan.
            this.log(`[${item.id}] plan upload failed: ${err instanceof Error ? err.message : err}`);
        }
        await this.setStage(item, 'plan-review', {});
        await this.say(item.id, `**Execution plan ready** (full plan attached as \`execution-plan.md\`).\n\n${summarize(planText)}\n\n` +
            'Comment `approve plan` to start the build, or `request changes: <notes>`.', this.cfg.approverUserIds);
    }
    // ── Prompts ───────────────────────────────────────────────────────────────
    async planningPrompt(item, notes) {
        const inputDir = join(this.cfg.repoPath, '.mcb', item.id, 'inputs');
        mkdirSync(inputDir, { recursive: true });
        const files = [];
        for (const att of await this.ws.listAttachments(item.id)) {
            try {
                const { fileName, bytes } = await this.ws.downloadAttachment(item.id, att.id);
                const p = join(inputDir, fileName);
                writeFileSync(p, bytes);
                files.push(p);
            }
            catch (err) {
                this.log(`[${item.id}] attachment ${att.fileName} download failed: ${err instanceof Error ? err.message : err}`);
            }
        }
        return [
            'You are the myConnect Builder working on a change request tracked as a workspace WorkQ item.',
            `# Request: ${item.title}`,
            item.description ? `## Item description\n${item.description}` : '',
            files.length
                ? `## Change documents (read ALL of these first)\n${files.map((f) => `- ${f}`).join('\n')}`
                : '## Change documents\n(none attached — plan from the item description alone)',
            notes.length ? `## Reviewer feedback to incorporate\n${notes.map((n) => `- ${n}`).join('\n')}` : '',
            '',
            'Produce a concrete execution plan for this request against this repository.',
            'Start your response with a "## Summary" section of at most 12 lines (this is shown to the project manager),',
            'then the full plan: affected areas, implementation steps, test plan, deployment steps (QA first), and risks.',
            'Do NOT make any changes yet — plan only. Your entire response is saved verbatim as the plan document.',
        ].filter(Boolean).join('\n\n');
    }
    executingPrompt(item, notes) {
        const st = this.store.item(item.id);
        return [
            `The execution plan for "${item.title}" is approved.`,
            st.planPath ? `The agreed plan is saved at: ${st.planPath} — follow it.` : '',
            notes.length ? `## Reviewer feedback to address first\n${notes.map((n) => `- ${n}`).join('\n')}` : '',
            '',
            'If the repository already contains partial work for this request (a previous run may have been interrupted),',
            'assess its state first and continue rather than starting over.',
            'Implement the plan fully, run the test suite, and fix what breaks.',
            'Then deploy to the QA environment following this repository\'s own conventions (see its CLAUDE.md / docs).',
            'Finish with a short report: what changed, test results, QA deployment outcome, and the QA URL if there is one.',
        ].filter(Boolean).join('\n\n');
    }
    deployingPrompt(item) {
        return [
            `The QA build for "${item.title}" has been verified and the release is approved.`,
            'Deploy to UAT following this repository\'s conventions, verify the deployment,',
            'then deploy to Production and verify it too.',
            'Finish with a short report: versions/commits shipped, deployment outcomes, and links.',
        ].join('\n\n');
    }
    // ── Comment handling ──────────────────────────────────────────────────────
    async newApproverCommands(item) {
        const st = this.store.item(item.id);
        const since = st.lastCommentIso ? Date.parse(st.lastCommentIso) : 0;
        // Ignore the bridge's OWN comments. v2: authored by the agent principal
        // (from the inbox). v1 dry-run: the human OAuth login (selfUserId), which
        // differs from the service account the work is assigned to.
        const selfId = this.v2 ? this.agentPrincipalId : (this.cfg.selfUserId ?? this.cfg.builderUserId);
        const comments = (await this.ws.listComments(item.id))
            .filter((c) => Date.parse(c.createdAt) > since)
            .filter((c) => c.authorId !== selfId)
            .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
        if (comments.length === 0)
            return [];
        this.store.update(item.id, { lastCommentIso: comments[comments.length - 1].createdAt });
        const results = [];
        for (const c of comments) {
            if (!this.cfg.approverUserIds.includes(c.authorId))
                continue; // unlisted authors: never parsed
            const cmd = parseCommand(c.body);
            if (cmd) {
                results.push({ cmd, comment: c });
            }
            else {
                this.pushNotes(item.id, `${c.authorName ?? c.authorId} commented: ${c.body}`);
            }
        }
        return results;
    }
    pushNotes(todoId, note) {
        const st = this.store.item(todoId);
        this.store.update(todoId, { pendingNotes: [...(st.pendingNotes ?? []), note] });
    }
    // ── Helpers ───────────────────────────────────────────────────────────────
    async setStage(item, stage, flags) {
        // Merge from the labels in hand (from the inbox/list read this tick) — in
        // v2 the admin may not be able to workq_get an item it isn't on, and the
        // acting-as surface has no read-as-agent get.
        const labels = withStageLabels(item.labels, stage, flags);
        await this.writeLabels(item.id, labels);
        item.labels = labels;
    }
    async block(item, stage, reason) {
        await this.setStage(item, stage, { blocked: true });
        await this.say(item.id, `**Blocked at \`${stage}\`.**\n\n${clip(reason, 1500)}\n\nComment \`resume\` to retry after addressing this.`, this.cfg.approverUserIds);
    }
    say(todoId, body, mentions = []) {
        // v2 comments are authored by the agent principal itself, so the signature
        // prefix is redundant; keep it in v1 (comments post as the OAuth human).
        const text = this.v2 ? body : `${SIGNATURE}\n\n${body}`;
        return this.writeComment(todoId, text, mentions);
    }
}
function clip(text, max) {
    const t = text.trim();
    return t.length <= max ? t : `${t.slice(0, max)}\n…(truncated — full output in the plan/attachments)`;
}
/** Extract the "## Summary" section for the review comment; fallback = head of the plan. */
export function summarize(planText) {
    const m = planText.match(/##\s*Summary\s*\n([\s\S]*?)(?=\n##\s|$)/i);
    const body = (m ? m[1] : planText).trim();
    const lines = body.split('\n').slice(0, 15).join('\n');
    return lines.length < body.length ? `${lines}\n…` : lines;
}
