// PRA-06 Financial Overview: revenue, GP, NP, margins, bank balance total, AR/AP ageing totals, for
// all or selected clients on one page — the practice-wide version of the Client agent's Financial
// Overview. Sourced from get_practice_financial_overview (CONSOL). QuickBooks excluded.
const { buildPracticeTable } = require('../practice-table-kit.js');

module.exports = function build() {
  return buildPracticeTable({
    title: 'Practice Financial Overview',
    slug: 'practice-financial-overview',
    chips: ['Needs attention'],
    sources: { xero: 'xero', myob: 'myob' },
    qbNote: 'one company per connection — see its Financial Overview in the Client Report Analytics agent.',
    // get_practice_financial_overview: revenue/gross/net profit and bank balance agree on name; the
    // margin and ageing-total names diverge between the two independently-built tools.
    fieldAliases: {
      xero: { revenue: 'revenue', gross_profit: 'grossProfit', gp_margin: 'grossMargin', net_profit: 'netProfit', np_margin: 'netMargin', bank_total: 'bankBalance', ar_total: 'arAgeingTotal', ap_total: 'apAgeingTotal' },
      myob: { revenue: 'revenue', gross_profit: 'grossProfit', gp_margin: 'grossProfitMargin', net_profit: 'netProfit', np_margin: 'netProfitMargin', bank_total: 'bankBalance', ar_total: 'arOutstanding', ap_total: 'apOutstanding' }
    },
    columns: [
      { key: 'revenue', label: 'Revenue', money: true },
      { key: 'gross_profit', label: 'Gross profit', money: true },
      { key: 'gp_margin', label: 'GP %', pct: true },
      { key: 'net_profit', label: 'Net profit', money: true, rag: 'low' },
      { key: 'np_margin', label: 'NP %', pct: true },
      { key: 'bank_total', label: 'Bank total', money: true },
      { key: 'ar_total', label: 'AR ageing', money: true },
      { key: 'ap_total', label: 'AP ageing', money: true }
    ],
    totals: ['revenue', 'gross_profit', 'net_profit', 'bank_total', 'ar_total', 'ap_total']
  });
};
