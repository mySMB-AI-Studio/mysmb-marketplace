responses = params.get("responses") or {}
todo_id = params.get("todo_id") or ""
form_id = params.get("form_id") or ""
actor = params.get("actor") or ""
only = []
should_check = True
summary = ""

if form_id:
    # A Check findings form: apply it, then (unless asked to check again) stop here.
    should_check = False
    slug = (bk_read_json(BK_CHECKS + "/_items.json") or {}).get(todo_id) or ""
    state = bk_read_json(BK_CHECKS + "/" + slug + ".json") if slug else None
    settings = bk_read_json(BK_SETTINGS) or {}
    client = bk_client_for(settings, slug) if slug else None
    if form_id != params["findings_form"] or not responses:
        summary = "ignored"
    elif not state or not client:
        summary = "No ledger checks findings belong to this item."
    else:
        today = bk_today(settings)
        action = str(bk_answer(responses, "q_action") or "").lower()
        refs = str(bk_answer(responses, "q_refs") or "")
        note = str(bk_answer(responses, "q_note") or "").strip()
        until = str(bk_answer(responses, "q_until") or "")[:10]
        findings = state.setdefault("findings", {})
        wanted = {r.upper() for r in re.findall(r"\b[0-9A-Fa-f]{6}\b", refs)}
        # Lines ticked on the item count too.
        item = ck_find_item(state, client)
        ticked = ck_ticked((item or {}).get("description")) if ck_item_open(item) else set()
        picked = [k for k, f in findings.items() if f.get("status") == "open"
                  and (refs.strip().lower() == "all" or ck_ref(k) in wanted)]
        done = []
        for k, f in findings.items():
            if f.get("status") == "open" and ck_ref(k) in ticked and k not in picked:
                state.setdefault("dismissed", {})[k] = {"fp": f["fp"], "on": str(today), "by": "ticked on the item"}
                f["status"] = "dismissed"
                done.append("ticked: " + f["check"] + " (ref " + ck_ref(k) + ")")
        if action.startswith("not"):
            for k in picked:
                state.setdefault("dismissed", {})[k] = {"fp": findings[k]["fp"], "on": str(today), "by": actor, "note": note}
                findings[k]["status"] = "dismissed"
                done.append("not an issue: " + findings[k]["check"] + " (ref " + ck_ref(k) + ")")
        elif action.startswith("snooze"):
            if until <= str(today):
                done.append("nothing snoozed: the snooze date has to be after today")
            else:
                for k in picked:
                    state.setdefault("snoozed", {})[k] = {"until": until, "on": str(today), "by": actor, "note": note}
                    findings[k]["status"] = "snoozed"
                    done.append("snoozed until " + until + ": " + findings[k]["check"] + " (ref " + ck_ref(k) + ")")
        else:
            should_check = True
            only = [slug]
        if not picked and not action.startswith("nothing"):
            done.append("no open finding matched " + (refs.strip() or "the refs given"))
        body = ("Check findings form applied:\n" + "\n".join("- " + d for d in done) if done else "Check findings form received.")
        if note:
            body += "\n\nNote: " + note
        # A submitted form can't be filled in again on the same item, so the checklist moves to a fresh item.
        if item and ck_item_open(item):
            api.workq.comment(todo_id=item["id"], body=body + ("\n\nThe checklist continues in a new item, so the form can "
                                                               "be used again." if ck_open(state) else ""))
            api.workq.complete(todo_id=item["id"])
        state["todo_id"] = ""
        state["listed"] = []
        if ck_open(state):
            ck_new_item(client, settings, state, params["findings_form"], note="Continues the previous Checks item.\n\n" + body)
        bk_write_json(BK_CHECKS + "/" + slug + ".json", state)
        summary = "; ".join(done) or "applied"
elif params.get("client_name"):
    only = [bk_slug(params.get("client_name"))]
