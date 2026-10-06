// Inventory fixtures (M47, M48, M50, M51, M52), MYOB-shaped and consistent with each other: the item list (Inventory/Item) with
// today's quantities and values, the item movements since 1 July 2026 — purchase lines (bills), sale lines (invoices) and inventory
// adjustments — that roll forward to today's on hand, and a Balance Sheet whose inventory account equals the items' value today.
// The main ledger (ledger.js) is a services business with no stock, so the inventory reports are tested on these.
const L = require('./ledger.js');
const TODAY = '2026-09-28', CF = L.CF1, U = (n) => L.U(CF, n), r2 = (n) => Math.round(n * 100) / 100;
const INV_ACC = { UID: U(560), DisplayID: '1-1300', Name: 'Inventory' };
const SUP = { metro: { UID: U(2000), Name: 'Metro Wholesale', DisplayID: 'SUP000001' }, hub: { UID: U(2005), Name: 'Office Hub Supplies', DisplayID: 'SUP000006' } };
// [n, number, name, onHand, committed, onOrder, avgCost, price, standardCost, lastPrice, min, orderQty, supplier, flags]
const DEF = [
  [600, 'WID-100', 'Widget standard', 120, 10, 50, 22, 40, 21.5, 22.4, 150, 100, 'metro', {}],
  [601, 'WID-200', 'Widget deluxe', 8, 2, 0, 52.25, 95, 50, 53, 10, 20, 'metro', {}],
  [602, 'GAD-300', 'Gadget mini', 0, 0, 25, 12, 25, 12, 12, null, null, null, {}],
  [603, 'CAB-400', 'Cable kit', 300, 0, 0, 3.5, 9, 3.4, 3.6, 50, 200, 'hub', {}],
  [604, 'SVC-900', 'Installation service', 0, 0, 0, 0, 120, 0, 0, null, null, null, { service: true }],
  [605, 'OLD-050', 'Discontinued bracket', 0, 0, 0, 4, 10, 4, 4, null, null, null, { inactive: true }],
];
const ITEMS = DEF.map(([n, num, name, oh, cm, oo, avg, price, std, last, min, qty, sup, f]) => ({
  UID: U(n), Number: num, Name: name, IsActive: !f.inactive, IsBought: !f.service, IsSold: true, IsInventoried: !f.service,
  QuantityOnHand: oh, QuantityCommitted: cm, QuantityOnOrder: oo, QuantityAvailable: oh - cm, AverageCost: avg, CurrentValue: f.service ? 0 : r2(oh * avg),
  SellingDetails: { BaseSellingPrice: price }, AssetAccount: f.service ? null : INV_ACC,
  BuyingDetails: f.service ? null : { StandardCost: std, LastPurchasePrice: last, RestockingInformation: min == null ? null : { MinimumLevelForRestockingAlert: min, DefaultOrderQuantity: qty, Supplier: SUP[sup] } }, URI: 'x' }));
const item = (num) => { const i = ITEMS.find((x) => x.Number === num); return { UID: i.UID, Number: i.Number, Name: i.Name }; };
// movements: [date, kind (bill | inv | adj), item, quantity (signed: in +, out −), document number, contact or memo]
const MOVES = [
  ['2026-07-05', 'bill', 'GAD-300', 40, 'B0501', 'metro'], ['2026-07-10', 'bill', 'WID-100', 100, 'B0502', 'metro'], ['2026-07-12', 'bill', 'WID-200', 20, 'B0503', 'metro'],
  ['2026-07-20', 'inv', 'WID-100', -60, '00001101', 'Harbour Cafe Group'], ['2026-07-25', 'inv', 'WID-200', -8, '00001102', 'Bluegum Architects'],
  ['2026-08-01', 'bill', 'CAB-400', 200, 'B0510', 'hub'], ['2026-08-05', 'inv', 'WID-100', -40, '00001105', 'Coastal Freight Co'], ['2026-08-10', 'inv', 'GAD-300', -25, '00001106', 'Redwood Dental'],
  ['2026-08-15', 'bill', 'WID-100', 80, 'B0512', 'metro'], ['2026-08-20', 'inv', 'CAB-400', -50, '00001108', 'Summit Legal'], ['2026-08-31', 'adj', 'WID-100', -5, 'IJ000004', 'Damaged in storage'],
  ['2026-09-03', 'inv', 'WID-200', -6, '00001111', 'Parkside Physio'], ['2026-09-10', 'inv', 'WID-100', -70, '00001112', 'Eastside Motors'], ['2026-09-15', 'adj', 'WID-200', 2, 'IJ000005', 'Stocktake count'],
  ['2026-09-18', 'inv', 'GAD-300', -15, '00001114', 'Lakeview Hotel'], ['2026-09-22', 'inv', 'WID-100', -30, '00001115', 'Harbour Cafe Group'], ['2026-09-25', 'inv', 'CAB-400', -40, '00001116', 'Bluegum Architects'],
];
const inRange = (d, a, b) => (!a || d >= a) && (!b || d <= b);
const price = (num, kind) => { const i = ITEMS.find((x) => x.Number === num); return kind === 'inv' ? i.SellingDetails.BaseSellingPrice : i.BuyingDetails.LastPurchasePrice; };
const docLine = (m, k, contactKey, contact) => { const q = Math.abs(m[3]), up = price(m[2], m[1]);
  return { DocumentUID: U(8000 + k), Number: m[4], Date: m[0] + 'T00:00:00', Layout: 'Item', Status: 'Closed', IsTaxInclusive: false, [contactKey]: contact, RowID: 1, Type: 'Transaction', Description: item(m[2]).Name, Total: r2(q * up), TaxCode: { Code: 'GST' }, Account: null, Job: null, Item: item(m[2]), Quantity: q, UnitPrice: up, DiscountPercent: 0 }; };
function listInvoiceLines(p) {
  const rows = MOVES.map((m, k) => [m, k]).filter(([m]) => m[1] === 'inv' && inRange(m[0], p.from_date, p.to_date)).map(([m, k]) => docLine(m, k, 'Customer', { UID: U(1000 + k), Name: m[5] }));
  // a service item line and a line with no item: neither moves stock
  if (inRange('2026-09-12', p.from_date, p.to_date)) rows.push(Object.assign(docLine(['2026-09-12', 'inv', 'WID-100', -1, '00001113', 'Summit Legal'], 90, 'Customer', { UID: U(1004), Name: 'Summit Legal' }), { Item: item('SVC-900'), Description: 'Installation service', Quantity: 3, UnitPrice: 120, Total: 360 }),
    Object.assign(docLine(['2026-09-12', 'inv', 'WID-100', -1, '00001113', 'Summit Legal'], 91, 'Customer', { UID: U(1004), Name: 'Summit Legal' }), { RowID: 2, Item: null, Description: 'Call-out fee', Quantity: null, UnitPrice: null, Total: 80 }));
  return { Count: rows.length, Items: rows, Truncated: false };
}
function listBillLines(p) {
  const rows = MOVES.map((m, k) => [m, k]).filter(([m]) => m[1] === 'bill' && inRange(m[0], p.from_date, p.to_date)).map(([m, k]) => docLine(m, k, 'Supplier', SUP[m[5]]));
  return { Count: rows.length, Items: rows, Truncated: false };
}
function listInventoryAdjustments(p) {
  const rows = MOVES.map((m, k) => [m, k]).filter(([m]) => m[1] === 'adj' && inRange(m[0], p.from_date, p.to_date) && (!p.item_uid || item(m[2]).UID === p.item_uid)).map(([m, k]) => {
    const i = ITEMS.find((x) => x.Number === m[2]); return { UID: U(8500 + k), InventoryJournalNumber: m[4], Date: m[0] + 'T00:00:00', IsYearEndAdjustment: false, Memo: m[5],
      Lines: [{ RowID: 1, Item: item(m[2]), Quantity: m[3], UnitCost: i.AverageCost, Amount: r2(m[3] * i.AverageCost), Job: null, Memo: m[5], Account: { UID: U(561), DisplayID: '5-1100', Name: 'Inventory Adjustments' } }] }; });
  return { Count: rows.length, Items: rows };
}
const listItems = () => ({ Count: ITEMS.length, Items: JSON.parse(JSON.stringify(ITEMS)) });
const VALUE = r2(ITEMS.reduce((s, i) => s + i.CurrentValue, 0));
// the Balance Sheet: the inventory account equals the items' value today (and 3,650.00 at the end of June)
const balanceSheet = (p) => { const v = p.date >= TODAY ? VALUE : 3650, row = (a, t) => ({ AccountTotal: t, Account: { UID: a.UID, Name: a.Name, DisplayID: a.DisplayID } });
  return { AsOfDate: p.date + 'T00:00:00', AccountsBreakdown: [row({ UID: U(1), Name: 'Business Bank Account #1', DisplayID: '1-1110' }, 11270.51), row(INV_ACC, v), row({ UID: U(2), Name: 'Trade Creditors', DisplayID: '2-1200' }, 2817.73)] }; };
const listAccounts = () => ({ Count: 4, Items: [
  { UID: U(1), DisplayID: '1-1110', Name: 'Business Bank Account #1', Classification: 'Asset', Type: 'Bank', IsHeader: false },
  { UID: INV_ACC.UID, DisplayID: '1-1300', Name: 'Inventory', Classification: 'Asset', Type: 'OtherCurrentAsset', IsHeader: false },
  { UID: U(2), DisplayID: '2-1200', Name: 'Trade Creditors', Classification: 'Liability', Type: 'AccountsPayable', IsHeader: false },
  { UID: U(561), DisplayID: '5-1100', Name: 'Inventory Adjustments', Classification: 'CostOfSales', Type: 'CostOfSales', IsHeader: false }] });
module.exports = { TODAY, ITEMS, MOVES, VALUE, listItems, listInvoiceLines, listBillLines, listInventoryAdjustments, balanceSheet, listAccounts, companyFiles: L.companyFiles };
