import time

started = time.monotonic()
# Stop starting new clients after this long, so a run stays inside the 20-minute limit; the next run carries on.
BUDGET_SECONDS = 13 * 60
WEEKLY_START_SECONDS = 8 * 60
only = params.get("only") or []
settings = bk_read_json(BK_SETTINGS)
summary = {"checked": [], "errors": [], "left": 0, "report_due": False}
problem = ""

if not settings:
    problem = "Bookkeeping isn't set up yet. Run **Bookkeeping: Start setup** and submit the Bookkeeping setup form."
else:
    today = bk_today(settings)
    clients = []
    known = []

    def _same(a, b):
        # "Irvine Jackson Pty Ltd", "irvine-jackson-pty-ltd" and "Irvine Jackson" are the same client.
        return bool(a) and bk_norm(str(a).replace("-", " ")) == bk_norm(str(b or "").replace("-", " "))

    for f in api.files.list(path=BK_CLIENTS):
        c = bk_read_json(f["path"]) if str(f.get("name") or "").endswith(".json") else None
        if c and c.get("xero_tenant_id") and c.get("checks_enabled", True) is not False:
            known.append(str(c.get("name") or c.get("slug") or ""))
            if not only or any(_same(o, c.get(k)) for o in only for k in ("slug", "name", "xero_org_name")):
                clients.append(c)
    if not known:
        problem = ("No client business has ledger checks on (none in " + BK_CLIENTS + " with a Xero organisation and ledger "
                   "checks on). To add one, run **Bookkeeping: Start setup** with the business name and submit its Client bookkeeping "
                   "settings form.")
    elif only and not clients:
        problem = ("No client with ledger checks turned on matches \"" + ", ".join(only) + "\". Use the business name from its "
                   "Client bookkeeping settings" + (": " + ", ".join(sorted(known)) if known else "") + ".")
    secret = ck_secret()
    key_id = hashlib.sha256(secret.encode("utf-8")).hexdigest()[:8]
    for client in clients:
        path = BK_CHECKS + "/" + client["slug"] + ".json"
        state = bk_read_json(path) or {"version": 1, "slug": client["slug"]}
        if not only and state.get("last_daily") == str(today):
            continue
        last_weekly = ck_day(state.get("last_weekly"))
        weekly = bool(only) or not last_weekly or (today - last_weekly).days >= 7
        # A weekly check reads a lot more of the file, so it only starts with plenty of the budget left.
        if time.monotonic() - started > (WEEKLY_START_SECONDS if weekly else BUDGET_SECONDS):
            summary["left"] += 1
            continue
        exc = None
        try:
            since = (min(ck_fy_start(today), today - datetime.timedelta(days=90)) if weekly
                     else today - datetime.timedelta(days=CK_DAILY_DAYS))
            ledger = xero_ledger(client["xero_tenant_id"], today, since, weekly)
            snap = state.setdefault("snapshot", {})
            if snap.get("key_id") != key_id:
                # A new key: start the bank fingerprints again rather than report every account as changed.
                snap["banks"] = {}
                snap["key_id"] = key_id
                snap["seeded"] = False
            intake = bk_read_json(BK_CHECKS + "/" + client["slug"] + "-intake.json") or {}
            register = bk_read_json(BK_CHECKS + "/" + client["slug"] + "-abr.json") if weekly else None
            found, evaluated = ck_run(ledger, client, snap, today, secret, intake.get("captured"), register, intake.get("abns"))
            item = ck_find_item(state, client)
            ticked = ck_ticked((item or {}).get("description")) if ck_item_open(item) else set()
            new, resolved = ck_reconcile(state, found, evaluated, ticked, today)
            state["last_daily"] = str(today)
            if weekly:
                state["last_weekly"] = str(today)
            state["truncated"] = ledger.get("truncated") or []
            what = ck_sync_item(client, settings, state, item, new, resolved, params["findings_form"])
            bk_write_json(path, state)
            summary["checked"].append({"client": client["name"], "weekly": weekly, "open": len(ck_open(state)),
                                       "new": len(new), "resolved": len(resolved), "item": what})
        except Exception as exc:
            summary["errors"].append(str(client.get("name")) + ": " + str(exc)[:300])
    # The weekly Data Quality report goes out once every client is checked and a week has passed since the last one.
    last = ck_day((bk_read_json(BK_CHECKS + "/_report.json") or {}).get("on"))
    summary["report_due"] = bool(not only and not summary["left"] and clients and (not last or (today - last).days >= 7))
