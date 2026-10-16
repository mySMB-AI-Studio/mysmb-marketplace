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
