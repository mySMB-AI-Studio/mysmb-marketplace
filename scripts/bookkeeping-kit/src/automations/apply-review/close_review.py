problem = params.get("problem") or ""
ctx = params.get("ctx") or {}
decision = params.get("decision") or {}
record = params.get("record") or ctx.get("record") or {}
client = ctx.get("client") or {}
settings = ctx.get("settings") or {}
todo_id = params.get("todo_id") or ""
outcome = params.get("outcome") or ""
learned = ""

if problem == "ignored" or not todo_id:
    pass
elif problem:
    api.workq.comment(todo_id=todo_id, body=problem)
    api.workq.set_status(todo_id=todo_id, status="in_progress")
else:
    proposal = record.get("proposal") or {}
    c = proposal.get("contact") or {}
    sales = proposal.get("doc_type") == "ACCREC"
    lines = proposal.get("lines") or []
    wants_rule = decision.get("remember") or (params.get("changed_coding") and outcome == "approved")
    if wants_rule and lines and lines[0].get("account_code") and client.get("slug"):
        path = BK_RULES + "/" + client["slug"] + ".json"
        rules = bk_read_json(path, {"suppliers": {}}) or {"suppliers": {}}
        # Customers and suppliers are coded to different sides of the ledger, so their rules are kept apart.
        rule = {"name": c.get("name"), "account_code": lines[0]["account_code"],
                "tax_type": lines[0].get("tax_type") or "", "source": "reviewer", "updated_at": bk_now_iso(settings)}
        suppliers = rules.setdefault("customers" if sales else "suppliers", {})
        if c.get("id"):
            suppliers[c["id"]] = rule
        suppliers["name:" + bk_norm(c.get("name"))] = rule
        bk_write_json(path, rules)
        learned = c.get("name") or ""
    bill_id = record.get("bill_id") or ""
    status_word = "Approved" if settings.get("approved_status") == "AUTHORISED" else "Awaiting approval"
    doc = "sales invoice" if sales else "bill"
    messages = {
        "approved": (("Done: the invoice is **Awaiting payment** in Xero"
                      + (" and Xero emailed it to " + str(record["emailed_to"]) + "." if record.get("emailed_to")
                         else ", but Xero couldn't email it: " + str(record["email_error"]) + " Send it from Xero."
                         if record.get("email_error")
                         else ". It wasn't emailed; send it from Xero when you're ready."))
                     if proposal.get("origin") == "request"
                     else "Done: the sales invoice is **Awaiting payment** in Xero. Nothing was emailed to the customer."
                     if sales else "Done: the bill is **" + status_word + "** in Xero."),
        "rejected": ("Rejected: the draft " + doc + " was deleted from Xero." if bill_id
                     else "Rejected: nothing was posted to Xero."),
        "client_approval_requested": ("This bill needs the business owner's approval first. "
                                      "I've created a follow-up item with a draft email."),
        "question_drafted": "I've created a follow-up item with a draft email to the business owner.",
    }
    body = messages.get(outcome, "Review recorded.")
    if bill_id and outcome != "rejected":
        body += "\n\n[Open the " + doc + " in Xero](" + xero_bill_link(bill_id, proposal.get("doc_type") or "ACCPAY") + ")"
    if record.get("attach_error"):
        body += "\n\nThe PDF couldn't be attached in Xero: " + record["attach_error"]
    if learned:
        body += ("\n\nRemembered: " + ("invoices to **" if sales else "bills from **") + learned + "** will be coded to "
                 + lines[0]["account_code"]
                 + " from now on.")
    api.workq.comment(todo_id=todo_id, body=body)
    api.workq.complete(todo_id=todo_id)
