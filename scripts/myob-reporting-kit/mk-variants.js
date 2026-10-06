// node mk-variants.js — report skills that are another kit report opening differently: the same config and bindings, with their own
// title and opening defaults. Writes reports/<variant>.cfg.js + .manifest.json from the base report; run before gen-myob.js.
const fs = require('fs'), path = require('path'), R = path.join(__dirname, 'reports');
const VARIANTS = [
  // Aged receivables (no library prompt; the connector's own ageing) = Unpaid invoices aged by due date
  { id: 'ag', base: 'ar', title: ['Unpaid Invoices', 'Aged Receivables'], inputs: { method: 'Due date' } },
  // Customer sales (M35) = the Sales register's customer view
  { id: 'cs', base: 'sr', title: ['Sales Register', 'Customer Sales'], display: { v: 'customers' } },
  // Aged payables (M40 by due date) = Unpaid bills aged by due date; Supplier purchases (M43) = the Purchase register's supplier view
  { id: 'ap', base: 'ub', title: ['Unpaid Bills', 'Aged Payables'], inputs: { method: 'Due date' } },
  { id: 'sp', base: 'pg', title: ['Purchase Register', 'Supplier Purchases'], display: { v: 'suppliers' } },
  // Item sales analysis (M49) and Customer sales (detail) (M36) = the invoice lines report (Item sales, M39) on its other views
  { id: 'ia', base: 'il', title: ['Item Sales', 'Item Sales Analysis'], display: { v: 'analysis' } },
  { id: 'cd', base: 'il', title: ['Item Sales', 'Customer Sales (Detail)'], display: { v: 'customer' } },
  // Payroll register (M21), payroll summary (M20), accrual by fund (M25/M26) and superannuation payments (M27) = the payroll report
  // (Pay run history, M23) on its other views
  { id: 'pyr', base: 'py', title: ['Pay Run History', 'Payroll Register'], display: { v: 'register' } },
  { id: 'pys', base: 'py', title: ['Pay Run History', 'Payroll Summary'], display: { v: 'summary' } },
  { id: 'pyf', base: 'py', title: ['Pay Run History', 'Accrual by Fund'], display: { v: 'fund' } },
  { id: 'pyp', base: 'py', title: ['Pay Run History', 'Superannuation Payments'], display: { v: 'super' } },
  // Pay item transactions (M30) = the payroll report grouped by pay item
  { id: 'pyi', base: 'py', title: ['Pay Run History', 'Pay Item Transactions'], display: { v: 'items' } },
  // Journal entries (M09) and Categories transactions (M11) = the General ledger's journal and category views; Categories list (M10) =
  // the Trial balance's chart-of-accounts view (every account, balances at the date — the API's own account list has today's only)
  { id: 'je', base: 'gl', title: ['General Ledger', 'Journal Entries'], display: { v: 'journal' } },
  { id: 'cx', base: 'gl', title: ['General Ledger', 'Categories Transactions'], display: { v: 'category' } },
  { id: 'cl', base: 'tb', title: ['Trial Balance', 'Categories List'], display: { v: 'list', zeros: 1 } },
  // Coding (M18) = Bank transactions (M16) grouped by coding status
  { id: 'bc', base: 'bt', title: ['Bank Transactions', 'Coding'], display: { v: 'coding' } },
  // Reorder (M47), Item list (M51) and Inventory value reconciliation (M52) = the inventory report (Stock on hand, M48) on its other views
  { id: 'ro', base: 'iv', title: ['Stock on Hand', 'Reorder'], display: { v: 'reorder' } },
  { id: 'it', base: 'iv', title: ['Stock on Hand', 'Item List'], display: { v: 'list' } },
  { id: 'vr', base: 'iv', title: ['Stock on Hand', 'Inventory Value Reconciliation'], display: { v: 'recon' } },
];
for (const v of VARIANTS) {
  let cfg = fs.readFileSync(path.join(R, v.base + '.cfg.js'), 'utf8').replace(/\r\n/g, '\n');
  const t = "title: '" + v.title[0] + "'"; if (cfg.split(t).length !== 2) throw new Error(v.base + ': title marker not found'); cfg = cfg.replace(t, "title: '" + v.title[1] + "'");
  const m = JSON.parse(fs.readFileSync(path.join(R, v.base + '.manifest.json'), 'utf8'));
  Object.keys(v.inputs || {}).forEach((k) => { const re = new RegExp("(defaults: \\{[^}]*\\b" + k + ": )'[^']*'"); if (!re.test(cfg)) throw new Error(v.base + ': default ' + k + ' not found'); cfg = cfg.replace(re, "$1'" + v.inputs[k] + "'"); m.inputs.find((i) => i.name === k).default = v.inputs[k]; });
  if (v.display) { const di = m.inputs.find((i) => i.name === 'display'), d = JSON.parse(di.default); Object.assign(d, v.display); const nd = JSON.stringify(d), old = "display: '" + di.default + "'"; if (cfg.split(old).length !== 2) throw new Error(v.base + ': display default not found'); cfg = cfg.replace(old, "display: '" + nd + "'"); di.default = nd; }
  fs.writeFileSync(path.join(R, v.id + '.cfg.js'), cfg);
  fs.writeFileSync(path.join(R, v.id + '.manifest.json'), JSON.stringify(m, null, 2) + '\n');
  console.log('variant', v.id, 'from', v.base);
}
