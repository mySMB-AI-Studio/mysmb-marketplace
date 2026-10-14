problem = params.get("problem") or ""
ctx = params.get("ctx") or {}
request = params.get("request") or {}
proposal = params.get("proposal") or {}
warnings = params.get("warnings") or []
blocking = params.get("blocking") or []
bill_id = params.get("bill_id") or ""
settings = ctx.get("settings") or {}
client = ctx.get("client") or {}
slug = client.get("slug") or ctx.get("folder") or "unknown"
today = bk_today(settings)
src = str(request.get("path") or "")
outcome = ""
todo_id = ""

quoted = "\n".join("> " + ln for ln in str(request.get("text") or "")[:1500].splitlines() if ln.strip())
asked_by = ("**Requested by** " + (request.get("from") or "the client") + (", " + str(request.get("received")) if request.get("received") else "")
            + ("  \n**Subject:** " + str(request.get("subject")) if request.get("subject") else ""))

if problem:
    dest = ""
    if src:
        try:
            dest = bk_move(src, BK_FAILED + "/" + slug + "/" + src.split("/")[-1])
        except Exception:
            dest = src
    owner = bk_exceptions_owner(settings, client)
    item = api.workq.create(
        title=("Invoice request needs attention: " + (request.get("subject") or "request")
               + (" (" + client["name"] + ")" if client.get("name") else ""))[:200],
        scope="org",
        description=(problem + "\n\n" + asked_by + "\n\n" + quoted + ("\n\n- Request file: `" + dest + "` in Knowledge" if dest else "")
                     + "\n\nFix it, then run **Bookkeeping: Draft requested invoice (Xero)** by hand with the client's name "
                     "and the request text, or raise the invoice in Xero yourself, and complete this item."),
        priority="high",
        due_date=str(bk_add_business_days(today, 1)),
        assignee_ids=[owner] if owner else None,
        labels=["bookkeeping", "bill-exception", "invoice-request", slug],
    )
    todo_id = item["id"]
    outcome = "exception"
else:
    dest = ""
    if src:
        dest = bk_move(src, BK_PROCESSED + "/" + slug + "/" + src.split("/")[-1])
    c = proposal.get("contact") or {}
    reviewer = bk_reviewer(settings, client)
    title = ("Invoice to raise: " + (c.get("name") or "customer") + " " + (proposal.get("invoice_number") or "")
             + " " + bk_fmt(proposal.get("total"), proposal.get("currency") or "") + " (" + client.get("name", "") + ")")
    item = api.workq.create(
        title=re.sub(r"\s+", " ", title)[:200],
        scope="org",
        description=(asked_by + "\n\n" + quoted + "\n\n---\n\n"
                     + xero_bill_markdown(proposal, warnings, blocking, bill_id, "", client.get("name", ""))),
        priority="high" if (blocking or c.get("is_new")) else "medium",
        due_date=str(bk_add_business_days(today, 1)),
        assignee_ids=[reviewer] if reviewer else None,
        labels=["bookkeeping", "invoice-request", slug],
    )
    api.workq.attach_form(todo_id=item["id"], form_id=params["send_form"])
    levels = [str(l.get("confidence") or "low") for l in proposal.get("lines") or []]
    record = {
        "client_slug": slug,
        "tenant_id": client.get("xero_tenant_id"),
        "bill_id": bill_id,
        "proposal": proposal,
        "warnings": warnings,
        "blocking": blocking,
        "confidence": "low" if (blocking or "low" in levels) else ("medium" if "medium" in levels else "high"),
        "file": "",
        "request": {k: request.get(k) for k in ("from", "subject", "received", "mailbox", "source")},
        "request_file": dest,
        "created_at": bk_now_iso(settings),
        "history": [],
        "status": "in_review",
        "review_todo_id": item["id"],
    }
    bk_write_json(BK_BILLS + "/" + item["id"] + ".json", record)
    todo_id = item["id"]
    outcome = "review"
