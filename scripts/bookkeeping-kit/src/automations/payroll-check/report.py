import html as _html

QUERY_PROMPT = (
    "Draft one email from a payroll officer at a bookkeeping practice to the client's staff member who looks after "
    "timesheets, asking them to confirm the points below before payroll is finalised. Group the points by employee, keep "
    "each one short and specific (dates and hours), be polite and plain. Plain text, no subject line, sign off as the "
    "payroll team. Use only the facts given."
)

problem = params.get("problem") or ""
ctx = params.get("ctx") or {}
f = params.get("findings") or {}
settings = ctx.get("settings") or {}
ps = ctx.get("payroll") or {}
run = dict(ctx.get("run") or {})
run_path = ctx.get("run_path") or ""
open_items = 0
report_url = ""


def _esc(v):
    return _html.escape(str(v if v is not None else "—"))


def _table(title, head, rows):
    if not rows:
        return ""
    out = ["<h2>" + _esc(title) + " (" + str(len(rows)) + ")</h2><table><tr>" + "".join("<th>" + _esc(h) + "</th>" for h in head) + "</tr>"]
    for r in rows:
        out.append("<tr>" + "".join("<td>" + _esc(c) + "</td>" for c in r) + "</tr>")
    return "".join(out) + "</table>"


if problem:
    if run.get("item_id"):
        api.workq.comment(todo_id=run["item_id"], body=problem)
elif run.get("item_id"):
    sections = [
        ("Missing in Xero Payroll (hours in Deputy)", ["Employee"], [[n] for n in f.get("missing_starters") or []],
         "add them before the pay run"),
        ("Salaried staff with timesheets", ["Employee", "Hours"], [[r["name"], r["hours"]] for r in f.get("salaried_timesheets") or []],
         "delete these timesheets: salaried staff are paid their standard hours"),
        ("Hours that differ (Deputy vs Xero)", ["Employee", "Date", "Deputy", "Xero"],
         [[r["name"], r["date"], r["deputy"], r["xero"]] for r in f.get("hours") or []], "fix in Xero or ask the client"),
        ("Penalty bands that differ (from shift times vs Xero)", ["Employee", "Band", "Expected hours", "Xero hours"],
         [[r["name"], PAY_BAND_NAMES.get(r["band"], r["band"]), r["expected"], r["xero"]] for r in f.get("bands") or []],
         "check the earnings lines"),
        ("Rates that differ from the pay guide", ["Employee", "Band", "Pay guide", "Xero", "Note"],
         [[r["name"], PAY_BAND_NAMES.get(r["band"], r["band"]), r["expected"], r["xero"], r.get("note") or ""] for r in f.get("rates") or []],
         "update the pay item or the pay guide"),
        ("Not in the pay guide's employees sheet", ["Employee"], [[n] for n in f.get("unclassified") or []],
         "add their award and classification so their rates can be checked"),
        ("Reimbursements that differ", ["Employee", "Reimbursement file", "Draft pay run"],
         [[r["name"], r["file"], r["pay_run"]] for r in f.get("reimbursements") or []], "fix the reimbursement lines"),
        ("Changes this period", ["Employee", "Change"], [[r["name"], r["text"]] for r in f.get("changes") or []], "act on these"),
    ]
    open_items = sum(len(rows) for _, _, rows, _ in sections if rows) - len(f.get("changes") or [])
    t = f.get("totals") or {}
    page = ["<!doctype html><html><head><meta charset='utf-8'><title>Payroll check</title><style>"
            "body{font-family:system-ui,sans-serif;margin:24px;color:#1f2937}h1{font-size:20px}h2{font-size:16px;margin-top:24px}"
            "table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid #e5e7eb;padding:6px 8px;"
            "text-align:left}th{background:#f9fafb}.ok{color:#047857}.muted{color:#6b7280}</style></head><body>",
            "<h1>Payroll check: " + _esc(run.get("name")) + ", " + _esc(f.get("period")) + "</h1>",
            "<p class='muted'>Pay day " + _esc(run.get("payment_date")) + " · " + _esc(f.get("employees")) + " employees on the pay calendar"
            + (" · Deputy compared" if f.get("deputy") else "") + " · checked " + _esc(bk_now_iso(settings)) + "</p>"]
    if t:
        page.append(_table("Draft pay run", ["Wages", "Tax", "Super", "Deductions", "Reimbursements", "Net pay"],
                           [[bk_fmt(t.get("Wages")), bk_fmt(t.get("Tax")), bk_fmt(t.get("Super")), bk_fmt(t.get("Deductions")),
                             bk_fmt(t.get("Reimbursement")), bk_fmt(t.get("NetPay"))]]))
    for title, head, rows, _ in sections:
        page.append(_table(title, head, rows))
    if not open_items:
        page.append("<p class='ok'><b>Nothing to fix.</b></p>")
    for n in f.get("notes") or []:
        page.append("<p class='muted'>" + _esc(n) + "</p>")
    page.append("</body></html>")
    saved = api.artifacts.put(title=("Payroll check: " + str(run.get("name")) + " " + str(f.get("period")))[:200],
                              content="".join(page), file_name="payroll-check-" + run["slug"] + "-" + run["period_start"] + ".html",
                              description="Payroll check for the pay run")
    report_url = str((saved or {}).get("url") or "")

    lines = ["**Payroll check, " + bk_now_iso(settings)[:16].replace("T", " ") + "**: "
             + ("nothing to fix." if not open_items else str(open_items) + " thing(s) to fix or confirm.")]
    for title, _, rows, what in sections:
        if rows:
            lines.append("- " + title + ": **" + str(len(rows)) + "**. " + what[0].upper() + what[1:] + ".")
    for n in f.get("notes") or []:
        lines.append("- " + n)
    if report_url:
        lines.append("\n[Open the full check](" + report_url + ")")

    asks = ([{"employee": n, "point": "has hours in Deputy but isn't set up in Xero Payroll"} for n in f.get("missing_starters") or []]
            + [{"employee": r["name"], "point": r["date"] + ": Deputy shows " + str(r["deputy"]) + " hours, Xero " + str(r["xero"])}
               for r in f.get("hours") or []])
    if asks and ps.get("ts_owner"):
        email = api.ai.generate(prompt=QUERY_PROMPT, input=json.dumps({
            "to": ps.get("ts_owner"), "business": run.get("name"), "pay_period": f.get("period"), "points": asks[:60]}))
        lines.append("\n**Draft query email to " + ps["ts_owner"] + (" (" + ps["ts_email"] + ")" if ps.get("ts_email") else "")
                     + "** for you to edit and send:\n\n" + str(email))
    api.workq.comment(todo_id=run["item_id"], body="\n".join(lines))
    api.workq.set_status(todo_id=run["item_id"], status="in_progress")

    run["status"] = "checked"
    run["last_check"] = {"at": bk_now_iso(settings), "open_items": open_items, "url": report_url,
                         "summary": [t + ": " + str(len(r)) for t, _, r, _ in sections if r],
                         "changes": [c["name"] + ": " + c["text"] for c in f.get("changes") or []],
                         "totals": f.get("totals") or {}}
    run.setdefault("checks", []).append({"at": run["last_check"]["at"], "open_items": open_items, "url": report_url})
    bk_write_json(run_path, run)
