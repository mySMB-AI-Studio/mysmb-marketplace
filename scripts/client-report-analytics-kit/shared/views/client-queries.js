// CRA-08 Client Queries: each transaction the client has to explain or send something for, ready to send.
// The helpers it uses are in shared/live-views.js (LV); a report includes only its own view.
// What each check in scope looks for: the scope-and-method column.
var LV_LOOKS = {
  'CQ-01': 'Lines coded to a suspense, clearing or uncoded account',
  'CQ-02': 'Bank transactions with no contact and no description',
  'CHK-007': 'Suppliers paid in the period with no ABN (or no address, where the platform has it)',
  'CHK-008': 'GST claimed on purchases over $82.50 from suppliers with no ABN on file',
  'CHK-021': 'Spend money over $82.50 (GST inclusive; $75 before GST) with nothing attached',
  'CHK-086': 'Bills over $82.50 with nothing attached'
};
var LV_VIEW = function (ui, r) {
  var card = LV.card, table = LV.table, scopeTable = LV.scopeTable, findingsTable = LV.findingsTable, rowsTable = LV.rowsTable, catTable = LV.catTable, selfChecks = LV.selfChecks, sheetFindings = LV.sheetFindings, sheetScope = LV.sheetScope, NOTE_LIVE = LV.NOTE_LIVE;
  var fs = r.findings.filter(function (f) { return f.query; }), rows = [], t = LC.totals(fs);
  fs.forEach(function (f) { f.rows.forEach(function (x) { rows.push(Object.assign({ check: f.check, title: f.name }, x)); }); });
  var need = function (re) { return rows.filter(function (x) { return re.test(x.need); }).length; };
  var groups = fs.map(function (f) { return card(ui, f.name + ' (' + f.rows.length + ')', rowsTable(ui, f.rows), f.text); }).join('');
  var lines = fs.map(function (f) { return '• ' + f.name + ': ' + f.rows.map(function (x) { return [x.date ? LC.dateText(x.date) : '', x.contact, x.number, x.amount == null ? '' : LC.money(x.amount)].filter(Boolean).join(' '); }).slice(0, 12).join('; ') + (f.rows.length > 12 ? '; and ' + (f.rows.length - 12) + ' more' : ''); });
  var html = ui.kpis([{ label: 'Items to ask about', value: rows.length, money: false }, { label: 'Receipts missing', value: need(/Receipt/), money: false }, { label: 'ABNs missing', value: need(/ABN/), money: false }, { label: 'To explain', value: need(/What was|Who was/), money: false }, { label: 'Amount involved', value: t.amount }]) +
    (fs.length ? groups : card(ui, 'Nothing to ask the client', '<p>No transactions in the period need information from the client.</p>')) +
    card(ui, 'Ready to send', '<div style="white-space:pre-wrap;font-size:13px">' + ui.h(fs.length ? 'Hi, we need a few things to finish your books for ' + LC.dateText(r.period.from) + ' to ' + LC.dateText(r.period.to) + ':\n' + lines.join('\n') : 'Nothing to send for this period.') + '</div>', 'Copy this into an email, or download Excel for the full list.') +
    card(ui, 'What was checked', scopeTable(ui, r, LC.QUERY));
  var sheet = [['Query', 'Date', 'Type', 'Number / reference', 'Contact', 'Amount', 'What we need', 'Link'].map(function (x) { return { v: x, s: 'bold' }; })].concat(rows.map(function (x) { return [x.title, x.date, x.kind, x.number, x.contact, x.amount == null ? '' : { v: x.amount, s: 'money' }, x.need, x.link]; }));
  var checks = selfChecks(r, LC.QUERY, t).concat([{ name: 'Every item listed belongs to a query in scope', pass: rows.every(function (x) { return LC.QUERY.indexOf(x.check) >= 0; }), detail: rows.length + ' item(s)' }]);
  return { html: html, checks: checks, notes: [NOTE_LIVE, 'Client Queries = suppliers with no ABN, missing receipts on spend money and bills over $82.50, lines coded to suspense or uncoded accounts, and bank transactions with no contact or description.'], na: [],
    sheets: [{ name: 'Client queries', rows: sheet, widths: [36, 12, 14, 18, 28, 14, 30, 40] }] };
};
