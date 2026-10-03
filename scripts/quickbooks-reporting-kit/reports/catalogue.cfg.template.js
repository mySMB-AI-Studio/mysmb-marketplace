QB.app({
  title: 'Reports catalogue', token: null, noHead: true, primary: 'company_info', company: 'company_info', prefs: 'prefs',
  inputs: { persona: 'persona', display: 'display' },
  defaults: { persona: 'Client', display: '{"cents":0,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":0,"style":"qbo","dens":"100","p":"custom","a":"custom","c":"none","v":"","x":""}' },
  uses: {},
  tools: { company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  catalogue: /*CATALOGUE*/null,
  render: function (c) {
    var body = c.body, K = this.catalogue, ci = QB.companyInfo(c.data.company_info) || {}, h = QB.h;
    var cats = K.categories.filter(function (cat) { return K.cards.some(function (x) { return x.cat === cat; }); });
    var live = K.cards.filter(function (x) { return x.live; }).length;
    var head = '<div class="qb-card" style="margin-bottom:16px"><h1 style="margin:0 0 6px;font-size:26px">Reports catalogue</h1><div>' + h(c.company || 'N/A — not in source') + (ci.country ? ' · ' + h(ci.country) : '') + ' · ' + h(c.currency) + '</div>' +
      '<div class="muted">Data as of ' + h(c.fetchedAt ? new Date(c.fetchedAt).toLocaleString('en-AU') : '—') + ' · ' + live + ' of ' + K.cards.length + ' reports live</div>' +
      '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)"><div class="muted" style="font-size:11px;font-variant:small-caps;letter-spacing:.04em">search reports</div>' +
      '<input id="cat-q" type="search" class="qb-filter" style="width:100%;margin:6px 0 10px" placeholder="Search by name or description…" aria-label="Search reports">' +
      '<div id="cat-chips" style="display:flex;flex-wrap:wrap;gap:8px">' + ['All'].concat(cats).map(function (cat, i) { return '<button type="button" class="cat-chip' + (i ? '' : ' on') + '" data-cat="' + h(cat) + '">' + h(cat) + '</button>'; }).join('') + '</div></div></div>';
    var sections = cats.map(function (cat) {
      return '<section class="cat-sec" data-cat="' + h(cat) + '"><h2 style="font-size:17px;margin:20px 0 10px">' + h(cat) + '</h2><div class="cat-grid">' + K.cards.filter(function (x) { return x.cat === cat; }).map(function (x) {
        return '<div class="cat-card' + (x.live ? '' : ' off') + '" data-text="' + h((x.name + ' ' + x.desc + ' ' + x.q).toLowerCase()) + '"><div class="cat-name">' + h(x.name) + '</div><div class="cat-desc">' + h(x.desc) + '</div>' +
          '<div class="cat-foot"><span class="cat-badge' + (x.live ? ' live' : '') + '">' + (x.live ? 'Live' : 'Not yet implemented · Wave ' + h(x.wave)) + '</span><span class="muted" style="font-size:11px">' + h(x.q) + '</span></div></div>';
      }).join('') + '</div></section>';
    }).join('');
    body.innerHTML = '<style>.cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}.cat-card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:14px 16px;display:flex;flex-direction:column;gap:8px}.cat-card.off{opacity:.55}.cat-name{font-weight:700}.cat-desc{font-size:13px;color:var(--muted);flex:1}.cat-foot{display:flex;justify-content:space-between;align-items:center}.cat-badge{font-size:11px;font-weight:700;border-radius:10px;padding:2px 8px;background:var(--line);color:var(--muted)}.cat-badge.live{background:var(--pass-bg);color:var(--pos)}.cat-chip{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:16px;padding:5px 14px;cursor:pointer}.cat-chip.on{background:var(--accent);border-color:var(--accent);color:var(--btn-ink)}</style>' + head + '<div id="cat-sections">' + sections + '</div><p id="cat-none" class="muted" hidden>No reports match.</p>';
    var state = { cat: 'All', q: '' };
    function apply() {
      var any = false;
      body.querySelectorAll('.cat-sec').forEach(function (sec) {
        var inCat = state.cat === 'All' || sec.getAttribute('data-cat') === state.cat, shown = 0;
        sec.querySelectorAll('.cat-card').forEach(function (card) { var ok = inCat && (!state.q || card.getAttribute('data-text').indexOf(state.q) >= 0); card.hidden = !ok; if (ok) shown++; });
        sec.hidden = !shown; if (shown) any = true;
      });
      document.getElementById('cat-none').hidden = any;
    }
    document.getElementById('cat-q').addEventListener('input', function () { state.q = this.value.trim().toLowerCase(); apply(); });
    body.querySelectorAll('.cat-chip').forEach(function (b) { b.addEventListener('click', function () { state.cat = b.getAttribute('data-cat'); body.querySelectorAll('.cat-chip').forEach(function (x) { x.classList.toggle('on', x === b); }); apply(); }); });
    var qids = K.cards.map(function (x) { return x.q; }), uniq = qids.filter(function (q, i) { return qids.indexOf(q) === i; });
    this._x = K;
    return { checks: [
      { name: 'Every report maps to a family prompt (Q00–Q39)', pass: uniq.length === K.total && uniq.every(function (q) { return /^Q\d\d$/.test(q); }), detail: uniq.length + ' of ' + K.total + ' families · ' + live + ' live' }],
      notes: ['Live = built into the QuickBooks Reporting Specialist; ask for it by name in chat. Q-IDs refer to the QuickBooks Reports Prompt Library v1.1.'] };
  },
  excel: function (c) {
    var K = this._x; if (!K) return [];
    return [{ name: 'Reports catalogue', widths: [26, 34, 8, 26, 90], rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Reports catalogue', s: 'bold' }], [], [{ v: 'Category', s: 'bold' }, { v: 'Report', s: 'bold' }, { v: 'Q-ID', s: 'bold' }, { v: 'Status', s: 'bold' }, { v: 'Description', s: 'bold' }]]
      .concat(K.cards.map(function (x) { return [x.cat, x.name, x.q, x.live ? 'Live' : 'Not yet implemented (Wave ' + x.wave + ')', x.desc]; })) }];
  }
});
