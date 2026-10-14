CHASE_PROMPT = (
    "Draft a short, polite email from a payroll officer at a bookkeeping practice to the client's staff member who "
    "exports the timesheets, asking whether this pay period's timesheets are ready in Xero, as payroll is being prepared "
    "today. Plain text, no subject line, sign off as the payroll team. Use only the facts given."
)
SOURCE_WORDS = {"deputy": "Deputy, exported to Xero by the client", "xero": "entered in Xero Payroll",
                "emailed": "emailed timesheets, keyed into Xero by us", "none": "none (salaried staff only)"}

settings = bk_read_json(BK_SETTINGS) or {}
tz_now = datetime.datetime.now(bk_tz(settings))
try:
    # The trigger's own time when it carries one (a scheduled fire time), so a late run behaves like an on-time one.
    if params.get("now"):
        tz_now = datetime.datetime.fromisoformat(str(params.get("now")).replace("Z", "+00:00")).astimezone(bk_tz(settings))
except ValueError:
    pass
only = bk_slug(params.get("client_name") or "") if str(params.get("client_name") or "").strip() else ""
opened = 0
chased = 0
lines = []

for f in (api.files.list(path=BK_PAYROLL) if settings else []):
    if f.get("kind") != "file" or not str(f.get("path", "")).endswith(".json"):
        continue
    ps = bk_read_json(f["path"]) or {}
    slug = ps.get("slug") or ""
    if not slug or (only and slug != only):
        continue
    name = ps.get("name") or slug
    try:
        client = bk_client_for(settings, slug) or {}
        tenant = client.get("xero_tenant_id")
        if not tenant:
            lines.append("- " + name + ": no Xero organisation in its bookkeeping settings")
            continue
        cal = pay_calendar(tenant, ps.get("calendar"))
        if not cal:
            lines.append("- " + name + ": no pay calendar called \"" + str(ps.get("calendar")) + "\" in Xero Payroll")
            continue
        start = datetime.date.fromisoformat(cal["start"])
        end = datetime.date.fromisoformat(cal["end"])
        payment = datetime.date.fromisoformat(cal["payment"]) if cal["payment"] else end
        prep = pay_prep_date(payment, ps.get("prep_day"))
        h, m = pay_hm(ps.get("prep_time"), (9, 0))
        prep_at = datetime.datetime.combine(prep, datetime.time(h, m), tz_now.tzinfo)
        path = BK_PAYRUNS + "/" + slug + "-" + cal["start"] + ".json"
        run = bk_read_json(path)
        if run is None:
            if tz_now < prep_at and not only:
                continue
            period = cal["start"] + " to " + cal["end"]
            item = api.workq.create(
                title=("Pay run: " + name + ", " + period + ", pay day " + str(payment))[:200],
                scope="org",
                description=(
                    "**Pay run for " + name + "**: " + period + ", pay day **" + str(payment) + "** (" + str(cal["name"]) + ").\n\n"
                    "Hours: " + SOURCE_WORDS.get(ps.get("timesheets") or "none", "") + ".\n\n"
                    "1. Make sure new starters and changes (rates, promotions, terminations) are in Xero Payroll.\n"
                    "2. Wait for the timesheets" + (" from " + ps["ts_owner"] if ps.get("ts_owner") else "") + ". I'll say when they're in Xero.\n"
                    "3. Choose **Run the checks** on the Pay run form below. The check compares the hours, rates, penalties, "
                    "leave and reimbursements, lists what to fix and drafts one query email.\n"
                    "4. Fix what it lists in Xero Payroll and run the checks again until they're clear.\n"
                    "5. Choose **Ready for review** to send the review pack to " + (ps.get("reviewer_name") or "the reviewer") + ".\n\n"
                    "The pay guide and this period's reimbursement file go in `" + BK_PAYROLL_FILES + "/" + slug + "` in Knowledge."
                ),
                priority="high",
                due_date=str(payment),
                assignee_ids=[ps["officer_id"]] if ps.get("officer_id") else None,
                labels=["bookkeeping", "payroll", slug],
            )
            api.workq.attach_form(todo_id=item["id"], form_id=params["payrun_form"])
            run = {"slug": slug, "name": name, "tenant_id": tenant, "calendar": cal, "period_start": cal["start"],
                   "period_end": cal["end"], "payment_date": str(payment), "prep_date": str(prep), "item_id": item["id"],
                   "status": "open", "ts_ready": False, "chased": False, "checks": [], "notes": [],
                   "created_at": bk_now_iso(settings)}
            bk_write_json(path, run)
            pay_link(item["id"], run)
            opened += 1
            lines.append("- " + name + ": pay run opened for " + period)
        if run.get("status") in ("done", "cancelled") or run.get("ts_ready") or ps.get("timesheets") == "none":
            continue
        count = len(pay_timesheets(tenant, start, end))
        if count:
            run["ts_ready"] = True
            api.workq.comment(todo_id=run["item_id"], body=("Timesheets are in Xero Payroll (" + str(count) + "). Choose "
                                                            "**Run the checks** on the Pay run form."))
            bk_write_json(path, run)
            lines.append("- " + name + ": timesheets are in Xero")
        elif (ps.get("timesheets") == "deputy" and not run.get("chased") and ps.get("ts_email")
              and tz_now >= prep_at + datetime.timedelta(minutes=int(ps.get("chase_after_minutes") or 60))):
            email = api.ai.generate(prompt=CHASE_PROMPT, input=json.dumps({
                "to": ps.get("ts_owner") or "the timesheet owner", "business": name,
                "pay_period": cal["start"] + " to " + cal["end"], "pay_day": str(payment)}))
            api.workq.comment(todo_id=run["item_id"], body=(
                "The timesheets aren't in Xero Payroll yet. **Draft follow-up to " + (ps.get("ts_owner") or "the client")
                + " (" + ps["ts_email"] + ")** for you to send:\n\n" + str(email)))
            run["chased"] = True
            bk_write_json(path, run)
            chased += 1
            lines.append("- " + name + ": timesheets are late, chase drafted")
    except Exception as exc:
        lines.append("- " + name + ": " + str(exc)[:200])

summary = ("Opened " + str(opened) + " pay run(s), drafted " + str(chased) + " chase(s)."
           + ("\n\n" + "\n".join(lines) if lines else ""))
