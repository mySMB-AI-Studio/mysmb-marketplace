// PRA-06 Financial Overview: revenue, GP, NP, margins, bank balance total, AR/AP ageing totals, for
// all or selected clients on one page — the practice-wide version of the Client agent's Financial
// Overview. Sourced from get_practice_financial_overview (CONSOL). QuickBooks excluded.
const { buildPracticeTable } = require('../practice-table-kit.js');

module.exports = function build() {
  return buildPracticeTable({
    title: 'Practice Financial Overview',
    slug: 'practice-financial-overview',
    tool: 'get_practice_financial_overview', // named in the footer and the Excel Parameters sheet
    chips: ['Needs attention'],
    sources: { xero: 'xero', myob: 'myob' },
    // Xero rows are read per organisation in the report from xero-api (xero-fan.js); MYOB still uses its tool.
    xeroFan: { kind: 'financial' },
    qbNote: 'one company per connection — open its Financial Overview from the Client Report Analytics reports (ask mySidekick or the Client Reporting Agent, or Reports → From your plugins).',
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
