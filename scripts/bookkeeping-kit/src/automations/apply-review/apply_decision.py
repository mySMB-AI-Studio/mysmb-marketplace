CHANGES_PROMPT = (
    "A bookkeeper reviewed a draft supplier bill and wrote the changes they want in plain words. Turn them into "
    "structured edits against 'bill'. Line numbers in the text are 1-based; 'index' in your output is 0-based. "
    "'all lines' means every line. Only use account codes from 'accounts' and tax types from 'tax_rates'. Leave out "
    "anything the bookkeeper didn't ask to change."
)
CHANGES_HINT = ('{"lines": [{"index": 0, "account_code": "449", "tax_type": "INPUT", "description": null, '
                '"unit_amount": null, "line_amount": null}], "due_date": null, "invoice_number": null, "date": null, '
                '"reference": null}')
EMAIL_PROMPT = (
    "Draft a short, friendly email from an Australian bookkeeper to a small-business owner. Plain text, no subject "
    "line, sign off as the bookkeeping team. Use only the facts given. Purpose: "
)

problem = params.get("problem") or ""
ctx = params.get("ctx") or {}
decision = params.get("decision") or {}
settings = ctx.get("settings") or {}
client = ctx.get("client") or {}
record = dict(ctx.get("record") or {})
record_todo = ctx.get("record_todo") or ""
outcome = ""
followup_id = ""
changed_coding = False

if not problem:
    try:
        tenant = record["tenant_id"]
        proposal = record.get("proposal") or {}
        bill_id = record.get("bill_id") or ""
        action = decision.get("action")
        today = bk_today(settings)
        actor = decision.get("actor") or bk_reviewer(settings, client)
        c = proposal.get("contact") or {}
        doc_type = proposal.get("doc_type") or "ACCPAY"
        sales = doc_type == "ACCREC"
        facts = {
            "document": "a sales invoice the business issued to its customer" if sales else "a supplier bill",
            "business": client.get("name"), "owner_name": client.get("contact_name"),
            ("customer" if sales else "supplier"): c.get("name"),
            "invoice_number": proposal.get("invoice_number"), "date": proposal.get("date"),
            "total": bk_fmt(proposal.get("total"), proposal.get("currency") or ""), "note": decision.get("notes"),
        }

        if action == "approve_changes" and decision.get("changes"):
            accounts, taxes = xero_chart(tenant, doc_type)
            codes = {a["code"] for a in accounts}
            tax_types = {t["type"] for t in taxes}
            edits = api.ai.extract(
                prompt=CHANGES_PROMPT,
                input=json.dumps({"changes": decision["changes"], "bill": proposal, "accounts": accounts[:300],
                                  "tax_rates": taxes})[:30000],
                schema_hint=CHANGES_HINT,
            )
            edits = edits if isinstance(edits, dict) else {}
            for e in edits.get("lines") or []:
                i = e.get("index") if isinstance(e, dict) else None
                if not isinstance(i, (int, float)) or not (0 <= int(i) < len(proposal.get("lines") or [])):
                    continue
                ln = proposal["lines"][int(i)]
                if e.get("account_code") and str(e["account_code"]) in codes:
                    ln["account_code"] = str(e["account_code"])
                    changed_coding = True
                if e.get("tax_type") and str(e["tax_type"]) in tax_types:
                    ln["tax_type"] = str(e["tax_type"])
                    changed_coding = True
                if e.get("description"):
                    ln["description"] = str(e["description"])[:400]
                unit = bk_money(e.get("unit_amount"))
                amount = bk_money(e.get("line_amount"))
                if unit is not None:
                    ln["unit_amount"] = unit
                    ln["line_amount"] = round(unit * (ln.get("quantity") or 1), 2)
                elif amount is not None:
                    ln["line_amount"] = amount
                    ln["unit_amount"] = round(amount / (ln.get("quantity") or 1), 4)
                ln["source"] = "reviewer"
                ln["reason"] = "Changed by the reviewer"
            for key in ("due_date", "invoice_number", "date", "reference"):
                if edits.get(key):
                    proposal[key] = str(edits[key])
            record["proposal"] = proposal
            if bill_id:
                xero_update_bill_lines(tenant, bill_id, proposal)

        approving = action in ("approve", "approve_changes", "client_approved")
        missing = [i + 1 for i, ln in enumerate(proposal.get("lines") or []) if not ln.get("account_code")]
        if approving and missing:
            raise RuntimeError("line(s) " + ", ".join(str(m) for m in missing) + " still have no account code. "
                               "Submit the review again with \"Approve with changes\" and the account codes")
        unpriced = [i + 1 for i, ln in enumerate(proposal.get("lines") or [])
                    if ln.get("line_amount") is None and ln.get("unit_amount") is None]
        if approving and unpriced:
            raise RuntimeError("line(s) " + ", ".join(str(m) for m in unpriced) + " still have no price. "
                               "Submit the review again with \"Approve with changes\" and the prices")

        if approving:
            limit = bk_money(client.get("client_approval_above"))
            if limit is None:
                limit = bk_money(settings.get("client_approval_above"))
            total = proposal.get("total") or 0
            if action == "client_approved":
                record["client_approved"] = True
            if not sales and limit and total > limit and not record.get("client_approved"):
                email = api.ai.generate(prompt=EMAIL_PROMPT + "ask them to approve this bill before it is approved in Xero.",
                                        input=json.dumps(facts))
                item = api.workq.create(
                    title=("Get approval from " + (client.get("name") or "the client") + ": " + (c.get("name") or "bill")
                           + " " + facts["total"])[:200],
                    scope="org",
                    description=("This bill is over the client-approval limit (" + bk_fmt(limit) + ").\n\n"
                                 "1. Email " + (client.get("contact_name") or "the business owner")
                                 + (" (" + client["contact_email"] + ")" if client.get("contact_email") else "")
                                 + " using the draft below.\n2. When they reply, fill in the **Client bill approval** form on this item.\n\n"
                                 "**Draft email**\n\n" + email),
                    priority="high",
                    due_date=str(bk_add_business_days(today, 3)),
                    assignee_ids=[actor] if actor else None,
                    labels=["bookkeeping", "client-approval", client.get("slug", "")],
                )
                api.workq.attach_form(todo_id=item["id"], form_id=params["approval_form"])
                bk_write_json(BK_BILLS + "/" + item["id"] + ".json", {"link": record_todo})
                followup_id = item["id"]
                record["status"] = "awaiting_client"
                outcome = "client_approval_requested"
            else:
                status = "AUTHORISED" if sales else (settings.get("approved_status") or "SUBMITTED")
                if not proposal.get("due_date") and proposal.get("date"):
                    # Xero only accepts a submitted or approved bill with a due date.
                    due, came_from = xero_default_due(tenant, None, proposal["date"], doc_type)
                    if due:
                        proposal["due_date"] = due
                        record["proposal"] = proposal
                        record.setdefault("warnings", []).append("Due date set to " + due + " from " + came_from + ".")
                        if bill_id:
                            xero_update_bill_lines(tenant, bill_id, proposal)
                if not bill_id:
                    bill_id = xero_create_bill(tenant, proposal, status)
                    record["bill_id"] = bill_id
                    if str(record.get("file") or "").lower().endswith(".pdf"):
                        record["attach_error"] = xero_attach_pdf(tenant, bill_id, record["file"])
                else:
                    xero_set_status(tenant, bill_id, status)
                record["status"] = "approved"
                record["approved_by"] = decision.get("actor") or ""
                outcome = "approved"
                if sales and proposal.get("origin") == "request" and decision.get("send"):
                    # Only a raised invoice, and only when the reviewer said so: Xero emails it to the contact.
                    try:
                        xero_call("email_invoice", tenant, invoiceId=bill_id)
                        record["emailed_to"] = c.get("email") or c.get("name") or "the customer"
                    except Exception as exc:
                        record["email_error"] = str(exc)[:300]

        elif action in ("reject", "client_rejected"):
            if bill_id:
                xero_set_status(tenant, bill_id, "DELETED")
            record["status"] = "rejected"
            outcome = "rejected"

        elif action in ("ask", "client_question"):
            if action == "ask":
                purpose = ("ask them this question about " + ("a sales invoice they issued" if sales else "a supplier bill") + ": "
                           + (decision.get("notes") or "please confirm the " + ("invoice" if sales else "bill")))
            else:
                purpose = ("reply to their question about " + ("a sales invoice" if sales else "a supplier bill")
                           + " and confirm next steps. Their message: "
                           + (decision.get("notes") or ""))
            email = api.ai.generate(prompt=EMAIL_PROMPT + purpose, input=json.dumps(facts))
            item = api.workq.create(
                title=("Ask " + (client.get("name") or "the client") + " about " + (c.get("name") or "a bill") + " "
                       + (proposal.get("invoice_number") or ""))[:200],
                scope="org",
                description=("1. Email " + (client.get("contact_name") or "the business owner")
                             + (" (" + client["contact_email"] + ")" if client.get("contact_email") else "")
                             + " using the draft below.\n2. When they answer, fill in the **Bill review** form on this item.\n\n"
                             "**Draft email**\n\n" + email + "\n\n---\n\n"
                             + xero_bill_markdown(proposal, record.get("warnings"), record.get("blocking"), bill_id,
                                                  record.get("file") or "", client.get("name", ""))),
                priority="medium",
                due_date=str(bk_add_business_days(today, 3)),
                assignee_ids=[actor] if actor else None,
                labels=["bookkeeping", "client-query", client.get("slug", "")],
            )
            api.workq.attach_form(todo_id=item["id"], form_id=(params["send_form"] if proposal.get("origin") == "request"
                                                               else params["invoice_form"] if sales else params["review_form"]))
            bk_write_json(BK_BILLS + "/" + item["id"] + ".json", {"link": record_todo})
            followup_id = item["id"]
            record["status"] = "waiting_client"
            outcome = "question_drafted"

        record.setdefault("history", []).append({"at": bk_now_iso(settings), "by": decision.get("actor") or "",
                                                  "action": action, "outcome": outcome,
                                                  "notes": decision.get("notes") or ""})
        bk_write_json(BK_BILLS + "/" + record_todo + ".json", record)
    except Exception as exc:
        problem = "Couldn't apply this review in Xero. " + str(exc)[:600]
