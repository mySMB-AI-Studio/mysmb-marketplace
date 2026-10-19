// Two skills every Reporting Studio ships, one copy per platform (Reporting Library decision D8: LIB-003 scheduled reports
// and LIB-006 report-to-WorkQ actions, through the agents rather than inside the reports, because a report can't schedule
// itself or call WorkQ). Each studio's generator writes them with writeAgentSkills() and adds the WorkQ skill and the
// workspace:workq connector group to its agent with ensureAgent().
//
// Real tools only (myHubV2 apps/web/src/lib/agent/tools/): schedule_task_create / _list / _update / _delete are mounted on
// mySidekick's own turns (twin-task-sdk-tools.ts), which load every skill of every enabled extension; artifact_from_template,
// artifact_list and artifact_get (artifact-sdk-tools.ts); todo_list and todo_create come with the workspace:workq group
// (internal-workspace.ts, todo-sdk-tools.ts). WorkQ tools take user ids and no tool looks people up, so items go to the person
// who asked and are reassigned in WorkQ.
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const PLATFORMS = {
  xero: {
    name: 'Xero', plugin: 'xero-reporting-studio', prefix: 'xero',
    example: 'xero-profit-and-loss', example2: 'xero-aged-receivables', examples: '`xero-profit-and-loss`, `xero-aged-receivables`, `xero-report-pack`',
    client: 'the organisation: the template\'s `org` input takes its tenant id from `list_connections`. With one organisation, leave `org` out.',
    clientCall: 'the organisation (`xero_tenant_id`)', clientInput: '"org": "<tenant id>"',
  },
  myob: {
    name: 'MYOB', plugin: 'myob-reporting-studio', prefix: 'myob',
    example: 'profit-and-loss', example2: 'unpaid-invoices', examples: '`profit-and-loss`, `unpaid-invoices`, `report-pack`, `myob-pay-run-history`',
    client: 'the company file: the template\'s `company_file` input takes its id from `list_company_files`. With one file, leave `company_file` out.',
    clientCall: 'the company file (`myob_company_file_id`)', clientInput: '"company_file": "<company file id>"',
  },
  quickbooks: {
    name: 'QuickBooks', plugin: 'quickbooks-reporting-studio', prefix: 'quickbooks',
    example: 'quickbooks-profit-and-loss', example2: 'quickbooks-aged-receivables', examples: '`quickbooks-profit-and-loss`, `quickbooks-aged-receivables`, `quickbooks-management-reports`',
    client: 'the company: a QuickBooks connection reaches one company, so there is no client input. For another company, the user connects it first.',
    clientCall: 'the connected company', clientInput: '',
  },
};

function scheduleSkill(p) {
  const name = p.prefix + '-schedule-report';
  return { file: name + '.md', md: `---
name: ${name}
description: Set up a ${p.name} Reporting Studio report to be made again on a schedule (daily, weekly, monthly or once) and to tell the user when it's ready. Use when the user asks to "send me the P&L every Monday", "schedule a monthly report pack", "refresh this report each week" or "give me the aged receivables on Fridays".
---
# Schedule a ${p.name} report

Use when the user wants a ${p.name} Reporting Studio report made again on a schedule. This works in mySidekick, which has the scheduled-task tools (\`schedule_task_create\`, \`schedule_task_list\`, \`schedule_task_update\`, \`schedule_task_delete\`). Without them (a reporting agent, or scheduled tasks turned off for the workspace) you can't schedule: say so, and suggest asking mySidekick with the report's name. Never promise a schedule you can't set.

1. **The report:** its template slug in the extension \`${p.plugin}\` is the report skill's name (for example ${p.examples}). If unsure, ask, or offer the Reports Catalogue. Never schedule a report the studio doesn't ship.
2. **The client:** ${p.client} One task per client: never mix clients in one task. Ask when more than one could be meant.
3. **When:** daily, weekdays, weekly (which day), monthly (day 1 to 28) or once, at a time of day (24-hour, the user's timezone). If they don't say, use Monday 08:00 for a weekly report and say so.
4. **The period:** keep the template's own rolling period (its defaults, such as last month or this financial year to date), so each run covers the right dates. Set only the inputs the user asked for.
5. Call \`schedule_task_create\`:
   - \`title\`: "<report name> — <client>";
   - \`preset\` and \`time\`, plus \`weekday\` (0 = Sunday … 6 = Saturday) or \`monthday\`;
   - \`instruction\`: a complete brief, for example: "Create the report with artifact_from_template: plugin ${p.plugin}, slug ${p.example}${p.clientInput ? ', inputs {' + p.clientInput + '}' : ''}, title '<report name> — <client> — <today's date>'. Then tell me it's ready, with the report's link. If the tool returns an error, tell me the error word for word."
6. Read back what the tool scheduled: the report, the client, when, and the next run.

Each run saves a new copy of the report (the workspace keeps no versions of a report). To change or stop it: \`schedule_task_list\`, then \`schedule_task_update\` or \`schedule_task_delete\`.

Never put passwords, bank details, tax file numbers or anyone's pay in the instruction. Schedule a payroll report only for the payroll officer, at the Summary detail level unless they ask for Detail.

Example: "Send me the aged receivables every Friday at 4pm" → slug \`${p.example2}\`, weekly, weekday 5, 16:00 → \`schedule_task_create\` → "Scheduled: ${p.name} Aged Receivables, every Friday at 16:00; the next run is on <date>."
` };
}

function workqSkill(p) {
  const name = p.prefix + '-report-to-workq';
  return { file: name + '.md', md: `---
name: ${name}
description: Turn what a ${p.name} report flags (overdue invoices, unpaid bills, unreconciled transactions, failed checks, exceptions) into WorkQ items. Use when the user says "make tasks from this report", "add these to WorkQ", "create follow-ups for the overdue ones" or "put the exceptions on my list".
---
# Report exceptions to WorkQ (${p.name})

Use when the user wants follow-up work from a ${p.name} report in WorkQ. A report can't create items itself; you do it with \`todo_list\` and \`todo_create\`. If you don't have those tools, say so.

1. **The report:** the one you just made, or the saved report the user names (\`artifact_list\`, then \`artifact_get\` for its title, its inputs, such as the client and the period, and its link).
2. **The figures:** call the same ${p.name} tools the report's skill names, for ${p.clientCall} and the period the report used. Never copy figures out of the report page.
3. **Propose the items:** one line per follow-up (what to do, who or what it's about, the amount, why), at most 20. Ask the user to confirm the list and a due date. Combine many small items into one item with a checklist in its description.
4. **No duplicates:** \`todo_list\` with \`labels: ["report:<template slug>"]\`; skip anything already open for the same client and subject, and say so.
5. **Create** each with \`todo_create\`:
   - \`title\`: "<client>: <action>", for example "Northside Plumbing: chase INV-1042, $4,180, 45 days overdue";
   - \`description\`: the figures, the period, what to do, and the report's link;
   - \`labels\`: ["reporting", "${p.prefix}", "report:<template slug>", "<client>"];
   - \`priority\`: "high" for anything the report shows in red, otherwise "medium"; \`dueDate\` (YYYY-MM-DD) when given.
   The items are the asking user's (the default). You can't look up other people, so for someone else's items tell the user to reassign them in WorkQ.
6. Reply with each item created, and anything skipped.

Never create items before the user agrees to the list. One client per item. For payroll reports, never put an employee's pay, tax file number, bank details or address in WorkQ: use counts and the report's link.

Example: "Make follow-ups for the invoices more than 60 days overdue" → the aged receivables data for that client → propose 4 items → the user agrees, due Friday → \`todo_list\` (none open) → 4 × \`todo_create\` → the list with their links.
` };
}

function agentSkillFiles(platform) { const p = PLATFORMS[platform]; return [scheduleSkill(p), workqSkill(p)]; }

// Writes both skills into the extension's skills/ folder; returns their runtime ids (<plugin>:<file stem>).
function writeAgentSkills(pluginDir, platform) {
  return agentSkillFiles(platform).map((s) => {
    fs.writeFileSync(path.join(pluginDir, 'skills', s.file), s.md);
    return PLATFORMS[platform].plugin + ':' + s.file.replace(/\.md$/, '');
  });
}

// The agent gets the WorkQ skill (the schedule skill is mySidekick's) and the workspace:workq group: in agents/<key>.md (one-line
// connectors: and skills:) and its blueprint content/agents/<originKey>.json, whose contentHash follows.
function ensureAgent(pluginDir, platform) {
  const p = PLATFORMS[platform], skill = p.plugin + ':' + p.prefix + '-report-to-workq';
  const mdFile = fs.readdirSync(path.join(pluginDir, 'agents')).find((f) => f.endsWith('.md'));
  const mdPath = path.join(pluginDir, 'agents', mdFile), md0 = fs.readFileSync(mdPath, 'utf8').replace(/\r\n/g, '\n');
  const addTo = (line, item) => { const xs = line.split(',').map((s) => s.trim()).filter(Boolean); return xs.includes(item) ? xs : xs.concat([item]); };
  const md1 = md0.replace(/^connectors: (.*)$/m, (_, l) => 'connectors: ' + addTo(l, 'workspace:workq').join(', '))
    .replace(/^skills: (.*)$/m, (_, l) => 'skills: ' + addTo(l, skill).join(', '));
  if (md1 !== md0) fs.writeFileSync(mdPath, md1);
  const bpDir = path.join(pluginDir, 'content', 'agents'), bpFile = path.join(bpDir, fs.readdirSync(bpDir).find((x) => x.endsWith('.json')));
  const bp = JSON.parse(fs.readFileSync(bpFile, 'utf8'));
  const before = JSON.stringify(bp);
  if (!(bp.connectors || []).includes('workspace:workq')) bp.connectors = (bp.connectors || []).concat(['workspace:workq']);
  if (!(bp.skills || []).includes(skill)) bp.skills = (bp.skills || []).concat([skill]);
  if (JSON.stringify(bp) !== before || !bp.contentHash) {
    const sortDeep = (v) => (Array.isArray(v) ? v.map(sortDeep) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortDeep(v[k])])) : v);
    const payload = Object.assign({}, bp); delete payload.contentHash;
    bp.contentHash = crypto.createHash('sha256').update(JSON.stringify(sortDeep(payload))).digest('hex');
    fs.writeFileSync(bpFile, JSON.stringify(sortDeep(bp), null, 2) + '\n');
  }
}

module.exports = { PLATFORMS, agentSkillFiles, writeAgentSkills, ensureAgent };
