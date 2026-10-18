// CRA-10 GST Check: scope and method of every GST check, which are clear (resolved) and which carry GST risk (unresolved).
// The helpers it uses are in shared/live-views.js (LV); a report includes only its own view.
// What each check in scope looks for: the scope-and-method column.
var LV_LOOKS = {
  'CHK-003': 'A contact whose GST registration on the register differs from how they\'re coded',
  'CHK-008': 'GST claimed on purchases over $82.50 from suppliers with no ABN on file',
  'CHK-031': 'GST on sales or credit notes when the business isn\'t registered for GST',
  'CHK-058': 'GST claimed on accounts that normally carry none: wages, super, bank fees, interest, ASIC fees, depreciation and similar',
  'CHK-059': 'GST that isn\'t the tax rate\'s share of the line, and one supplier\'s account coded both with and without GST',
  'CHK-068': 'GST claimed on bills from a supplier not registered for GST',
  'CHK-069': 'GST on bank transactions with a supplier not registered for GST',
  'CHK-076': 'A payment to a supplier not registered for GST',
  'CHK-077': 'A bank payment with GST to a supplier not registered for GST',
  'CHK-085': 'A bill with GST from a supplier not registered for GST',
  'CHK-129': 'An account that defaults to GST whose lines mostly have none (5 or more lines, 80% without)',
  'CHK-136': 'Income over $75,000 in 12 months without GST registration'
};
var LV_VIEW = function (ui, r) {
  var card = LV.card, table = LV.table, scopeTable = LV.scopeTable, findingsTable = LV.findingsTable, rowsTable = LV.rowsTable, catTable = LV.catTable, selfChecks = LV.selfChecks, sheetFindings = LV.sheetFindings, sheetScope = LV.sheetScope, NOTE_LIVE = LV.NOTE_LIVE;
  var sc = LC.scope(r, LC.GST), fs = r.findings.filter(function (f) { return f.gst; }), t = LC.totals(fs);
  var clear = sc.filter(function (s) { return s.status === 'clear'; }).length, open = sc.filter(function (s) { return s.status === 'findings'; }).length;
  var html = ui.kpis([{ label: 'GST checks run live', value: clear + open, money: false }, { label: 'Clear', value: clear, money: false }, { label: 'With findings', value: open, money: false, red: open > 0 }, { label: 'GST at risk', value: t.amount }, { label: 'Overnight or N/A', value: sc.length - clear - open, money: false }]) +
    '<div class="' + ui.p + '-banner ' + (open ? 'na' : 'pass') + '" style="margin:12px 0">' + (open ? open + ' GST check(s) have findings: ' + ui.money(t.amount) + ' of GST at risk.' : 'Every GST check that runs live is clear for this period.') + '</div>' +
    card(ui, 'Unresolved GST risk', findingsTable(ui, fs)) +
    card(ui, 'Scope and method', scopeTable(ui, r, LC.GST), 'Resolved = the check runs and finds nothing in the period. The register checks need the Australian Business Register and run overnight in Bookkeeping for Xero.');
  return { html: html, checks: selfChecks(r, LC.GST, t), notes: [NOTE_LIVE], na: [],
    sheets: [{ name: 'GST findings', rows: sheetFindings(fs), widths: [10, 10, 13, 34, 80, 14, 40] }, { name: 'Scope and method', rows: sheetScope(r, LC.GST), widths: [10, 40, 13, 10, 60, 50] }] };
};
