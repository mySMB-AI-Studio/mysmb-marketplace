responses = params.get("responses") or {}
todo_id = params.get("todo_id") or ""
form_id = params.get("form_id") or ""
actor = params.get("actor") or ""
outcome = "ignored"


def _note(body, done=True):
    if not todo_id:
        return
    api.workq.comment(todo_id=todo_id, body=body)
    if done:
        api.workq.complete(todo_id=todo_id)


def _same_name(a, b):
    return bool(a and b) and (a == b or (len(a) > 3 and len(b) > 3 and (a in b or b in a)))


def _client_from_org(tenant_id, org_name, settings):
    """A Xero organisation the connection can see, set up as a client with the practice's defaults (the reviewer from
    Bookkeeping setup, GST registered, no client-approval limit, ledger checks off until its settings are filled in).
    Returns (client, created)."""
    for c in route_clients():
        if c.get("xero_tenant_id") == tenant_id:
            return c, False
    slug = bk_slug(org_name)
    if bk_read_json(BK_CLIENTS + "/" + slug + ".json"):
        slug = bk_slug(org_name + " " + str(tenant_id)[:4])
    ident = xero_org_identity(tenant_id)
    client = {
        "version": 1, "slug": slug, "name": org_name, "xero_tenant_id": tenant_id, "xero_org_name": org_name,
        "abn": ident.get("abn") or "", "org_names": ident.get("names") or [], "aliases": [], "mail_folder": "",
        "gst_registered": True, "reviewer_id": None, "reviewer_name": "", "client_approval_above": None,
        "contact_name": "", "contact_email": "", "notes": "", "checks_enabled": False,
        "set_up_from": "a Which client is this for? item", "updated_by": actor, "updated_at": bk_now_iso(settings),
    }
    bk_write_json(BK_CLIENTS + "/" + slug + ".json", client)
    if bk_read_json(BK_RULES + "/" + slug + ".json") is None:
        bk_write_json(BK_RULES + "/" + slug + ".json", {"suppliers": {}})
    api.files.put(file=BK_INBOX + "/" + slug + "/_README.txt",
                  content="Drop supplier bill PDFs for " + org_name + " into this folder. Each PDF becomes a draft bill in "
                  "Xero (" + org_name + ") and a review item in WorkQ.\n")
    return client, True


if not responses:
    # No answers: the Publish practice run sends a sample event with an empty payload.
    outcome = "ignored"
elif form_id == params["setup_form"]:
    previous = bk_read_json(BK_SETTINGS) or {}
    mode_answer = str(bk_answer(responses, "q_mode") or "")
    reviewer = bk_answer(responses, "q_reviewer")
    exceptions = bk_answer(responses, "q_exceptions")
    digest = bk_answer(responses, "q_digest")
    approved = str(bk_answer(responses, "q_approved_status") or "")
    settings = {
        "version": 1,
        "ledger": "xero",
        "mode": "practice" if mode_answer.lower().startswith("practice") else "in-house",
        "timezone": (str(bk_answer(responses, "q_timezone") or "").strip() or previous.get("timezone") or "Australia/Sydney"),
        "reviewer_id": bk_lookup_id(reviewer),
        "reviewer_name": bk_lookup_label(reviewer),
        "exceptions_owner_id": bk_lookup_id(exceptions) or bk_lookup_id(reviewer),
        "digest_recipient_ids": [x for x in [bk_lookup_id(digest) or bk_lookup_id(reviewer)] if x],
        "checks_owner_id": bk_lookup_id(bk_answer(responses, "q_checks_owner")),
        "checks_owner_name": bk_lookup_label(bk_answer(responses, "q_checks_owner")),
        "approved_status": "AUTHORISED" if approved.lower().startswith("approved") else "SUBMITTED",
        "auto_approve_below": bk_money(bk_answer(responses, "q_auto_below")) or 0,
        "client_approval_above": bk_money(bk_answer(responses, "q_client_above")),
        "client_channel": "email",
        "intake": {
            "outlook": str(bk_answer(responses, "q_outlook") or "").strip(),
            "gmail": str(bk_answer(responses, "q_gmail") or "").strip(),
            "folders": [f.strip().strip("/") for f in str(bk_answer(responses, "q_mail_folders") or "").splitlines()
                        if f.strip().strip("/")],
            "shared_mailbox": str(bk_answer(responses, "q_shared_mailbox") or "").strip(),
        },
        "updated_by": actor,
    }
    settings["updated_at"] = bk_now_iso(settings)
    bk_write_json(BK_SETTINGS, settings)
    outcome = "settings_saved"
    limit = settings["client_approval_above"]
    _note(
        "Bookkeeping settings saved to `" + BK_SETTINGS + "`.\n\n"
        "- Reviewer: " + (settings["reviewer_name"] or "not set") + "\n"
        "- Reviewed bills go to Xero as **" + ("Approved" if settings["approved_status"] == "AUTHORISED" else "Awaiting approval") + "**\n"
        "- Skip review below: " + (bk_fmt(settings["auto_approve_below"]) if settings["auto_approve_below"] else "never (always review)") + "\n"
        "- Client approval above: " + (bk_fmt(limit) if limit else "never") + "\n\n"
        "**Next steps**\n\n"
        "1. Publish these automation drafts: *Process bill (Xero)*, *File split documents*, *Apply bill review (Xero)*, *Weekly AP digest (Xero)*, *Ledger checks (Xero)*, and *Email intake (Outlook)*, *Email intake (Outlook shared mailbox)* or *Email intake (Gmail)* for the mailbox that receives bills.\n"
        "2. Run **Bookkeeping: Start setup** again with your client business names (one per line), and fill in each client's settings form.\n"
        "3. Drop a supplier bill PDF into `" + BK_INBOX + "/<client>` in Knowledge to try it."
    )

# >>> payroll
elif form_id == params["payroll_form"]:
    settings = bk_read_json(BK_SETTINGS) or {}
    name = str(bk_answer(responses, "q_client_name") or "").strip()
    slug = bk_slug(name)
    client = bk_client_for(settings, slug)
    if not client:
        outcome = "payroll_client_missing"
        _note("There are no bookkeeping settings for **" + (name or "this business") + "** yet. Run **Bookkeeping: Start setup** "
              "with its name, submit its Client bookkeeping settings form, then submit this form again.", done=False)
    else:
        source = str(bk_answer(responses, "q_timesheets") or "").lower()
        officer = bk_answer(responses, "q_officer")
        reviewer = bk_answer(responses, "q_reviewer")
        payroll = {
            "version": 1,
            "slug": slug,
            "name": client.get("name") or name,
            "calendar": str(bk_answer(responses, "q_calendar") or "").strip(),
            "prep_day": str(bk_answer(responses, "q_prep_day") or "Monday"),
            "prep_time": str(bk_answer(responses, "q_prep_time") or "").strip() or "09:00",
            "states": [s.strip().upper() for s in re.split(r"[,;/ ]+", str(bk_answer(responses, "q_states") or "")) if s.strip()],
            "timesheets": ("deputy" if source.startswith("deputy") else "xero" if "xero" in source
                           else "emailed" if source.startswith("emailed") else "none"),
            "ts_owner": str(bk_answer(responses, "q_ts_owner") or "").strip(),
            "ts_email": str(bk_answer(responses, "q_ts_email") or "").strip(),
            "chase_after_minutes": int(bk_money(bk_answer(responses, "q_chase_after")) or 60),
            "officer_id": bk_lookup_id(officer),
            "officer_name": bk_lookup_label(officer),
            "reviewer_id": bk_lookup_id(reviewer),
            "reviewer_name": bk_lookup_label(reviewer),
            "approvers": str(bk_answer(responses, "q_approvers") or "").strip(),
            "who_posts": "practice" if str(bk_answer(responses, "q_who_posts") or "").lower().startswith("our") else "client",
            "notes": str(bk_answer(responses, "q_notes") or "").strip(),
            "updated_by": actor,
            "updated_at": bk_now_iso(settings),
        }
        bk_write_json(BK_PAYROLL + "/" + slug + ".json", payroll)
        folder = BK_PAYROLL_FILES + "/" + slug
        guide = folder + "/pay-guide.xlsx"
        # Never overwrite a pay guide the officer has filled in.
        if not any(f.get("path") == guide for f in api.files.list(path=folder)):
            pay_guide_template(guide, payroll["name"])
        outcome = "payroll_saved"
        _note(
            "Saved payroll settings for **" + payroll["name"] + "** (pay calendar *" + payroll["calendar"] + "*, prepared on "
            + payroll["prep_day"] + "s from " + payroll["prep_time"] + ").\n\n**Next steps**\n\n"
            "1. Fill in the pay guide `" + guide + "` in Knowledge: the award rates by classification, employment type, age "
            "and band, the penalty rules, each employee's award and classification, special arrangements, public holidays "
            "and how your Xero pay items map to the bands. Replace the EXAMPLE rows.\n"
            "2. Drop each period's reimbursement file (a spreadsheet with *expense* or *reimburs* in its name) into `" + folder + "`.\n"
            "3. Publish *Start pay runs*, *Check pay run* (the Deputy version if the hours come from Deputy), *Build payroll "
            "review pack* and *Apply payroll review*. The pay run item opens on the preparation day."
        )

# <<< payroll
elif form_id == params["client_form"]:
    settings = bk_read_json(BK_SETTINGS) or {}
    name = str(bk_answer(responses, "q_client_name") or "").strip()
    org = str(bk_answer(responses, "q_xero_org") or "").strip()
    slug = bk_slug(name)
    connections = xero_connections()
    match = None
    for c in connections:
        if bk_norm(c.get("tenantName")) == bk_norm(org):
            match = c
            break
    if not match:
        for c in connections:
            if bk_norm(org) and bk_norm(org) in bk_norm(c.get("tenantName")):
                match = c
                break
    if not match:
        outcome = "xero_org_not_found"
        available = ", ".join(sorted(str(c.get("tenantName")) for c in connections)) or "none"
        _note(
            "I couldn't find a Xero organisation called **" + org + "** in the Xero connection of this automation's owner.\n\n"
            "Organisations available: " + available + ".\n\n"
            "Run **Bookkeeping: Start setup** again for " + (name or "this business") + " and enter the name exactly as it appears in Xero. "
            "If the organisation is missing, the owner needs to reconnect Xero and tick it.",
            done=False,
        )
    else:
        reviewer = bk_answer(responses, "q_reviewer")
        # The organisation's own names and ABN, so emailed bills addressed to it can be matched to this client.
        ident = xero_org_identity(match.get("tenantId"))
        client = {
            "version": 1,
            "slug": slug,
            "name": name,
            "xero_tenant_id": match.get("tenantId"),
            "xero_org_name": match.get("tenantName"),
            "abn": ident.get("abn") or "",
            "org_names": ident.get("names") or [],
            "aliases": [a.strip() for a in str(bk_answer(responses, "q_aliases") or "").splitlines() if a.strip()],
            "mail_folder": str(bk_answer(responses, "q_mail_folder") or "").strip().strip("/"),
            "gst_registered": bool(bk_answer(responses, "q_gst")),
            "reviewer_id": bk_lookup_id(reviewer),
            "reviewer_name": bk_lookup_label(reviewer),
            "client_approval_above": bk_money(bk_answer(responses, "q_client_above")),
            "contact_name": str(bk_answer(responses, "q_contact_name") or "").strip(),
            "contact_email": str(bk_answer(responses, "q_contact_email") or "").strip(),
            "notes": str(bk_answer(responses, "q_notes") or "").strip(),
            # Ledger checks: on unless the form says No (clients saved before the question existed are checked too).
            "checks_enabled": not str(bk_answer(responses, "q_checks") or "").lower().startswith("no"),
            "checks_owner_id": bk_lookup_id(bk_answer(responses, "q_checks_owner")),
            "checks_owner_name": bk_lookup_label(bk_answer(responses, "q_checks_owner")),
            "tpar": bool(bk_answer(responses, "q_tpar")),
            "suspense_codes": [c.strip() for c in re.split(r"[,;\s]+", str(bk_answer(responses, "q_suspense") or "")) if c.strip()],
            "updated_by": actor,
            "updated_at": bk_now_iso(settings),
        }
        bk_write_json(BK_CLIENTS + "/" + slug + ".json", client)
        if bk_read_json(BK_RULES + "/" + slug + ".json") is None:
            bk_write_json(BK_RULES + "/" + slug + ".json", {"suppliers": {}})
        api.files.put(
            file=BK_INBOX + "/" + slug + "/_README.txt",
            content="Drop supplier bill PDFs for " + name + " into this folder. Each PDF becomes a draft bill in Xero ("
            + client["xero_org_name"] + ") and a review item in WorkQ.\n",
        )
        outcome = "client_saved"
        _note(
            "Saved settings for **" + name + "** (Xero: " + client["xero_org_name"] + ").\n\n"
            "Drop bill PDFs into `" + BK_INBOX + "/" + slug + "` in Knowledge. Settings file: `" + BK_CLIENTS + "/" + slug + ".json`."
        )

elif form_id == params["choice_form"]:
    # "Which client is this for?": Process bill parked a bill addressed to another business. File it under the client
    # chosen (its new file in that inbox folder starts Process bill again) and remember the name it was addressed to.
    settings = bk_read_json(BK_SETTINGS) or {}
    record = (bk_read_json(BK_BILLS + "/" + todo_id + ".json") or {}) if todo_id else {}
    if record.get("status") != "needs_client":
        outcome = "ignored"
        _note("This bill was already dealt with, so nothing was changed.", done=False)
    else:
        choice = str(bk_answer(responses, "q_choice") or "").lower()
        typed = str(bk_answer(responses, "q_client") or "").strip()
        needs = record.get("needs") or {}
        addressed = str(needs.get("addressed_to") or "").strip()
        file_path = str(record.get("file") or "")
        clients = route_clients()
        by_slug = {c["slug"]: c for c in clients}
        routing = bk_read_json(BK_ROUTING) or {}
        target = None
        created = False
        remember = False
        why_not = ""
        if choice.startswith("none"):
            record["status"] = "not_ours"
            outcome = "not_ours"
            _note("Left alone: nothing went to Xero. The PDF stays in `" + file_path + "` in Knowledge.")
        elif choice.startswith("the business"):
            if needs.get("kind") == "client":
                target = by_slug.get(str(needs.get("slug") or ""))
                why_not = "" if target else "the client " + str(needs.get("name")) + " isn't set up any more"
            elif needs.get("kind") == "org":
                exc = None  # the platform lint wants names bound before `except ... as`
                try:
                    target, created = _client_from_org(str(needs.get("tenant_id") or ""), str(needs.get("org_name") or addressed), settings)
                except Exception as exc:
                    why_not = "setting up " + str(needs.get("org_name")) + " failed (" + str(exc)[:200] + ")"
            else:
                why_not = (addressed + " isn't a client or a Xero organisation the connection can see, so it can't be "
                           "set up from here. Run **Bookkeeping: Start setup** with its name first, or choose another answer")
        elif choice.startswith("the client it was filed"):
            target = by_slug.get(str(record.get("client_slug") or ""))
            remember = True
            why_not = "" if target else "the client it was filed under isn't set up any more"
        elif choice.startswith("another"):
            key = bk_norm(typed)
            found = [c for c in clients if key and (c["slug"] == bk_slug(typed) or any(_same_name(n, key) for n in route_names(c, routing)))]
            if len(found) == 1:
                target = found[0]
                remember = True
            else:
                why_not = (("no client is called \"" + typed + "\"" if not found else "\"" + typed + "\" matches "
                            + ", ".join(str(c.get("name")) for c in found)) if typed else "no client name was given")
        else:
            why_not = "the form didn't say which client"

        if target:
            if remember and addressed and bk_norm(addressed):
                routing.setdefault("names", {})[addressed] = target["slug"]
                bk_write_json(BK_ROUTING, routing)
            name = file_path.split("/")[-1]
            dest = BK_INBOX + "/" + target["slug"] + "/" + name
            bk_note_origin(name, dict(record.get("origin") or {}, how="decided",
                                      why="chosen on a Which client is this for? item"))
            bk_move(file_path, dest)
            record["status"] = "filed"
            record["filed_to"] = target["slug"]
            outcome = "client_created" if created else "filed"
            body = ("Filed under **" + bk_client_label(target) + "**: `" + dest + "`. Process bill reads it now, and its "
                    "review item follows (or an item saying what went wrong).")
            if remember and addressed:
                body += "\n\nRemembered: bills addressed to **" + addressed + "** are for " + str(target.get("name")) + " from now on."
            if created:
                follow = api.workq.create(
                    title="Bookkeeping settings for " + str(target.get("name")),
                    scope="org",
                    description=bk_card(
                        "fill in the **Client bookkeeping settings** form on this item. Enter the Xero organisation name "
                        "exactly as **" + str(target.get("xero_org_name")) + "**.",
                        [("Client", bk_client_label(target)),
                         ("Set up from", "a Which client is this for? item, with the practice's defaults")],
                        body=("Until then it uses the practice's defaults: the reviewer from Bookkeeping setup, GST "
                              "registered, no client-approval limit, and no ledger checks.")),
                    priority="medium",
                    due_date=str(bk_add_business_days(bk_today(settings), 2)),
                    assignee_ids=[actor] if actor else None,
                    labels=["bookkeeping", "setup", target["slug"]],
                )
                api.workq.attach_form(todo_id=follow["id"], form_id=params["client_form"])
                body = ("Set up **" + str(target.get("name")) + "** as a client (Xero: " + str(target.get("xero_org_name"))
                        + ") with the practice's defaults; fill in its settings on the *Bookkeeping settings for "
                        + str(target.get("name")) + "* item.\n\n" + body)
            _note(body)
        elif outcome != "not_ours":
            # A form is answered once per item, so the question moves to a fresh item with the same details.
            outcome = "unclear"
            again = api.workq.create(
                title=("Which client is this bill for? " + str(record.get("supplier") or "")
                       + (" " + str(record.get("invoice_number")) if record.get("invoice_number") else ""))[:200],
                scope="org",
                description=bk_card(
                    "answer the **Which client is this for?** form again. The last answer couldn't be used: " + why_not + ".",
                    [("Addressed to", addressed),
                     ("Filed under", bk_client_label(by_slug.get(str(record.get("client_slug") or ""))) or str(record.get("client_slug") or "")),
                     ("Clients set up", ", ".join(sorted(str(c.get("name") or c["slug"]) for c in clients))),
                     ("Came from", bk_origin_line(record.get("origin") or {}, settings)),
                     ("File", "`" + file_path + "` in Knowledge")]),
                priority="high",
                due_date=str(bk_add_business_days(bk_today(settings), 1)),
                assignee_ids=[actor] if actor else None,
                labels=["bookkeeping", "bill-exception", "which-client", str(record.get("client_slug") or "")],
            )
            api.workq.attach_form(todo_id=again["id"], form_id=params["choice_form"])
            bk_write_json(BK_BILLS + "/" + again["id"] + ".json", dict(record))
            record["status"] = "asked_again"
            record["asked_again_in"] = again["id"]
            _note("That answer couldn't be used: " + why_not + ". The question is on a fresh item.")
        record.setdefault("history", []).append({"at": bk_now_iso(settings), "by": actor, "choice": choice,
                                                  "client": typed, "outcome": outcome})
        bk_write_json(BK_BILLS + "/" + todo_id + ".json", record)
