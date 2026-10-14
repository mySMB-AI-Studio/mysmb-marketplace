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
        description=(problem + "\n\n- File: `" + dest + "` in Knowledge\n\n"
                     "When it's fixed, move the PDF back into `" + BK_INBOX + "/" + folder
                     + "`, or key the bill by hand and complete this item."),
        priority="high",
        due_date=str(bk_add_business_days(today, 1)),
        assignee_ids=[owner] if owner else None,
        labels=["bookkeeping", "bill-exception", folder],
    )
    todo_id = item["id"]
    outcome = "exception"
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
        "created_at": bk_now_iso(settings),
        "history": [],
    }
    sales = proposal.get("doc_type") == "ACCREC"
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
        if record["attach_error"]:
            warnings = warnings + ["The PDF couldn't be attached to the Xero " + ("invoice" if sales else "bill") + ": "
                                   + record["attach_error"]]
        c = proposal.get("contact") or {}
        title = (("Review sales invoice: " if sales else "Review bill: ") + (c.get("name") or ("customer" if sales else "supplier")) + " " + (proposal.get("invoice_number") or "")
                 + " " + bk_fmt(total, proposal.get("currency") or "") + " (" + client.get("name", "") + ")")
        item = api.workq.create(
            title=re.sub(r"\s+", " ", title)[:200],
            scope="org",
            description=xero_bill_markdown(proposal, warnings, blocking, bill_id, dest, client.get("name", "")),
            priority="high" if (blocking or warnings or c.get("is_new")) else "medium",
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
