// node mk-aged.js — writes reports/ar.* (P08 Aged Receivables Summary) and reports/ap.* (P09 Aged Payables Summary) from the one
// aged engine (reports/aged.tpl.js), as Xero does: the same engine with customers or suppliers.
const fs = require('fs'), path = require('path'), R = path.join(__dirname, 'reports');
const tpl = fs.readFileSync(path.join(R, 'aged.tpl.js'), 'utf8').replace(/\r\n/g, '\n');
const KINDS = {
  ar: { PAYTYPE: 'ACCRECPAYMENT', TITLE: 'Aged Receivables Summary', INV: 'ACCREC', CN: 'ACCRECCREDIT', OP: 'RECEIVE-OVERPAYMENT', PP: 'RECEIVE-PREPAYMENT', WHO: 'Customer', OWING: 'Customers owing', TOTAL: 'Total receivable', BSNAME: 'Accounts Receivable', DOCS: 'sales invoices' },
  ap: { PAYTYPE: 'ACCPAYPAYMENT', TITLE: 'Aged Payables Summary', INV: 'ACCPAY', CN: 'ACCPAYCREDIT', OP: 'SPEND-OVERPAYMENT', PP: 'SPEND-PREPAYMENT', WHO: 'Supplier', OWING: 'Suppliers you owe', TOTAL: 'Total payable', BSNAME: 'Accounts Payable', DOCS: 'bills' },
};
const fmt = (v) => Array.isArray(v) ? '[' + v.map(fmt).join(', ') + ']' : v && typeof v === 'object' ? '{ ' + Object.keys(v).map((k) => JSON.stringify(k) + ': ' + fmt(v[k])).join(', ') + ' }' : JSON.stringify(v);
const inp = (name) => ({ kind: 'input', input: name }), st = (value) => ({ kind: 'static', value });
for (const [id, K] of Object.entries(KINDS)) {
  let cfg = tpl; for (const [k, v] of Object.entries(K)) cfg = cfg.split('__' + k + '__').join(v);
  if (/__[A-Z]+__/.test(cfg)) throw new Error('unfilled placeholder in ' + id);
  fs.writeFileSync(path.join(R, id + '.cfg.js'), cfg);
  const display = JSON.parse(/display: '({[^']+)'/.exec(cfg)[1]);
  const m = {
    inputs: [
      { name: 'as_at', label: 'As at', type: 'date', default: '2026-09-30' },
      { name: 'paid_where', label: 'Paid after (filter)', type: 'string', maxLength: 120, default: 'Type=="' + K.INV + '" AND FullyPaidOnDate>DateTime(2026,09,30)' },
      { name: 'pay_where', label: 'Payments after (filter)', type: 'string', maxLength: 120, default: 'PaymentType=="' + K.PAYTYPE + '" AND Date>DateTime(2026,09,30)' },
      { name: 'org', label: 'Organisation', type: 'string', maxLength: 64, default: '' },
      { name: 'page', label: 'Page', type: 'number', min: 1, max: 20, default: 1 },
      { name: 'persona', label: 'View as', type: 'enum', options: ['Client', 'Bookkeeper', 'Practitioner', 'Executive'], default: 'Bookkeeper' },
      { name: 'display', label: 'Display settings', type: 'string', maxLength: 300, default: JSON.stringify(display) },
    ],
    bindings: [
      { id: 'invoices', tool: { mcp: 'xero-accounting', name: 'list_invoices' }, params: { where: st('Type=="' + K.INV + '"'), statuses: st('AUTHORISED'), order: st('DueDate ASC'), page: inp('page'), xero_tenant_id: inp('org') } },
      { id: 'paid_after', tool: { mcp: 'xero-accounting', name: 'list_invoices' }, params: { where: inp('paid_where'), statuses: st('PAID'), page: inp('page'), xero_tenant_id: inp('org') } },
      { id: 'pays_after', tool: { mcp: 'xero-accounting', name: 'list_payments' }, params: { where: inp('pay_where'), page: inp('page'), xero_tenant_id: inp('org') } },
      { id: 'credit_notes', tool: { mcp: 'xero-accounting', name: 'list_credit_notes' }, params: { where: st('Type=="' + K.CN + '" AND Status=="AUTHORISED"'), page: inp('page'), xero_tenant_id: inp('org') } },
      { id: 'overpayments', tool: { mcp: 'xero-accounting', name: 'list_overpayments' }, params: { where: st('Type=="' + K.OP + '" AND Status=="AUTHORISED"'), page: inp('page'), xero_tenant_id: inp('org') } },
      { id: 'prepayments', tool: { mcp: 'xero-accounting', name: 'list_prepayments' }, params: { where: st('Type=="' + K.PP + '" AND Status=="AUTHORISED"'), page: inp('page'), xero_tenant_id: inp('org') } },
      { id: 'bs', tool: { mcp: 'xero-accounting', name: 'get_balance_sheet' }, params: { date: inp('as_at'), standardLayout: st(true), paymentsOnly: st(false), xero_tenant_id: inp('org') } },
      { id: 'org', tool: { mcp: 'xero-accounting', name: 'get_organisation' }, params: { xero_tenant_id: inp('org') } },
      { id: 'connections', tool: { mcp: 'xero-accounting', name: 'list_connections' }, params: {} },
    ],
  };
  const out = '{\n  "inputs": [\n' + m.inputs.map((i) => '    ' + fmt(i)).join(',\n') + '\n  ],\n  "bindings": [\n' + m.bindings.map((b) => '    ' + fmt(b)).join(',\n') + '\n  ]\n}\n';
  JSON.parse(out); fs.writeFileSync(path.join(R, id + '.manifest.json'), out);
}
console.log('aged reports written: ar, ap');
