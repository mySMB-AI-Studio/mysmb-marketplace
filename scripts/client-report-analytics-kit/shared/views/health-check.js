// CRA-09 Health Check: the client's financial activity and data quality on one page. fin = { income, expenses, net, bank,
// ar, arOverdue, ap, apOverdue, docs, bankTx, latest } from the platform include; null = not in source.
// The helpers it uses are in shared/live-views.js (LV); a report includes only its own view.
var LV_VIEW = function (ui, r, fin) {
  var card = LV.card, table = LV.table, scopeTable = LV.scopeTable, findingsTable = LV.findingsTable, rowsTable = LV.rowsTable, catTable = LV.catTable, selfChecks = LV.selfChecks, sheetFindings = LV.sheetFindings, sheetScope = LV.sheetScope, NOTE_LIVE = LV.NOTE_LIVE;
  var fs = r.findings, t = LC.totals(fs), g = LC.totals(fs.filter(function (f) { return f.gst; })), q = fs.filter(function (f) { return f.query; });
  var html = ui.kpis([{ label: 'Income', value: fin.income }, { label: 'Net profit', value: fin.net }, { label: 'Bank balance', value: fin.bank }, { label: 'Receivables overdue', value: fin.arOverdue }, { label: 'Payables overdue', value: fin.apOverdue }, { label: 'Data quality', text: t.status, red: t.High > 0 }]) +
    '<div class="' + ui.p + '-banner ' + (t.High ? 'fail' : t.Medium ? 'na' : 'pass') + '" style="margin:12px 0">Health: ' + ui.h(t.status) + ' — ' + t.count + ' finding(s) (' + t.High + ' high, ' + t.Medium + ' medium, ' + t.Low + ' low), ' + g.count + ' on GST, ' + q.length + ' needing the client.</div>' +
    card(ui, 'Financial activity', table(ui, [{ t: 'Measure' }, { t: 'Value', num: true }], [
      ['Income', fin.income], ['Expenses', fin.expenses], ['Net profit', fin.net], ['Bank balance (end of period)', fin.bank], ['Receivables outstanding', fin.ar], ['Receivables overdue', fin.arOverdue], ['Payables outstanding', fin.ap], ['Payables overdue', fin.apOverdue]
    ].map(function (x) { return '<tr><td>' + ui.h(x[0]) + '</td><td class="num">' + (x[1] == null ? 'N/A — not in source' : ui.money(x[1])) + '</td></tr>'; }).concat([
      '<tr><td>Transactions in the period</td><td class="num">' + ((fin.docs || 0) + (fin.bankTx || 0)) + '</td></tr>',
      '<tr><td>Latest entry</td><td class="num">' + ui.h(fin.latest ? LC.dateText(fin.latest) : 'None in the period') + '</td></tr>'
    ]))) +
    card(ui, 'Data quality by category', catTable(ui, t)) +
    card(ui, 'Top findings', findingsTable(ui, fs.slice(0, 8)), fs.length > 8 ? 'The 8 most severe of ' + fs.length + '. Open Data Quality for all of them.' : '');
  var checks = selfChecks(r, LC.DQ, t).concat([{ name: 'Net profit = income − expenses', pass: fin.income == null || fin.expenses == null || fin.net == null ? null : Math.abs(fin.income - fin.expenses - fin.net) < 0.011, info: fin.income == null || fin.expenses == null || fin.net == null, detail: fin.net == null ? 'N/A — not in source' : LC.money(fin.net) }]);
  var sheet = [['Measure', 'Value'].map(function (x) { return { v: x, s: 'bold' }; })].concat([['Income', fin.income], ['Expenses', fin.expenses], ['Net profit', fin.net], ['Bank balance', fin.bank], ['Receivables outstanding', fin.ar], ['Receivables overdue', fin.arOverdue], ['Payables outstanding', fin.ap], ['Payables overdue', fin.apOverdue]].map(function (x) { return [x[0], x[1] == null ? 'N/A — not in source' : { v: x[1], s: 'money' }]; })).concat([[], ['Data quality', t.status], ['Findings', t.count], ['High', t.High], ['Medium', t.Medium], ['Low', t.Low], ['$ at risk', { v: t.amount, s: 'money' }]]);
  return { html: html, checks: checks, notes: [NOTE_LIVE], na: Object.keys(fin).filter(function (k) { return fin[k] == null; }).map(function (k) { return k; }).length ? ['Some financial measures are not in source on this platform'] : [],
    sheets: [{ name: 'Health check', rows: sheet, widths: [30, 18] }, { name: 'Findings', rows: sheetFindings(fs), widths: [10, 10, 13, 34, 80, 14, 40] }] };
};
