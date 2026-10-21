import html as _html

todo_id = params.get("todo_id") or ""
responses = params.get("responses") or {}
manual_client = str(params.get("client_name") or "").strip()
answer = str(bk_answer(responses, "q_action") or "").lower()
wanted = answer.startswith("ready") if todo_id else bool(manual_client)
settings = bk_read_json(BK_SETTINGS) or {}
outcome = "ignored"
pack_url = ""


def _esc(v):
    return _html.escape(str(v if v is not None else "—"))


path, run = pay_run_load(todo_id, manual_client) if wanted else ("", {})
if wanted and run:
    ps = bk_read_json(BK_PAYROLL + "/" + run["slug"] + ".json") or {}
    note = str(bk_answer(responses, "q_notes") or "").strip()
    if note:
        run.setdefault("notes", []).append({"at": bk_now_iso(settings), "by": params.get("actor") or "", "text": note[:4000]})
    try:
        draft = pay_draft_run(run["tenant_id"], (run.get("calendar") or {}).get("id") or "",
                              datetime.date.fromisoformat(run["period_start"]))
    except Exception as exc:
        draft = None
        api.workq.comment(todo_id=run["item_id"], body="Couldn't read the draft pay run from Xero Payroll: " + str(exc)[:300])
    if not draft:
        outcome = "no_draft"
        api.workq.comment(todo_id=run["item_id"], body=(
            "There's no draft pay run in Xero Payroll for " + run["period_start"] + " yet. Create it in Xero (Payroll → Pay "
            "employees), then choose **Ready for review** again."))
    else:
        totals = {k: bk_money(draft.get(k)) for k in ("Wages", "Tax", "Super", "Deductions", "Reimbursement", "NetPay")}
        slips = sorted(draft.get("Payslips") or [], key=lambda s: pay_name(s))
        check = run.get("last_check") or {}
        page = ["<!doctype html><html><head><meta charset='utf-8'><title>Pay run review pack</title><style>"
                "body{font-family:system-ui,sans-serif;margin:24px;color:#1f2937}h1{font-size:20px}h2{font-size:16px;margin-top:24px}"
                "table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid #e5e7eb;padding:6px 8px;"
                "text-align:left}th{background:#f9fafb}td.n,th.n{text-align:right}.warn{color:#b45309}.muted{color:#6b7280}</style></head><body>",
                "<h1>Pay run review pack: " + _esc(run["name"]) + "</h1>",
                "<p>Pay period " + _esc(run["period_start"]) + " to " + _esc(run["period_end"]) + " · pay day <b>"
                + _esc(run["payment_date"]) + "</b> · " + str(len(slips)) + " employees · prepared by "
                + _esc(ps.get("officer_name") or "the payroll officer") + "</p>",
                "<h2>Totals</h2><table><tr>" + "".join("<th class='n'>" + k + "</th>" for k in
                                                       ("Wages", "Tax", "Super", "Deductions", "Reimbursements", "Net pay")) + "</tr><tr>"
                + "".join("<td class='n'>" + _esc(bk_fmt(totals[k])) + "</td>" for k in
                          ("Wages", "Tax", "Super", "Deductions", "Reimbursement", "NetPay")) + "</tr></table>",
                "<h2>Employees</h2><table><tr><th>Employee</th><th class='n'>Wages</th><th class='n'>Tax</th><th class='n'>Super</th>"
                "<th class='n'>Reimbursements</th><th class='n'>Net pay</th></tr>"]
        for s in slips:
            page.append("<tr><td>" + _esc(pay_name(s)) + "</td>" + "".join(
                "<td class='n'>" + _esc(bk_fmt(bk_money(s.get(k)))) + "</td>" for k in ("Wages", "Tax", "Super", "Reimbursements", "NetPay")) + "</tr>")
        page.append("</table><h2>Checks</h2>")
        if not check:
            page.append("<p class='warn'>The checks weren't run for this pay run.</p>")
        elif check.get("open_items"):
            page.append("<p class='warn'>The last check (" + _esc(check.get("at")) + ") still had " + str(check["open_items"])
                        + " open item(s):</p><ul>" + "".join("<li>" + _esc(x) + "</li>" for x in check.get("summary") or []) + "</ul>")
        else:
            page.append("<p>The last check (" + _esc(check.get("at")) + ") found nothing to fix.</p>")
        if check.get("url"):
            page.append("<p><a href='" + _esc(check["url"]) + "'>Full check report</a></p>")
        if check.get("changes"):
            page.append("<h2>Changes this period</h2><ul>" + "".join("<li>" + _esc(x) + "</li>" for x in check["changes"]) + "</ul>")
        page.append("<h2>Notes</h2>")
        notes = ([{"text": ps["notes"], "at": "settings"}] if ps.get("notes") else []) + (run.get("notes") or [])
        page.append("<ul>" + "".join("<li>" + _esc(n.get("text")) + " <span class='muted'>(" + _esc(n.get("at")) + ")</span></li>"
                                     for n in notes) + "</ul>" if notes else "<p class='muted'>No notes.</p>")
        page.append("</body></html>")
        saved = api.artifacts.put(title=("Pay run review pack: " + run["name"] + " " + run["period_start"])[:200], content="".join(page),
                                  file_name="pay-run-pack-" + run["slug"] + "-" + run["period_start"] + ".html",
                                  description="Pay run review pack")
        pack_url = str((saved or {}).get("url") or "")
        item = api.workq.create(
            title=("Review pay run: " + run["name"] + ", " + run["period_start"] + " to " + run["period_end"])[:200],
            scope="me",
            description=("**" + run["name"] + "**, pay day **" + run["payment_date"] + "**: " + str(len(slips)) + " employees, "
                         "wages " + bk_fmt(totals["Wages"]) + ", net pay " + bk_fmt(totals["NetPay"]) + ".\n\n"
                         + ("The last check still had **" + str(check.get("open_items")) + " open item(s)**.\n\n" if check.get("open_items") else "")
                         + "[Open the review pack](" + pack_url + ")\n\nFill in the **Payroll review** form: approve it for the "
                         "client, or send it back with the changes needed."),
            priority="high",
            due_date=run["payment_date"],
            assignee_ids=[ps["reviewer_id"]] if ps.get("reviewer_id") else None,
            labels=["bookkeeping", "payroll-review", run["slug"]],
        )
        api.workq.attach_form(todo_id=item["id"], form_id=params["review_form"])
        pay_link(item["id"], run)
        run.update(status="in_review", review_item_id=item["id"], pack_url=pack_url, pack_totals=totals, staff=len(slips))
        api.workq.comment(todo_id=run["item_id"], body=("Review pack sent to " + (ps.get("reviewer_name") or "the reviewer")
                                                        + ". [Open the review pack](" + pack_url + ")"))
        outcome = "in_review"
    bk_write_json(path, run)
elif wanted and manual_client:
    outcome = "no_pay_run"
