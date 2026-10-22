import html as _html

summary = params.get("summary") or {}
where, id_key, _file, _name = bk_ledger_info(params.get("ledger"))
report_url = ""
if not params.get("problem") and summary.get("report_due"):
    settings = bk_read_json(BK_SETTINGS) or {}
    today = bk_today(settings)
    clients = []
    for f in api.files.list(path=BK_CLIENTS):
        c = bk_read_json(f["path"]) if str(f.get("name") or "").endswith(".json") else None
        if c and c.get(id_key) and c.get("checks_enabled", True) is not False:
            state = bk_read_json(BK_CHECKS + "/" + c["slug"] + ".json") or {}
            clients.append((c, state, ck_open(state)))
    clients.sort(key=lambda t: str(t[0].get("name") or "").lower())

    def esc(value):
        return _html.escape(str(value if value is not None else ""))

    def money(value):
        return bk_fmt(value) if value is not None else "—"

    def finding_row(name, f):
        link = (" <a href='" + esc(f["link"]) + "' target='_blank' rel='noopener noreferrer'>Open in " + where + "</a>") if f.get("link") else ""
        return ("<tr><td>" + esc(name) + "</td><td class='s" + esc(f["severity"]) + "'>" + esc(f["severity"]) + "</td><td>"
                + esc(f["check"]) + " " + esc(f["name"]) + "</td><td class='n'>" + money(f.get("amount")) + "</td><td>"
                + esc(f["text"]) + link + "</td><td>" + esc(ck_ref(f["key"])) + "</td></tr>")

    def last_checked(state):
        failed = state.get("failed") or {}
        if failed.get("on") and (not state.get("last_daily") or failed["on"] > state["last_daily"]):
            return ("<span class='sHigh'>Couldn't read " + where + " on " + esc(ck_date_text(ck_day(failed["on"]))) + "</span>"
                    + (" (last checked " + esc(ck_date_text(ck_day(state["last_daily"]))) + ")" if state.get("last_daily") else ""))
        return esc(ck_date_text(ck_day(state["last_daily"]))) if state.get("last_daily") else "Not yet"

    summary_rows, query_rows, open_rows = [], [], []
    for c, state, rows in clients:
        quiet = len([f for f in (state.get("findings") or {}).values() if f.get("status") in ("dismissed", "snoozed")])
        count = {s: len([f for f in rows if f["severity"] == s]) for s in ("High", "Medium", "Low")}
        summary_rows.append("<tr><td>" + esc(c.get("name")) + "</td><td class='n'>" + str(count["High"] or "—") + "</td><td class='n'>"
                            + str(count["Medium"] or "—") + "</td><td class='n'>" + str(count["Low"] or "—") + "</td><td class='n'>"
                            + money(sum(f.get("amount") or 0 for f in rows) if rows else None) + "</td><td class='n'>"
                            + str(quiet or "—") + "</td><td>" + last_checked(state) + "</td></tr>")
        for f in rows:
            (query_rows if f["check"] in CK_CLIENT_QUERY else open_rows).append(finding_row(c.get("name"), f))
    # GST checks (CRA-10): open GST findings now, and those resolved (no longer found) in the last GST_DAYS days.
    GST_DAYS = 90
    gst_since = str(today - datetime.timedelta(days=GST_DAYS))
    gst_rows, gst_open, gst_fixed = [], [0, 0.0], [0, 0.0]
    for c, state, rows in clients:
        fixed = [r for r in (state.get("resolved") or []) if r.get("check") in CK_GST and str(r.get("on") or "") >= gst_since]
        for check in CK_GST:
            o = [f for f in rows if f["check"] == check]
            r = [x for x in fixed if x["check"] == check]
            if not o and not r:
                continue
            o_amt, r_amt = sum(f.get("amount") or 0 for f in o), sum(x.get("amount") or 0 for x in r)
            gst_open[0] += len(o)
            gst_fixed[0] += len(r)
            if check != "CHK-136":
                gst_open[1] += o_amt
                gst_fixed[1] += r_amt
            gst_rows.append("<tr><td>" + esc(c.get("name")) + "</td><td>" + esc(check + " " + CK_CATALOGUE[check][1]) + "</td><td class='n'>"
                            + str(len(o) or "—") + "</td><td class='n'>" + (money(o_amt) if o else "—") + "</td><td class='n'>"
                            + str(len(r) or "—") + "</td><td class='n'>" + (money(r_amt) if r else "—") + "</td></tr>")
    if gst_rows:
        gst_rows.append("<tr class='t'><td colspan='2'>All businesses</td><td class='n'>" + str(gst_open[0]) + "</td><td class='n'>"
                        + money(gst_open[1]) + "</td><td class='n'>" + str(gst_fixed[0]) + "</td><td class='n'>" + money(gst_fixed[1])
                        + "</td></tr>")

    every = [f for _c, _s, rows in clients for f in rows]
    totals = (str(len(clients)) + " business" + ("" if len(clients) == 1 else "es") + " · " + str(len(every)) + " open finding"
              + ("" if len(every) == 1 else "s") + " · " + str(len([f for f in every if f["severity"] == "High"])) + " high · "
              + "$" + money(sum(f.get("amount") or 0 for f in every)) + " at risk")
    head = "<tr><th>Business</th><th>Severity</th><th>Check</th><th>$</th><th>Finding</th><th>Ref</th></tr>"
    page = (
        "<!doctype html><html><head><meta charset='utf-8'><base target='_blank'><title>Ledger checks " + str(today) + "</title>"
        "<meta name='color-scheme' content='light'>"
        "<style>html{background:#ffffff;color-scheme:light}"
        "body{font:14px/1.45 system-ui,sans-serif;margin:0;padding:24px 28px;color:#1c2330;background:#ffffff}"
        "h1{font-size:20px;margin:0 0 4px;color:#101828}h2{font-size:16px;margin:28px 0 8px;color:#101828}"
        "table{border-collapse:collapse;width:100%;background:#ffffff}"
        "th,td{border-bottom:1px solid #e3e6ec;padding:6px 8px;text-align:left;vertical-align:top;color:#1c2330}"
        "th{background:#f3f5f8;font-size:12px;color:#344054}.n{text-align:right;white-space:nowrap}"
        ".sHigh{color:#b42318;font-weight:600}.sMedium{color:#b54708}.sLow{color:#475467}p.m{color:#5d6778}"
        ".k{font-size:15px;font-weight:600;color:#101828;margin:8px 0 4px}tr.t td{font-weight:600;background:#f9fafb}a{color:#175cd3}</style></head><body>"
        "<h1>Data quality: ledger checks, " + ck_date_text(today) + "</h1>"
        "<p class='k'>" + esc(totals) + "</p>"
        "<p class='m'>Open findings from the Ledger checks automation as of its last run for each business (not live). "
        "Severities are the checks catalogue's defaults. Dismissed and snoozed findings aren't listed.</p>"
        "<h2>By business</h2><table><thead><tr><th>Business</th><th>High</th><th>Medium</th><th>Low</th><th>$ at risk</th>"
        "<th>Dismissed or snoozed</th><th>Last checked</th></tr></thead><tbody>"
        + ("".join(summary_rows) or "<tr><td colspan='7'>No businesses have ledger checks turned on.</td></tr>") + "</tbody></table>"
        "<h2>GST checks</h2><p class='m'>The GST-related checks: findings open now, and findings resolved in the last "
        + str(GST_DAYS) + " days (the check no longer finds them, so they were fixed in " + where + "). $ is the amount each check reports, "
        "usually the GST on the transactions involved; CHK-136's is the business's 12-month income, so it isn't in the totals. "
        "Dismissed and snoozed findings aren't counted.</p>"
        "<table><thead><tr><th>Business</th><th>Check</th><th>Open</th><th>Open $</th><th>Resolved</th><th>Resolved $</th></tr></thead>"
        "<tbody>" + ("".join(gst_rows) or "<tr><td colspan='6'>No GST findings open or resolved in the last " + str(GST_DAYS)
                     + " days.</td></tr>") + "</tbody></table>"
        "<h2>Client queries</h2><p class='m'>Findings the business has to answer: receipts, ABNs and TPAR details.</p>"
        "<table><thead>" + head + "</thead><tbody>" + ("".join(query_rows) or "<tr><td colspan='6'>None.</td></tr>") + "</tbody></table>"
        "<h2>Everything else</h2><table><thead>" + head + "</thead><tbody>"
        + ("".join(open_rows) or "<tr><td colspan='6'>None.</td></tr>") + "</tbody></table>"
        "<p class='m'>Generated by Bookkeeping " + ("for Xero" if where == "Xero" else "checks for " + where) + ".</p></body></html>"
    )
    tag = "" if where == "Xero" else " (" + where + ")"
    saved = api.artifacts.put(title="Ledger checks" + tag + " " + str(today), content=page,
                              file_name="ledger-checks-" + ("" if where == "Xero" else bk_slug(where) + "-") + str(today) + ".html",
                              kind="document", mime_type="text/html", tags=["bookkeeping", "checks", "data-quality"])
    report_url = (saved or {}).get("url") or ""
    bk_write_json(ck_report_path(params.get("ledger")), {"on": str(today), "url": report_url})
    recipients = [x for x in {settings.get("checks_owner_id") or settings.get("reviewer_id")} if x]
    if recipients:
        high = sum(len([f for f in rows if f["severity"] == "High"]) for _c, _s, rows in clients)
        total = sum(len(rows) for _c, _s, rows in clients)
        api.notify.send(title="Weekly ledger checks report" + tag + " is ready",
                        body=(str(total) + " open finding(s), " + str(high) + " high. " + report_url).strip(),
                        user_ids=recipients)
