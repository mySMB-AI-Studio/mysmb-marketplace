problem = params.get("problem") or ""
ctx = params.get("ctx") or {}
settings = ctx.get("settings") or {}
client = ctx.get("client") or {}
proposal = params.get("proposal") or {}
warnings = params.get("warnings") or []
blocking = params.get("blocking") or []
bill_id = params.get("bill_id") or ""
path = params["path"]
folder = ctx.get("folder") or path.split("/")[1]
file_name = path.split("/")[-1]
today = bk_today(settings)
origin = params.get("origin") or {}
needs = params.get("needs_client") or {}
outcome = ""
todo_id = ""

if problem:
    dest = BK_FAILED + "/" + folder + "/" + file_name
    try:
        bk_move(path, dest)
    except Exception:
        dest = path
    owner = bk_exceptions_owner(settings, client)
    item = api.workq.create(
        title=("Bill needs attention: " + file_name + (" (" + client["name"] + ")" if client.get("name") else ""))[:200],
        scope="org",
        description=bk_card(
            "fix what's below, then move the PDF back into `" + BK_INBOX + "/" + folder + "` in Knowledge to process it "
            "again, or key the bill into Xero by hand. Then complete this item.",
            [("What went wrong", problem),
             ("Client", bk_client_label(client) if client.get("name") else "not set up (folder `" + folder + "`)"),
             ("Came from", bk_origin_line(origin, settings)),
             ("File", "`" + dest + "` in Knowledge")]),
        priority="high",
        due_date=str(bk_add_business_days(today, 1)),
        assignee_ids=[owner] if owner else None,
        labels=["bookkeeping", "bill-exception", folder],
    )
    todo_id = item["id"]
    outcome = "exception"
elif needs:
    # Addressed to another business: park the PDF and ask which client it's for (Apply setup acts on the answer).
    dest = BK_FAILED + "/" + folder + "/" + file_name
    try:
        bk_move(path, dest)
    except Exception:
        dest = path
    c = proposal.get("contact") or {}
    addressed = str(needs.get("addressed_to") or "another business")
    here = str(client.get("name") or folder)
    what = ((c.get("name") or "a supplier") + (" " + proposal["invoice_number"] if proposal.get("invoice_number") else "")
            + (", " + bk_fmt(proposal.get("total"), proposal.get("currency") or "") if proposal.get("total") is not None else ""))
    if needs.get("kind") == "client":
        title = "Is this bill for " + str(needs.get("name")) + "? " + what
        first = ("**" + addressed + "** looks like your client **" + str(needs.get("name")) + "**"
                 + (" (Xero: " + str(needs["org_name"]) + ")" if needs.get("org_name") else "") + ".")
        option_one = "it's processed for " + str(needs.get("name")) + " instead, in its own Xero"
    elif needs.get("kind") == "org":
        title = "Bill for " + str(needs.get("org_name")) + ", which isn't set up in Bookkeeping: " + what
        same = bk_norm(addressed) == bk_norm(needs.get("org_name"))
        first = ("**" + addressed + "** is one of the Xero organisations your Xero connection can see"
                 + ("" if same else " (**" + str(needs.get("org_name")) + "**)") + ", but it isn't set up as a client in "
                 "Bookkeeping.")
        option_one = ("**" + str(needs.get("org_name")) + "** is set up as a client (with the practice's reviewer; you get "
                      "an item to fill in the rest of its settings) and the bill is processed in its Xero")
    else:
        title = "Which client is this bill for? " + what
        first = ("**" + addressed + "** isn't a client or a Xero organisation your connection can see. It was filed under "
                 + here + " only because " + here + " is the only client set up.")
        option_one = ("not available for this one: set the business up first with **Bookkeeping: Start setup**, then "
                      "choose *Another client* and give its name")
    new_supplier = ""
    if c.get("is_new"):
        new_supplier = ("The supplier **" + str(c.get("name")) + "** isn't in " + here + "'s Xero yet: choosing " + here
                        + " creates it there when the bill is approved.")
    owner = bk_exceptions_owner(settings, client)
    item = api.workq.create(
        title=re.sub(r"\s+", " ", title)[:200],
        scope="org",
        description=bk_card(
            "say which client this bill is for on the **Which client is this for?** form. Nothing has gone to Xero yet.",
            [("Bill", what + (", dated " + proposal["date"] if proposal.get("date") else "")),
             ("Addressed to", addressed),
             ("Filed under", bk_client_label(client) if client.get("name") else folder),
             ("Came from", bk_origin_line(origin, settings)),
             ("File", "`" + dest + "` in Knowledge")],
            body=first + ("\n\n" + new_supplier if new_supplier else ""),
            answers=[("The business it's addressed to", option_one),
                     ("The client it was filed under", "it's processed for " + here + " as normal, and bills addressed to "
                      "**" + addressed + "** go to " + here + " from now on"),
                     ("Another client", "name the client in the form; it's processed there, and bills addressed to **"
                      + addressed + "** go to that client from now on"),
                     ("None of our clients", "nothing goes to Xero and the PDF stays in `" + BK_FAILED + "/" + folder + "`")]),
        priority="high",
        due_date=str(bk_add_business_days(today, 1)),
        assignee_ids=[owner] if owner else None,
        labels=["bookkeeping", "bill-exception", "which-client", folder],
    )
    api.workq.attach_form(todo_id=item["id"], form_id=params["client_choice_form"])
    bk_write_json(BK_BILLS + "/" + item["id"] + ".json", {
        "status": "needs_client", "client_slug": client.get("slug") or folder, "file": dest, "needs": needs,
        "origin": origin, "supplier": c.get("name") or "", "invoice_number": proposal.get("invoice_number") or "",
        "total": proposal.get("total"), "created_at": bk_now_iso(settings)})
    todo_id = item["id"]
    outcome = "needs_client"
else:
    tenant = client["xero_tenant_id"]
    dest = BK_PROCESSED + "/" + client["slug"] + "/" + file_name
    bk_move(path, dest)
    total = proposal.get("total")
    auto_below = bk_money(settings.get("auto_approve_below")) or 0
    status = settings.get("approved_status") or "SUBMITTED"
    record = {
        "client_slug": client["slug"],
        "tenant_id": tenant,
        "bill_id": bill_id,
        "proposal": proposal,
        "warnings": warnings,
        "blocking": blocking,
        "confidence": params.get("confidence") or "low",
        "file": dest,
        "attach_error": params.get("attach_error") or "",
        "origin": origin,
        "created_at": bk_now_iso(settings),
        "history": [],
    }
    sales = proposal.get("doc_type") == "ACCREC"
    # The checks catalogue IDs raised at intake, so the findings reports can count them.
    record["checks"] = sorted(set(re.findall(r"\[(CHK-\d{3})\]", " ".join(warnings))))
    # What later intake checks compare against: files seen (CHK-130), ABNs per supplier (CHK-090), and the sales
    # invoices captured here, which Ledger checks mustn't flag as "not sent" (CHK-024).
    seen = proposal.get("intake") or {}
    index_path = BK_CHECKS + "/" + client["slug"] + "-intake.json"
    index = bk_read_json(index_path) or {}
    files = index.get("files") or {}
    if seen.get("file_hash"):
        files[seen["file_hash"]] = {"date": str(today), "number": proposal.get("invoice_number") or ""}
    abns = index.get("abns") or {}
    if seen.get("abn") and seen.get("contact_key"):
        known = abns.get(seen["contact_key"]) or []
        abns[seen["contact_key"]] = (known + [seen["abn"]] if seen["abn"] not in known else known)[-5:]
    captured = index.get("captured") or []
    if sales and bill_id:
        captured = (captured + [bill_id])[-2000:]
    keep = sorted(files.items(), key=lambda kv: kv[1].get("date") or "")[-3000:]
    bk_write_json(index_path, {"files": dict(keep), "abns": abns, "captured": captured})
    can_skip = (bill_id and not sales and not blocking and not warnings and record["confidence"] == "high"
                and auto_below > 0 and total is not None and total < auto_below
                and not (proposal.get("contact") or {}).get("is_new"))
    if can_skip:
        xero_set_status(tenant, bill_id, status)
        record["status"] = "auto_approved"
        bk_write_json(BK_BILLS + "/auto-" + bill_id + ".json", record)
        outcome = "auto_approved"
    else:
        reviewer = bk_reviewer(settings, client)
        # A PDF that couldn't be attached is shown in the item's PDF line, near the top.
        c = proposal.get("contact") or {}
        title = (("Review sales invoice: " if sales else "Review bill: ") + (c.get("name") or ("customer" if sales else "supplier")) + " " + (proposal.get("invoice_number") or "")
                 + " " + bk_fmt(total, proposal.get("currency") or "") + " (" + client.get("name", "") + ")")
        item = api.workq.create(
            title=re.sub(r"\s+", " ", title)[:200],
            scope="org",
            description=xero_bill_markdown(proposal, warnings, blocking, bill_id, dest, client.get("name", ""), client=client,
                                           origin=origin, attach_error=record["attach_error"], settings=settings),
            priority="high" if (blocking or warnings or c.get("is_new") or record["attach_error"]) else "medium",
            due_date=str(bk_add_business_days(today, 2)),
            assignee_ids=[reviewer] if reviewer else None,
            labels=["bookkeeping", "invoice-review" if sales else "bill-review", client["slug"]],
        )
        api.workq.attach_form(todo_id=item["id"], form_id=params["invoice_form"] if sales else params["review_form"])
        record["status"] = "in_review"
        record["review_todo_id"] = item["id"]
        bk_write_json(BK_BILLS + "/" + item["id"] + ".json", record)
        todo_id = item["id"]
        outcome = "review"
