responses = params.get("responses") or {}
todo_id = params.get("todo_id") or ""
form_id = params.get("form_id") or ""
actor = params.get("actor") or ""
ledger = str(params.get("ledger") or "")
where, id_key, file_word, name_key = bk_ledger_info(ledger)
outcome = "ignored"


def _note(body, done=True):
    if not todo_id:
        return
    api.workq.comment(todo_id=todo_id, body=body)
    if done:
        api.workq.complete(todo_id=todo_id)


if not responses:
    # No answers: the Publish practice run sends a sample event with an empty payload.
    outcome = "ignored"
elif form_id == params["setup_form"]:
    # Merged into what Bookkeeping for Xero may have saved already: only the checks' own answers change.
    settings = bk_read_json(BK_SETTINGS) or {"version": 1, "mode": "practice"}
    owner = bk_answer(responses, "q_checks_owner")
    settings["timezone"] = str(bk_answer(responses, "q_timezone") or "").strip() or settings.get("timezone") or "Australia/Sydney"
    settings["checks_owner_id"] = bk_lookup_id(owner)
    settings["checks_owner_name"] = bk_lookup_label(owner)
    settings["updated_by"] = actor
    settings["updated_at"] = bk_now_iso(settings)
    bk_write_json(BK_SETTINGS, settings)
    outcome = "settings_saved"
    _note(
        "Bookkeeping checks settings saved to `" + BK_SETTINGS + "` (findings go to " + (settings["checks_owner_name"] or "nobody yet") + ").\n\n"
        "**Next steps**\n\n"
        "1. Publish *Ledger checks (" + where + ")*" + (" and, if the ABR Lookup extension is installed, *Register lookups (ABR, MYOB)*"
                                                       if ledger == "myob" else "") + ".\n"
        "2. Run **Bookkeeping: Start checks setup (" + where + ")** again with your client business names (one per line), and fill in "
        "each client's settings form."
    )
elif form_id == params["client_form"]:
    settings = bk_read_json(BK_SETTINGS) or {}
    name = str(bk_answer(responses, "q_client_name") or "").strip()
    asked = str(bk_answer(responses, "q_file") or "").strip()
    slug = bk_slug(name)
    path = BK_CLIENTS + "/" + slug + ".json"
    existing = bk_read_json(path) or {}
    other = str(existing.get("ledger") or ("xero" if existing.get("xero_tenant_id") else ""))
    if other and other != ledger:
        outcome = "other_ledger"
        _note("**" + (name or slug) + "** is already set up as a " + bk_ledger_info(other)[0] + " client (`" + path + "`). A business is "
              "checked in one ledger: use another name for it here, or, if it has moved to " + where + ", delete that file and "
              "submit this form again.", done=False)
    else:
        match, available = bk_find_file(asked)
        if not match and ledger == "quickbooks":
            outcome = "file_not_found"
            _note("The QuickBooks connection of this automation's owner reaches **" + (", ".join(available) or "no company") + "**, not **"
                  + asked + "**. A QuickBooks connection reaches one company: connect QuickBooks to this business's company (or "
                  "correct the name), then run **Bookkeeping: Start checks setup (QuickBooks)** again for it.", done=False)
        elif not match:
            outcome = "file_not_found"
            _note("I couldn't find a " + file_word + " called **" + asked + "** in the " + where + " connection of this automation's "
                  "owner.\n\nAvailable: " + (", ".join(available) or "none") + ".\n\nRun **Bookkeeping: Start checks setup (" + where
                  + ")** again for " + (name or "this business") + " and enter the name exactly as it appears in " + where + ".", done=False)
        else:
            client = dict(existing)
            client.update({
                "version": 1,
                "slug": slug,
                "name": name,
                "ledger": ledger,
                id_key: match["id"],
                name_key: match["name"],
                "gst_registered": bool(bk_answer(responses, "q_gst")),
                # Ledger checks: on unless the form says No.
                "checks_enabled": not str(bk_answer(responses, "q_checks") or "").lower().startswith("no"),
                "checks_owner_id": bk_lookup_id(bk_answer(responses, "q_checks_owner")),
                "checks_owner_name": bk_lookup_label(bk_answer(responses, "q_checks_owner")),
                "tpar": bool(bk_answer(responses, "q_tpar")),
                "suspense_codes": [c.strip() for c in re.split(r"[,;\s]+", str(bk_answer(responses, "q_suspense") or "")) if c.strip()],
                "updated_by": actor,
                "updated_at": bk_now_iso(settings),
            })
            bk_write_json(path, client)
            outcome = "client_saved"
            _note("Saved checks settings for **" + name + "** (" + where + ": " + match["name"] + "). The overnight *Ledger checks ("
                  + where + ")* start on it; run it by hand with the business name to check it now. Settings file: `" + path + "`.")
