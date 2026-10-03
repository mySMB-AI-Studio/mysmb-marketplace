// node mk-payables.js — derive the payables kit reports from their tested receivables twins, then hand-check the result:
//   ub (Unpaid Bills, M40) from ar (Unpaid Invoices) · pr (Payables Reconciliation, M41/M42) from rr (Receivables Reconciliation)
const fs = require('fs'), path = require('path'), R = path.join(__dirname, 'reports') + '/';
const SWAP = [
  ['AccountReceivable', 'AccountsPayable'], ['Accounts Receivable', 'Accounts Payable'], ['/receivable|debtors/i', '/payable|creditors/i'],
  ['list_invoices (open sales invoices', 'list_bills (open purchase bills'], ['Open sales invoices', 'Open purchase bills'], ['open sales invoices', 'open purchase bills'],
  ['Unpaid Invoices', 'Unpaid Bills'], ['Unpaid invoices', 'Unpaid bills'], ['unpaid invoices', 'unpaid bills'],
  ['Receivables Reconciliation', 'Payables Reconciliation'], ['Receivables reconciliation', 'Payables reconciliation'], ['receivables account', 'payables account'],
  ['Receivables account', 'Payables account'], ['receivables', 'payables'], ['Receivables', 'Payables'],
  ['c.data.invoices', 'c.data.bills'], ['c.errors.invoices', 'c.errors.bills'], ["c.err('invoices')", "c.err('bills')"], ['uses: { invoices:', 'uses: { bills:'], ['tools: { invoices:', 'tools: { bills:'],
  ['Customer', 'Supplier'], ['customers', 'suppliers'], ['customer', 'supplier'], ['Invoices', 'Bills'], ['invoices', 'bills'], ['Invoice', 'Bill'], ['invoice', 'bill'], ['an bill', 'a bill'], ['credit not applied to a bill', 'debit not applied to a bill'],
];
function derive(from, to, title) {
  let s = fs.readFileSync(R + from + '.cfg.js', 'utf8').replace(/\r\n/g, '\n');
  SWAP.forEach(([a, b]) => { s = s.split(a).join(b); });
  if (/[Cc]ustomer|[Ii]nvoice|[Rr]eceivab|debtors/.test(s)) throw new Error(to + ' left: ' + (s.match(/.{30}(?:[Cc]ustomer|[Ii]nvoice|[Rr]eceivab|debtors).{30}/g) || []).slice(0, 4).join(' || '));
  if (!s.includes("title: '" + title + "'")) throw new Error(to + ': title');
  fs.writeFileSync(R + to + '.cfg.js', s);
  const m = JSON.parse(fs.readFileSync(R + from + '.manifest.json', 'utf8'));
  m.bindings.forEach((b) => { if (b.tool.name === 'list_invoices') { b.tool.name = 'list_bills'; if (b.id === 'invoices') b.id = 'bills'; } });
  m.inputs.forEach((i) => { if (i.type === 'enum') { i.options = i.options.map((o) => o.replace('Invoice', 'Bill')); if (typeof i.default === 'string') i.default = i.default.replace('Invoice', 'Bill'); } if (i.name === 'display') i.default = i.default.replace('"v":"customers"', '"v":"suppliers"'); });
  const txt = JSON.stringify(m, null, 2) + '\n'; if (/[Cc]ustomer|[Ii]nvoice/.test(txt)) throw new Error(to + ' manifest left');
  fs.writeFileSync(R + to + '.manifest.json', txt);
  console.log('derived', to, 'from', from);
}
derive('ar', 'ub', 'Unpaid Bills');
derive('rr', 'pr', 'Payables Reconciliation');
