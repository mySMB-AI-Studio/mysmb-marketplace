// One-off migration (27 Nov 2026): move every PRA report's Xero side off the retiring xero-accounting server's
// get_practice_* tools onto the xero-api API connector, read per organisation in the report (xero-fan.js).
// Rewrites each reports/<id>.manifest.json: drops the `xero` binding, adds `xero_connections` + the fan kind's
// bindings and the internal inputs they need. Idempotent: re-running leaves a migrated manifest unchanged.
// MYOB bindings are not touched. Run: node migrate-xero-api.js
const fs = require('fs');
const path = require('path');

const IN = (input) => ({ kind: 'input', input });
const ST = (value) => ({ kind: 'static', value });
const NOW = { kind: 'context', source: 'now.date' };
const T = { xero_tenant_id: IN('org') };
const tool = (name) => ({ mcp: 'xero-api', name });
const b = (id, name, params) => ({ id, tool: tool(name), params: Object.assign({}, T, params || {}) });

const ORG = { name: 'org', label: 'Xero organisation (set by the report, one per call: leave empty)', type: 'string', maxLength: 64, default: '' };
const WHERE = { name: 'where', label: 'Xero filter (set by the report: leave empty)', type: 'string', maxLength: 500, default: '' };
const PAGE = { name: 'page', label: 'Page (set by the report: leave at 1)', type: 'number', min: 1, max: 100, default: 1 };

// The bindings per fan kind (ids must match xero-fan.js FAN_BINDINGS). Filters and options mirror
// practice-aggregates.ts exactly.
const KINDS = {
  client: { inputs: [ORG], bindings: [
    b('x_contacts', 'list_contacts', { page: ST(1), summaryOnly: ST(true) }),
    b('x_accounts', 'list_accounts'),
    b('x_invoices', 'list_invoices', { where: ST('Type=="ACCREC"'), page: ST(1), summaryOnly: ST(true) }),
    b('x_bills', 'list_invoices', { where: ST('Type=="ACCPAY"'), page: ST(1), summaryOnly: ST(true) }),
    b('x_employees', 'list_employees')] },
  connections: { inputs: [], bindings: [] },
  sales: { inputs: [ORG], bindings: [
    b('x_open', 'list_invoices', { where: ST('Type=="ACCREC" AND Status=="AUTHORISED"') }),
    b('x_bank', 'get_bank_summary', { fromDate: IN('from_date'), toDate: IN('to_date') }),
    b('x_pl', 'get_profit_and_loss', { fromDate: IN('from_date'), toDate: IN('to_date') })] },
  purchases: { inputs: [ORG], bindings: [
    b('x_open', 'list_invoices', { where: ST('Type=="ACCPAY" AND Status=="AUTHORISED"') }),
    b('x_bank', 'get_bank_summary', { fromDate: IN('from_date'), toDate: IN('to_date') }),
    b('x_pl', 'get_profit_and_loss', { fromDate: IN('from_date'), toDate: IN('to_date') })] },
  bankrec: { inputs: [ORG, WHERE, PAGE], bindings: [
    b('x_bank', 'get_bank_summary', { fromDate: IN('as_at'), toDate: IN('as_at') }),
    b('x_unrec', 'list_bank_transactions', { where: IN('where'), page: IN('page') })] },
  banking: { inputs: [ORG, WHERE, PAGE], bindings: [
    b('x_bank', 'get_bank_summary', { fromDate: IN('from_date'), toDate: IN('to_date') }),
    b('x_unrec', 'list_bank_transactions', { where: IN('where'), page: IN('page') })] },
  financial: { inputs: [ORG], bindings: [
    b('x_pl', 'get_profit_and_loss', { fromDate: IN('from_date'), toDate: IN('to_date') }),
    b('x_pl_cash', 'get_profit_and_loss', { fromDate: IN('from_date'), toDate: IN('to_date'), paymentsOnly: ST(true) }),
    b('x_bank', 'get_bank_summary', { fromDate: NOW, toDate: NOW }),
    b('x_ar', 'list_invoices', { where: ST('Type=="ACCREC" AND Status=="AUTHORISED"') }),
    b('x_ap', 'list_invoices', { where: ST('Type=="ACCPAY" AND Status=="AUTHORISED"') })] },
  activity: { inputs: [ORG, WHERE], bindings: [
    b('x_inv', 'list_invoices', { where: IN('where'), page: ST(1) }),
    b('x_bt', 'list_bank_transactions', { where: IN('where'), page: ST(1) }),
    b('x_mj', 'list_manual_journals', { where: IN('where'), page: ST(1) })] }
};
const REPORTS = { 'client-summary': 'client', 'user-activity': 'connections', 'sales-summary': 'sales', 'purchases-summary': 'purchases',
  'bank-reconciliation-summary': 'bankrec', 'banking-summary': 'banking', 'financial-overview': 'financial', 'activity-count': 'activity' };

function migrate(id, kind) {
  const file = path.join(__dirname, 'reports', id + '.manifest.json');
  const m = JSON.parse(fs.readFileSync(file, 'utf8'));
  const spec = KINDS[kind];
  const others = m.bindings.filter((x) => x.tool.mcp !== 'xero-accounting' && x.tool.mcp !== 'xero-api');
  m.bindings = [{ id: 'xero_connections', tool: tool('list_connections'), params: {} }].concat(spec.bindings, others);
  const have = new Set(m.inputs.map((i) => i.name));
  spec.inputs.forEach((i) => { if (!have.has(i.name)) m.inputs.push(i); });
  fs.writeFileSync(file, JSON.stringify(m, null, 2) + '\n');
  return { id, kind, bindings: m.bindings.length, inputs: m.inputs.length };
}

if (require.main === module) {
  for (const [id, kind] of Object.entries(REPORTS)) console.log(migrate(id, kind));
}
module.exports = { KINDS, REPORTS };
