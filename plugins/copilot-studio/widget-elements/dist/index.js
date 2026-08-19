/**
 * copilot-studio — widget-elements
 *
 * Helpers that power the chat tile's `@`-mention typeahead. A declarative
 * widget can't host a real autocomplete popover, so we do the next best thing:
 * `mention_matches` filters the loaded agent list by whatever the user has
 * typed after a trailing `@`, and the widget renders those matches as a
 * clickable suggestion list; `apply_mention` inserts the chosen agent's name
 * back into the draft.
 */
function asAgents(value) {
    return Array.isArray(value) ? value : [];
}
/**
 * The text the user is currently typing after a trailing `@`, or null when the
 * caret isn't in a mention. `"@"` → `""` (show all), `"@xer"` → `"xer"`,
 * `"hi @xero "` → null (already completed, trailing space).
 */
function activeMentionToken(draft) {
    const m = /@([^@\s]*)$/.exec(draft);
    return m ? m[1] : null;
}
/**
 * Live `@`-mention matches for the composer. Returns up to 6 agents whose name
 * contains the text typed after a trailing `@`; `[]` when not typing a mention.
 *
 * Args: { agents: Agent[], draft: string }
 *
 * Spec example:
 *   { "$computed": "copilot-studio_mention_matches",
 *     "args": { "agents": { "$state": "/copilot-studio/list_copilot_agents/agents" },
 *               "draft":  { "$state": "/ui/draft" } } }
 */
const mention_matches = (args) => {
    const draft = String(args.draft ?? '');
    const token = activeMentionToken(draft);
    if (token === null)
        return [];
    const q = token.toLowerCase();
    const out = [];
    for (const a of asAgents(args.agents)) {
        const name = String(a.name ?? '').trim();
        if (!name)
            continue;
        if (q === '' || name.toLowerCase().includes(q)) {
            out.push({
                id: String(a.schemaName ?? name),
                name,
                schemaName: String(a.schemaName ?? ''),
                environmentId: String(a.environmentId ?? ''),
            });
            if (out.length >= 4)
                break;
        }
    }
    return out;
};
/**
 * Replace the trailing `@partial` in the draft with the chosen agent's name
 * (plus a trailing space so the suggestion list closes).
 *
 * Args: { draft: string, name: string }
 *
 * Spec example:
 *   { "$computed": "copilot-studio_apply_mention",
 *     "args": { "draft": { "$state": "/ui/draft" }, "name": { "$item": "name" } } }
 */
const apply_mention = (args) => {
    const draft = String(args.draft ?? '');
    const name = String(args.name ?? '');
    return draft.replace(/@([^@\s]*)$/, `@${name} `);
};
function agentNames(value) {
    return asAgents(value)
        .map((a) => String(a.name ?? '').trim())
        .filter(Boolean)
        .sort((a, b) => b.length - a.length); // longest first so the fullest name matches
}
/**
 * Split a message into a leading run of `@AgentName` mentions and the rest.
 * Only mentions at the START are treated as the prefix (that's how users tag —
 * pick agents, then type). Matches against the known agent names so multi-word
 * names ("@Xero - Invoice Reminder Agent") are captured whole.
 */
function splitMentions(text, names) {
    const n = text.length;
    let cursor = 0;
    let end = 0;
    for (;;) {
        let j = cursor;
        while (j < n && text[j] === ' ')
            j++;
        if (j >= n || text[j] !== '@')
            break;
        const afterAt = text.slice(j + 1);
        const match = names.find((nm) => afterAt.toLowerCase().startsWith(nm.toLowerCase()));
        if (!match)
            break;
        cursor = j + 1 + match.length;
        end = cursor;
    }
    return { prefix: text.slice(0, end), body: text.slice(end) };
}
/**
 * The leading `@mention` run of a message (bold in the chat), or "" if none.
 * Args: { text: string, agents: Agent[] }
 * Spec: { "$computed": "copilot-studio_mention_prefix", "args": { "text": {...}, "agents": {...} } }
 */
const mention_prefix = (args) => splitMentions(String(args.text ?? ''), agentNames(args.agents)).prefix;
/**
 * The message text after any leading `@mention` run.
 * Args: { text: string, agents: Agent[] }
 * Spec: { "$computed": "copilot-studio_message_body", "args": { "text": {...}, "agents": {...} } }
 */
const message_body = (args) => splitMentions(String(args.text ?? ''), agentNames(args.agents)).body;
/**
 * Map the environments from `list_copilot_environments` into Select `options`
 * ({ value, label }) for the Agent List tile's environment switcher.
 *
 * Args: { environments: Array<{ id, name }> }
 *
 * Spec: { "$computed": "copilot-studio_env_options",
 *         "args": { "environments": { "$state": "/copilot-studio/list_copilot_environments/environments" } } }
 */
const env_options = (args) => {
    const envs = Array.isArray(args.environments) ? args.environments : [];
    return envs
        .map((e) => {
        const env = (e ?? {});
        const value = String(env.id ?? '');
        return { value, label: String(env.name ?? env.id ?? '') };
    })
        .filter((o) => o.value);
};
const elements = {
    slug: 'copilot-studio',
    functions: { mention_matches, apply_mention, mention_prefix, message_body, env_options },
};
export default elements;
