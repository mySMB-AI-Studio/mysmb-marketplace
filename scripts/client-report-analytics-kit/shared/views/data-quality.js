// CRA-02 Data Quality: every finding by category and severity, with $ at risk, and what was checked.
// The helpers it uses are in shared/live-views.js (LV); a report includes only its own view.
var LV_VIEW = function (ui, r) {
  var card = LV.card, table = LV.table, scopeTable = LV.scopeTable, findingsTable = LV.findingsTable, rowsTable = LV.rowsTable, catTable = LV.catTable, selfChecks = LV.selfChecks, sheetFindings = LV.sheetFindings, sheetScope = LV.sheetScope, NOTE_LIVE = LV.NOTE_LIVE;
  var fs = r.findings, t = LC.totals(fs);
  var html = ui.kpis([{ label: 'Findings', value: t.count, money: false }, { label: 'High', value: t.High, money: false, red: t.High > 0 }, { label: 'Medium', value: t.Medium, money: false }, { label: 'Low', value: t.Low, money: false }, { label: '$ at risk', value: t.amount }]) +
    '<div class="' + ui.p + '-banner ' + (t.High ? 'fail' : t.Medium ? 'na' : 'pass') + '" style="margin:12px 0">Data quality: ' + ui.h(t.status) + ' — ' + t.count + ' finding(s) across ' + Object.keys(t.byCat).length + ' categor' + (Object.keys(t.byCat).length === 1 ? 'y' : 'ies') + '.</div>' +
    card(ui, 'By category and severity', catTable(ui, t)) +
    card(ui, 'Findings', findingsTable(ui, fs), 'Most severe first. * marks our best reading of a loosely defined check.') +
    card(ui, 'What was checked', scopeTable(ui, r, LC.DQ));
  return { html: html, checks: selfChecks(r, LC.DQ, t), notes: [NOTE_LIVE], na: [],
    sheets: [{ name: 'Findings', rows: sheetFindings(fs), widths: [10, 10, 13, 34, 80, 14, 40] }, { name: 'What was checked', rows: sheetScope(r, LC.DQ), widths: [10, 40, 13, 10, 60, 50] }] };
};
