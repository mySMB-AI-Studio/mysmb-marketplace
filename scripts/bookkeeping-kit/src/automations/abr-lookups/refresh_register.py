import time

started = time.monotonic()
# Stay well inside the 20-minute run limit; the next run carries on with whatever is left.
BUDGET_SECONDS = 13 * 60
settings = bk_read_json(BK_SETTINGS)
wanted = bk_slug(params.get("client_name")) if params.get("client_name") else ""
summary = {"clients": [], "looked_up": 0, "searched": 0, "left": 0, "errors": []}
problem = ""

if not settings:
    problem = "Bookkeeping isn't set up yet. Run **Bookkeeping: Start setup** and submit the Bookkeeping setup form."
else:
    today = bk_today(settings)
    for f in api.files.list(path=BK_CLIENTS):
        client = bk_read_json(f["path"]) if str(f.get("name") or "").endswith(".json") else None
        # Only the clients of this pack's ledger (Xero when the node has no ledger param).
        if not client or not client.get(bk_ledger_info(params.get("ledger"))[1]) or client.get("checks_enabled", True) is False:
            continue
        slug = client.get("slug") or ""
        if wanted and wanted != slug and wanted != bk_slug(client.get("name")):
            continue
        state = bk_read_json(BK_CHECKS + "/" + slug + ".json") or {}
        register = (state.get("snapshot") or {}).get("register") or {}
        intake = bk_read_json(BK_CHECKS + "/" + slug + "-intake.json") or {}
        # Every ABN the checks need: the client's contacts (saved by Ledger checks) and those read off bill PDFs.
        abns = set(register.get("abns") or [])
        for seen in (intake.get("abns") or {}).values():
            abns.update(a for a in seen or [] if len(a) == 11)
        path = BK_CHECKS + "/" + slug + "-abr.json"
        cache = bk_read_json(path) or {}
        rows = cache.setdefault("abns", {})
        names = cache.setdefault("names", {})
        test_path, test_rows = abr_test_register(client, bk_ledger_info(params.get("ledger"))[3])
        if test_path:
            # A test company: its answers come from its test register file, never from the register.
            cache["abns"] = {a: dict(test_rows[a], checked=str(today)) for a in sorted(abns) if a in test_rows}
            cache["names"] = {}
            cache["test_register"] = test_path
            cache["refreshed"] = str(today)
            bk_write_json(path, cache)
            summary["clients"].append({"client": client.get("name"), "abns": len(abns), "looked_up": 0,
                                       "test_register": test_path, "from_test_register": len(cache["abns"])})
            continue
        if cache.pop("test_register", None):
            # Back to the real register: forget every answer the test file gave.
            rows.clear()
            names.clear()
        stale = sorted(a for a in abns if not rows.get(a)
                       or (today - (ck_day(rows[a].get("checked")) or today - datetime.timedelta(days=999))).days >= ABR_RECHECK_DAYS)
        done = 0
        failed = False
        exc = None
        try:
            for i in range(0, len(stale), 100):
                if time.monotonic() - started > BUDGET_SECONDS:
                    summary["left"] += len(stale) - i
                    break
                for abn, row in abr_lookup(stale[i:i + 100]).items():
                    row["checked"] = str(today)
                    rows[abn] = row
                    done += 1
            searches = 0
            for name in register.get("no_abn") or []:
                key = bk_norm(name)
                last = ck_day((names.get(key) or {}).get("checked"))
                same_rule = (names.get(key) or {}).get("rule") == ABR_MATCH_RULE
                if not key or (last and same_rule and (today - last).days < ABR_SEARCH_DAYS):
                    continue
                if searches >= ABR_SEARCHES_PER_RUN or time.monotonic() - started > BUDGET_SECONDS:
                    break
                names[key] = {"name": name, "checked": str(today), "match": abr_best_match(name), "rule": ABR_MATCH_RULE}
                searches += 1
            summary["searched"] += searches
        except Exception as exc:
            failed = True
            summary["errors"].append(str(client.get("name")) + ": " + str(exc)[:300])
        # Forget ABNs and names the client no longer needs, so the file doesn't grow for ever.
        for abn in list(rows):
            if abn not in abns:
                rows.pop(abn)
        current = {bk_norm(n) for n in register.get("no_abn") or []}
        for key in list(names):
            if key not in current:
                names.pop(key)
        # "Fresh" only when this run reached the register (or had nothing to look up): Ledger checks stops trusting
        # the file a fortnight after the last good run.
        if not failed and (done or not stale):
            cache["refreshed"] = str(today)
        bk_write_json(path, cache)
        summary["looked_up"] += done
        summary["clients"].append({"client": client.get("name"), "abns": len(abns), "looked_up": done})
    if wanted and not summary["clients"]:
        problem = "No client with ledger checks turned on matches \"" + str(params.get("client_name")) + "\"."
