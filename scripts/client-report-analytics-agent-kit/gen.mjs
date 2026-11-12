#!/usr/bin/env node
// Generates the client-report-analytics-agent package content (Agents 2.0) from src/.
//
//   node scripts/client-report-analytics-agent-kit/gen.mjs
//
// Writes, under plugins/client-report-analytics-agent/:
//   agents/client-report-analytics.md         (from src/agent.md)
//   skills/*.md                               (from src/skills/)
//   content/agents|setups|capabilities/*.json (originKey + contentHash computed here)
//   .mcp.json, README.md
// and updates plugin.json + the marketplace.json entry (content, listing.agent), keeping
// every field the AI Studio console wrote (displayName, branding, version …).
//
// The package reuses the Client Report Analytics extension's report templates through
// artifact_from_template (plugin "client-report-analytics"); it ships no reports of its own.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SLUG = 'client-report-analytics-agent';
const KIT = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(KIT, '..', '..');
const PLUGIN = join(ROOT, 'plugins', SLUG);
const PROD_MCP = 'https://myhub-mcp-servers.thankfulcliff-9090ceed.westus2.azurecontainerapps.io';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Stable UUID from a name: the same scheme the Developer Instance uses for agent originKeys. */
function deterministicUuid(name) {
  const h = createHash('sha256').update(name).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const sortKeys = (v) =>
  Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v;
/** contentHash = sha256 of the canonical (sorted-key) payload without contentHash. */
function withHash(payload) {
  const { contentHash: _drop, ...rest } = payload;
  const hash = createHash('sha256').update(JSON.stringify(sortKeys(rest))).digest('hex');
  return sortKeys({ ...rest, contentHash: hash });
}
const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
};
/** One-line frontmatter parser, as parseAgentMarkdown reads it. */
function parseAgentMd(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error('agent.md: missing frontmatter');
  const fm = Object.fromEntries(
    m[1].split(/\r?\n/).filter(Boolean).map((l) => {
      const i = l.indexOf(':');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
  );
  const list = (v) => (v ? v.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean) : []);
  return { fm, list, body: m[2].trim() };
}
const keyOf = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ── agent ────────────────────────────────────────────────────────────────────

// LF everywhere: a Windows checkout (core.autocrlf) gives CRLF, which would leak into the JSON rolePrompt.
const agentSrc = readFileSync(join(KIT, 'src', 'agent.md'), 'utf8').replace(/\r\n/g, '\n');
const { fm, list, body } = parseAgentMd(agentSrc);
const agentKey = keyOf(fm.name);
const agent = withHash({
  kind: 'agent',
  originKey: deterministicUuid(`agent:${SLUG}:${agentKey}`),
  key: agentKey,
  name: fm.name,
  description: fm.description,
  rolePrompt: body,
  connectors: list(fm.connectors),
  skills: list(fm.skills),
  model: fm.model,
  // Owned (not platform): an Agents 2.0 installation can then run TEAM (shared principal) or
  // PERSONAL (each person's own instance via enableForOwner); a platform blueprint can't be
  // turned on per person. Same as social-media-agent.
  platform: false,
  audienceMode: 'everyone',
});
if (agent.rolePrompt.length > 20000) throw new Error(`role prompt is ${agent.rolePrompt.length} chars (max 20000)`);
if (agent.description.length > 500) throw new Error('agent description over 500 chars');

// ── setup (connections only) ─────────────────────────────────────────────────

const setup = withHash({
  kind: 'setup',
  originKey: deterministicUuid(`setup:${SLUG}:connections`),
  name: 'Client Reporting Agent setup',
  description:
    'Connections only: connect Xero (required; a shared service connection for a team agent) and, optionally, ABR Lookup for the ABN register checks. ' +
    'The manager is named when the agent is activated. Reports load their data as the person who opens them, so reviewers need their own Xero access to the client.',
  definition: {
    version: 2,
    connections: [
      { key: 'xero', label: 'Xero', oneOf: ['xero-accounting'], required: true, scope: 'either' },
      { key: 'abr', label: 'ABR Lookup (ABN register checks)', oneOf: ['abr'], required: false, scope: 'either' },
    ],
    knowledge: [],
    people: [],
    tasks: [],
    tenantSettings: [],
  },
});

// ── capabilities (read-only; one tool each: the store runs the first binding on the bound server) ──

const TENANT = { type: 'string', description: "The client's Xero organisation id (tenantId from list_connections)." };
const str = (description) => ({ type: 'string', description });
const int = (description) => ({ type: 'integer', description });
const bool = (description) => ({ type: 'boolean', description });
const FILTERS = {
  where: str('Optional Xero filter, e.g. Status=="ACTIVE".'),
  order: str('Optional Xero order clause, e.g. "Date DESC".'),
};
const xeroCaps = [
  ['xero.organisation.read', 'Read the client organisation', 'get_organisation', 'accounting.settings.read', {}, ['Organisations']],
  ['xero.accounts.read', 'Read the chart of accounts', 'list_accounts', 'accounting.settings.read', { ...FILTERS }, ['Accounts']],
  ['xero.tax_rates.read', 'Read the tax rates', 'list_tax_rates', 'accounting.settings.read', { ...FILTERS }, ['TaxRates']],
  ['xero.contacts.read', 'Read contacts', 'list_contacts', 'accounting.contacts.read',
    { ...FILTERS, ids: str('Comma-separated ContactIDs.'), page: int('Page (100 per page).'), includeArchived: bool('Include archived contacts.'), summaryOnly: bool('Lighter rows.'), searchTerm: str('Search name, email or number.') }, ['Contacts']],
  ['xero.invoices.read', 'Read invoices and bills', 'list_invoices', 'accounting.transactions.read',
    { ...FILTERS, ids: str('Comma-separated InvoiceIDs.'), invoiceNumbers: str('Comma-separated invoice numbers.'), contactIDs: str('Comma-separated ContactIDs.'), statuses: str('Comma-separated statuses, e.g. AUTHORISED,PAID.'), page: int('Page (100 per page).'), summaryOnly: bool('Lighter rows.'), searchTerm: str('Search number or reference.') }, ['Invoices']],
  ['xero.credit_notes.read', 'Read credit notes', 'list_credit_notes', 'accounting.transactions.read', { ...FILTERS, page: int('Page (100 per page).') }, ['CreditNotes']],
  ['xero.bank_transactions.read', 'Read bank transactions', 'list_bank_transactions', 'accounting.transactions.read', { ...FILTERS, page: int('Page (100 per page).') }, ['BankTransactions']],
  ['xero.profit_and_loss.read', 'Read the Profit and Loss', 'get_profit_and_loss', 'accounting.reports.read',
    { fromDate: str('YYYY-MM-DD'), toDate: str('YYYY-MM-DD'), periods: int('Comparison periods.'), timeframe: { type: 'string', enum: ['MONTH', 'QUARTER', 'YEAR'] }, paymentsOnly: bool('Cash basis.') }, ['Reports']],
  ['xero.balance_sheet.read', 'Read the Balance Sheet', 'get_balance_sheet', 'accounting.reports.read',
    { date: str('As-at date, YYYY-MM-DD.'), periods: int('Comparison periods.'), timeframe: { type: 'string', enum: ['MONTH', 'QUARTER', 'YEAR'] }, paymentsOnly: bool('Cash basis.') }, ['Reports']],
  ['xero.trial_balance.read', 'Read the Trial Balance', 'get_trial_balance', 'accounting.reports.read',
    { date: str('As-at date, YYYY-MM-DD.'), paymentsOnly: bool('Cash basis.') }, ['Reports']],
];
function capability(key, title, server, tool, scopes, props, required, outputKeys) {
  const originKey = deterministicUuid(`capability:${SLUG}:${key}`);
  const definition = {
    kind: 'capability',
    schemaVersion: 1,
    originKey,
    key,
    title,
    sideEffectClass: 'read',
    idempotency: { supported: true },
    inputsSchema: { type: 'object', additionalProperties: false, properties: props, required },
    outputsSchema: {
      type: 'object',
      additionalProperties: true,
      properties: Object.fromEntries(outputKeys.map((k) => [k, { type: 'array', items: { type: 'object' } }])),
    },
    bindings: [{ server, tool, argMap: Object.fromEntries(Object.keys(props).map((k) => [k, k])), ...(scopes.length ? { scopes } : {}) }],
    permissionRequirements: [`connectors:${server}`],
  };
  return withHash({ kind: 'capability', originKey, name: title, definition });
}
const capabilities = [
  ...xeroCaps.map(([key, title, tool, scope, props, out]) =>
    capability(key, title, 'xero-accounting', tool, [scope], { xero_tenant_id: TENANT, ...props }, ['xero_tenant_id'], out)),
  capability('abr.abns.check', 'Check ABNs against the Australian Business Register', 'abr', 'abr_lookup_abns', [],
    { abns: { description: 'ABNs to check: an array, or one string separated by commas, semicolons or new lines.', oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }] } },
    ['abns'], ['results']),
  capability('abr.abn.read', 'Read one ABN record from the Australian Business Register', 'abr', 'abr_get_abn_details', [],
    { abn: str('The ABN (11 digits; spaces allowed).'), include_history: bool('Include past statuses, GST periods and names.') },
    ['abn'], []),
  // Finds a client's Xero organisation by name (no tenant id needed): the BAS review step starts from a client name.
  capability('xero.connections.read', 'List the Xero organisations this connection can see', 'xero-accounting', 'list_connections',
    ['accounting.settings.read'], {}, [], ['tenants']),
];
const capabilityKey = Object.fromEntries(capabilities.map((c) => [c.definition.key, c.originKey]));

// ── process: BAS readiness review (C3) ───────────────────────────────────────
// Design: Desktop/Spec Assessments/cra-pra-agents-2-migration/STEP-2-DESIGN.md. The Stop/Note defaults are PROVISIONAL
// until the bookkeeper answers D6: each check group is a boolean Rules setting (`stopOn<Group>`), and a found group whose
// setting is on routes the job to a decision without "Ready to lodge". Change a default here and bump PROCESS_VERSION
// (a process version with runs is immutable).
const PROCESS_KEY = 'bas-readiness-review';
const PROCESS_VERSION = '0.1.0';
const CHECK_GROUPS = [
  // [found flag, default Stop?]
  ['gstChargedWhileUnregistered', true],
  ['gstOnNonClaimableItems', true],
  ['gstAmountMismatch', true],
  ['gstWithoutAbn', true],
  ['gstFromUnregisteredSuppliers', true],
  ['gstRegistrationRequired', true],
  ['unreconciledBank', true],
  ['suspenseBalance', true],
  ['cancelledAbn', true],
  ['duplicateBills', true],
  ['gstStatusMismatch', false],
  ['gstAccountWithoutGst', false],
  ['missingReceipts', false],
  ['draftSalesInvoices', false],
  ['lockDate', false],
];
const stopKey = (group) => `stopOn${group[0].toUpperCase()}${group.slice(1)}`;
// One transition per group (a `when` is at most 500 characters): the coordinator takes the FIRST transition whose `when`
// holds, so any found group set to Stop routes to decideBlocked, and the last, unconditional one to decideReady.
const STOP_TRANSITIONS = CHECK_GROUPS.map(([g]) => ({ from: 'summary', to: 'decideBlocked', when: `steps.review.found.${g} && policy.${stopKey(g)}` }));
const PROCESS_CAPABILITIES = [
  'xero.connections.read', 'xero.organisation.read', 'xero.accounts.read', 'xero.tax_rates.read', 'xero.contacts.read',
  'xero.invoices.read', 'xero.credit_notes.read', 'xero.bank_transactions.read', 'xero.profit_and_loss.read',
  'xero.trial_balance.read', 'abr.abns.check',
];
for (const k of PROCESS_CAPABILITIES) if (!capabilityKey[k]) throw new Error(`process capability ${k} is not bundled`);

const decisionOptions = (withReady) => [
  ...(withReady ? [{
    key: 'readyToLodge', label: 'Ready to lodge',
    effect: 'Records that this BAS is ready to lodge. Nothing is lodged and nothing changes in Xero: the registered BAS agent lodges it as usual.',
    transition: 'readyToLodge',
  }] : []),
  {
    key: 'readyOnceClientAnswers', label: 'Ready once the client answers',
    effect: 'Hands the drafted client questions to you to send. Nothing is sent by the agent.',
    transition: 'askClient',
  },
  {
    key: 'notReady', label: 'Not ready: rework',
    effect: 'Records that the file needs work before this BAS. Nothing changes in Xero.',
    transition: 'notReady',
  },
  {
    key: 'revise', label: 'Ask for changes',
    effect: 'Sends the review back to the agent with your note.',
    transition: 'review',
  },
];
const decisionStep = (key, title, withReady) => ({
  key, kind: 'decision', title, type: 'bas_readiness',
  eligible: ['reviewer'],
  materiality: ['steps.review.found', 'steps.review.findings'],
  options: decisionOptions(withReady),
  sla: { remindAfterBusinessDays: 2, expireAfterBusinessDays: 15 },
});
const processOriginKey = deterministicUuid(`process:${SLUG}:${PROCESS_KEY}`);
const processDefinition = {
  kind: 'process',
  schemaVersion: 1,
  originKey: processOriginKey,
  key: PROCESS_KEY,
  version: PROCESS_VERSION,
  title: 'BAS readiness review',
  description: 'Reviews one client\'s Xero file for one BAS quarter: runs the readiness checks (the CRA-10 GST Check rules plus general readiness checks), writes a BAS readiness summary and asks the reviewer to decide: ready to lodge, ready once the client answers, or not ready. Checks the practice marks as Stop in its Rules remove "Ready to lodge". Read-only: nothing is changed in Xero, nothing is lodged and the client is never contacted by the agent.',
  vocabulary: { subject: 'Client and quarter' },
  subject: { kind: 'none', dedupeBy: ['clientName', 'periodStart', 'periodEnd'] },
  inputs: [
    { key: 'clientName', type: 'string', required: true, label: 'Client (as named in Xero)' },
    { key: 'periodStart', type: 'date', required: true, label: 'BAS period start' },
    { key: 'periodEnd', type: 'date', required: true, label: 'BAS period end' },
  ],
  capabilities: [...PROCESS_CAPABILITIES, 'knowledge.read', 'artifacts.write'],
  roles: { manager: 'installation.manager', reviewer: 'installation.reviewer' },
  variationPoints: CHECK_GROUPS.map(([g, stop]) => ({ key: stopKey(g), type: 'boolean', default: stop, editableBy: 'manager' })),
  protectedRules: [
    { key: 'readOnlyInXero', description: 'The review reads Xero; it never changes it. Findings are fixed by a person in Xero.' },
    { key: 'neverLodges', description: 'Nothing is lodged with the ATO. "Ready to lodge" is a recorded decision; the registered BAS agent lodges as usual.' },
    { key: 'noClientContact', description: 'The agent drafts client questions; a person sends them. The agent never contacts the client.' },
    { key: 'noInventedFigures', description: 'Every figure comes from the client\'s Xero file; anything the source doesn\'t hold is reported as not checked, never estimated.' },
  ],
  steps: [
    { key: 'review', kind: 'agent', title: 'Run the BAS readiness checks', skill: 'client-report-analytics-agent-bas-review',
      outputs: ['clientResolved', 'clientName', 'xeroTenantId', 'periodLabel', 'found', 'findings', 'clientQuestions', 'summaryMarkdown'] },
    { key: 'summary', kind: 'output', title: 'BAS readiness summary', template: 'bas-readiness-summary', artifactKind: 'basReadiness' },
    decisionStep('decideReady', 'Is this BAS ready to lodge?', true),
    decisionStep('decideBlocked', 'A Stop check was found: how should this BAS proceed?', false),
    { key: 'askClient', kind: 'human', title: 'Send the client questions', assign: 'reviewer', completion: 'statusDone' },
    // Gates rest on the review itself, not on the summary document: an output step creates no artifact in the
    // evaluator's dry run, and the document is evidence when it exists (`steps.summary.artifactId`).
    { key: 'readyToLodge', kind: 'gate', title: 'Ready to lodge', outcome: 'readyToLodge',
      requires: ['steps.review.clientResolved == true', 'steps.review.summaryMarkdown != null'],
      evidence: ['steps.summary.artifactId', 'steps.review.summaryMarkdown', 'steps.review.findings'] },
    { key: 'clientQueried', kind: 'gate', title: 'Client questions sent', outcome: 'clientQueried',
      requires: ['steps.askClient.completed == true'],
      evidence: ['steps.summary.artifactId', 'steps.review.summaryMarkdown', 'steps.review.clientQuestions'] },
    { key: 'notReady', kind: 'gate', title: 'Not ready: rework', outcome: 'notReady',
      requires: ['steps.review.summaryMarkdown != null'],
      evidence: ['steps.summary.artifactId', 'steps.review.summaryMarkdown', 'steps.review.findings'] },
  ],
  transitions: [
    { from: 'review', to: 'summary' },
    // A review that couldn't find the client checked nothing: never offer "Ready to lodge" on it.
    { from: 'summary', to: 'decideBlocked', when: '!steps.review.clientResolved' },
    ...STOP_TRANSITIONS,
    { from: 'summary', to: 'decideReady' },
    { from: 'askClient', to: 'clientQueried' },
  ],
  exceptions: [],
  rework: [],
  outcomes: [
    { key: 'readyToLodge', terminal: true, evidence: ['basReadiness', 'decision_record'] },
    { key: 'clientQueried', terminal: true, evidence: ['basReadiness', 'decision_record', 'workq_item'] },
    { key: 'notReady', terminal: true, evidence: ['basReadiness', 'decision_record'] },
    { key: 'cancelled', terminal: true, evidence: ['decision_record'] },
  ],
  safeTest: {
    sampleInputs: { clientName: 'Demo Company (AU)', periodStart: '2026-07-01', periodEnd: '2026-09-30' },
    assertions: ['steps.review.found != null', 'steps.review.summaryMarkdown != null'],
  },
  modelPolicy: { brief: 'sonnet', plan: 'sonnet', judgement: 'sonnet' },
  limits: { maxAgentTurnsPerStep: 40, maxSteps: 20, maxActiveHours: 4, maxWaitingDays: 30, maxAiUnits: 200 },
};
const processPayload = withHash({ kind: 'process', originKey: processOriginKey, name: 'BAS readiness review', definition: processDefinition });

// Required evaluation suite (the release gate refuses a process without one).
const allFound = (overrides = {}) => Object.fromEntries(CHECK_GROUPS.map(([g]) => [g, overrides[g] ?? false]));
// Realistic proposals: the runtime evaluator's rubric model reads these outputs (the run transcript), so they must carry
// the evidence each criterion asks for.
const SUMMARY_HEAD = '## Demo Company (AU): BAS readiness, Jul–Sep 2026 (1 Jul – 30 Sep 2026)\n\nRegistered for GST, accrual basis, quarterly BAS. Read from Xero only: nothing was changed in Xero and nothing was lodged.\n\n';
const SUMMARY_TAIL = '\n\nNot checked: none (ABR lookups ran).\n\nFor the line-by-line detail, open the BAS Related Transactions and GST, GST Check and Contacts for BAS reports for this client and quarter.';
const findingsTable = (findings) => findings.length === 0
  ? '**No findings** in the 15 check groups.'
  : '| Check | What was found | Count | Amount |\n|---|---|---|---|\n' + findings.map((f) => `| ${f.check} | ${f.title} | ${f.count} | $${f.amount.toFixed(2)} |`).join('\n');
const reviewFixture = (found, findings, questions) => ({
  clientResolved: true, clientName: 'Demo Company (AU)', xeroTenantId: '00000000-0000-4000-8000-00000000d001', periodLabel: 'Jul–Sep 2026',
  found, findings, clientQuestions: questions, summaryMarkdown: SUMMARY_HEAD + findingsTable(findings) + SUMMARY_TAIL,
});
// `outputs` is what the runtime evaluator feeds the agent step; `steps` is what the static evaluator reads conditions from.
const fixturesFor = (review, extra = {}) => ({ outputs: { review }, steps: { review: { found: review.found, clientResolved: review.clientResolved } }, responses: [], ...extra });
const evalOriginKey = deterministicUuid(`evaluation:${SLUG}:${PROCESS_KEY}`);
const evaluationDefinition = {
  kind: 'evaluation',
  schemaVersion: 1,
  originKey: evalOriginKey,
  key: `${PROCESS_KEY}-controls`,
  title: 'BAS readiness review: controls',
  process: processOriginKey,
  required: true,
  thresholds: { requiredScenarioPassRate: 1, rubricMinScore: 0.7 },
  scenarios: [
    {
      key: 'cleanQuarter',
      title: 'No findings: the reviewer records Ready to lodge',
      inputs: { clientName: 'Demo Company (AU)', periodStart: '2026-07-01', periodEnd: '2026-09-30' },
      fixtures: fixturesFor(reviewFixture(allFound(), [], [])),
      expected: {
        outcome: 'readyToLodge',
        stepsReached: ['review', 'summary', 'decideReady', 'readyToLodge'],
        decisions: [{ step: 'decideReady', option: 'readyToLodge' }],
      },
      rubric: [{ criterion: 'The summary states the client, the period, the GST registration and basis, and that nothing was changed in Xero.', weight: 1 }],
    },
    {
      key: 'stopFinding',
      title: 'A Stop check is found: no Ready to lodge, the reviewer records Not ready',
      inputs: { clientName: 'Demo Company (AU)', periodStart: '2026-07-01', periodEnd: '2026-09-30' },
      fixtures: fixturesFor(reviewFixture(allFound({ gstOnNonClaimableItems: true }),
        [{ group: 'gstOnNonClaimableItems', check: 'CHK-058', title: 'GST claimed on 2 bank fee lines', amount: 3.2, count: 2 }], [])),
      expected: {
        outcome: 'notReady',
        stepsReached: ['review', 'summary', 'decideBlocked', 'notReady'],
        decisions: [{ step: 'decideBlocked', option: 'notReady' }],
      },
      rubric: [{ criterion: 'Each finding names its check code, what was found, the count and the amount, from Xero only.', weight: 1 }],
    },
    {
      key: 'clientQuestions',
      title: 'Only Note findings: the reviewer sends the client questions',
      inputs: { clientName: 'Demo Company (AU)', periodStart: '2026-07-01', periodEnd: '2026-09-30' },
      fixtures: fixturesFor(reviewFixture(allFound({ missingReceipts: true }),
        [{ group: 'missingReceipts', check: 'CHK-021', title: '1 spend money transaction over $82.50 with nothing attached', amount: 245, count: 1 }],
        ['Could you send the receipt for the $245.00 payment to Officeworks on 12 Aug 2026?'])),
      expected: {
        outcome: 'clientQueried',
        stepsReached: ['review', 'summary', 'decideReady', 'askClient', 'clientQueried'],
        decisions: [{ step: 'decideReady', option: 'readyOnceClientAnswers' }],
      },
      rubric: [{ criterion: 'Client questions are polite, specific (what, date, contact, amount) and are sent by a person, not the agent.', weight: 1 }],
    },
    {
      key: 'clientNotFound',
      title: 'The client is not found in Xero: no Ready to lodge, the reviewer asks for changes then records Not ready',
      inputs: { clientName: 'Unknown Client Pty Ltd', periodStart: '2026-07-01', periodEnd: '2026-09-30' },
      fixtures: fixturesFor({
        clientResolved: false, clientName: 'Unknown Client Pty Ltd', xeroTenantId: '', periodLabel: 'Jul–Sep 2026',
        found: allFound(), findings: [], clientQuestions: [],
        summaryMarkdown: '## Unknown Client Pty Ltd: BAS readiness, Jul–Sep 2026\n\nNo Xero organisation named "Unknown Client Pty Ltd" is connected, so **no checks were run**. Connected organisations: Demo Company (AU). Nothing was changed in Xero and nothing was lodged.',
      }),
      expected: {
        outcome: 'notReady',
        stepsReached: ['review', 'summary', 'decideBlocked', 'notReady'],
        decisions: [{ step: 'decideBlocked', option: 'notReady' }],
      },
      rubric: [{ criterion: 'The summary says plainly that the client was not found and no checks were run, and names the organisations that are connected.', weight: 1 }],
    },
  ],
};
const evaluationPayload = withHash({ kind: 'evaluation', originKey: evalOriginKey, name: 'BAS readiness review: controls', definition: evaluationDefinition });

// ── write the package ────────────────────────────────────────────────────────

for (const dir of ['content/agents', 'content/setups', 'content/capabilities', 'content/processes', 'content/evaluations', 'templates', 'skills', 'agents']) rmSync(join(PLUGIN, dir), { recursive: true, force: true });

mkdirSync(join(PLUGIN, 'agents'), { recursive: true });
writeFileSync(join(PLUGIN, 'agents', `${agentKey}.md`), agentSrc.replace(/\r\n/g, '\n'));
writeJson(join(PLUGIN, 'content', 'agents', `${agent.originKey}.json`), agent);
writeJson(join(PLUGIN, 'content', 'setups', `${setup.originKey}.json`), setup);
for (const c of capabilities) writeJson(join(PLUGIN, 'content', 'capabilities', `${c.originKey}.json`), c);
writeJson(join(PLUGIN, 'content', 'processes', `${processPayload.originKey}.json`), processPayload);
writeJson(join(PLUGIN, 'content', 'evaluations', `${evaluationPayload.originKey}.json`), evaluationPayload);
mkdirSync(join(PLUGIN, 'templates'), { recursive: true });
for (const f of readdirSync(join(KIT, 'src', 'templates')).filter((f) => f.endsWith('.md'))) {
  writeFileSync(join(PLUGIN, 'templates', f), readFileSync(join(KIT, 'src', 'templates', f), 'utf8').replace(/\r\n/g, '\n'));
}
for (const step of processDefinition.steps) {
  if (step.kind === 'output' && !readdirSync(join(KIT, 'src', 'templates')).includes(`${step.template}.md`)) throw new Error(`output template ${step.template} missing`);
  if (step.kind === 'agent' && !readdirSync(join(KIT, 'src', 'skills')).includes(`${step.skill}.md`)) throw new Error(`step skill ${step.skill} missing`);
}

mkdirSync(join(PLUGIN, 'skills'), { recursive: true });
const skillFiles = readdirSync(join(KIT, 'src', 'skills')).filter((f) => f.endsWith('.md')).sort();
for (const f of skillFiles) {
  const text = readFileSync(join(KIT, 'src', 'skills', f), 'utf8').replace(/\r\n/g, '\n');
  if (Buffer.byteLength(text) > 128 * 1024) throw new Error(`${f} is over 128 KiB`);
  const name = text.match(/^---\nname: (.+)$/m)?.[1];
  if (name !== f.replace(/\.md$/, '')) throw new Error(`${f}: frontmatter name "${name}" must equal the filename`);
  writeFileSync(join(PLUGIN, 'skills', f), text);
}
for (const s of agent.skills) if (!skillFiles.includes(`${s}.md`)) throw new Error(`agent skill ${s} is not in src/skills`);

writeJson(join(PLUGIN, '.mcp.json'), {
  mcpServers: {
    'xero-accounting': { type: 'http', url: `${PROD_MCP}/xero-accounting/mcp` },
    abr: { type: 'http', url: `${PROD_MCP}/abr/mcp`, headers: { Authorization: 'Bearer ${ABR_ACCESS_KEY}' } },
  },
});

const content = {
  agents: [`content/agents/${agent.originKey}.json`],
  automations: [],
  capabilities: capabilities.map((c) => `content/capabilities/${c.originKey}.json`),
  evaluations: [`content/evaluations/${evaluationPayload.originKey}.json`],
  formTemplates: [],
  forms: [],
  processes: [`content/processes/${processPayload.originKey}.json`],
  setups: [`content/setups/${setup.originKey}.json`],
  workqTemplates: [],
};
const listingAgent = {
  role: 'Client reporting and review for a bookkeeping practice (Xero)',
  outcomes: [
    'Every client report request ends with a live, self-checking report linked on its WorkQ item, or one clear question back',
    'Every report comes from a tested Client Report Analytics template; the agent never types a figure',
    'Every BAS readiness review ends with a decision recorded by a person, against Stop and Note checks the practice sets',
    'Nothing is changed in Xero and nothing is sent to a client',
  ],
  processes: [PROCESS_KEY],
  requiredCapabilities: PROCESS_CAPABILITIES.filter((k) => !k.startsWith('abr.')),
  setupEffort: 'minutes',
};

const pluginJsonPath = join(PLUGIN, '.claude-plugin', 'plugin.json');
const pluginJson = JSON.parse(readFileSync(pluginJsonPath, 'utf8'));
pluginJson.content = content;
pluginJson.listing = { ...(pluginJson.listing ?? {}), agent: listingAgent };
writeJson(pluginJsonPath, sortKeys(pluginJson));

const mpPath = join(ROOT, '.claude-plugin', 'marketplace.json');
const mpText = readFileSync(mpPath, 'utf8');
const mp = JSON.parse(mpText);
const entry = mp.plugins.find((p) => p.name === SLUG);
if (!entry) throw new Error(`marketplace.json has no ${SLUG} entry (create the shell in AI Studio first)`);
entry.content = content;
entry.displayName = 'Client Reporting Agent';
entry.listing = { ...(entry.listing ?? {}), agent: listingAgent };
writeFileSync(mpPath, JSON.stringify(mp, null, 2) + (mpText.endsWith('\n') ? '\n' : ''));

const readme = `# Client Reporting Agent

An Agents 2.0 agent that turns client report requests into live, self-checking reports. Assign it a WorkQ item ("Health check for <client>, last quarter") or ask it in chat: it creates the report from the **Client Report Analytics** extension's tested templates, posts the link on the item and closes it. Xero clients for now (MYOB and QuickBooks later).

- **Read-only.** It never changes anything in Xero and never sends anything to a client.
- **No reports of its own.** It uses the Client Report Analytics extension's templates (\`artifact_from_template\`, plugin \`client-report-analytics\`), so that extension must be installed and up to date.
- **BAS readiness review (a process).** Start it for one client and quarter: the agent runs the readiness checks (the CRA-10 GST Check rules plus general readiness checks), writes a summary, and a reviewer decides Ready to lodge, Ready once the client answers, or Not ready. Each practice marks which checks stop lodgement in the agent's **Rules** (Setup → Rules); a Stop check removes "Ready to lodge". Nothing is lodged and the client is never contacted by the agent.
- **Reports load as the viewer.** A report fetches its data live as the person who opens it, from their own connections.

Generated by \`scripts/client-report-analytics-agent-kit/gen.mjs\`; edit \`src/\` there and re-run it.

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| \`ABR_ACCESS_KEY\` | No | The ABR Lookup access key mySMB issues to your workspace, sent as \`Authorization: Bearer\` to the \`abr\` server. Only needed for the optional ABR Lookup connection (ABN register checks); bind it in the agent's setup, ideally as a service connection (Admin → Service connections). |

Xero connects with OAuth: bind a Xero connection in the agent's setup (a shared **service connection** for a team agent). No other configuration is required.
`;
writeFileSync(join(PLUGIN, 'README.md'), readme);

console.log(`agent ${agent.key} ${agent.originKey} (prompt ${agent.rolePrompt.length} chars)`);
console.log(`setup ${setup.originKey}; ${capabilities.length} capabilities; ${skillFiles.length} skills`);
