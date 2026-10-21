APPROVAL_PROMPT = (
    "Draft a short email from a payroll officer at a bookkeeping practice to the client's approvers, asking them to "
    "review and approve this pay run before it's finalised. Give the pay period, pay day, number of employees and the "
    "totals, mention anything in the notes, and ask them to reply to approve or with changes. Plain text, no subject "
    "line, sign off as the payroll team. Use only the facts given."
)

todo_id = params.get("todo_id") or ""
form_id = params.get("form_id") or ""
responses = params.get("responses") or {}
actor = params.get("actor") or ""
settings = bk_read_json(BK_SETTINGS) or {}
outcome = "ignored"

path, run = pay_run_load(todo_id) if (todo_id and responses) else ("", {})
if run:
    ps = bk_read_json(BK_PAYROLL + "/" + run["slug"] + ".json") or {}
    period = run["period_start"] + " to " + run["period_end"]
    officer = [ps["officer_id"]] if ps.get("officer_id") else None
    notes = str(bk_answer(responses, "q_notes") or bk_answer(responses, "q_client_reply") or "").strip()
    run.setdefault("history", []).append({"at": bk_now_iso(settings), "by": actor, "form": form_id,
                                          "answer": str(bk_answer(responses, "q_decision") or bk_answer(responses, "q_client_decision") or ""),
                                          "notes": notes})
    if form_id == params["review_form"]:
        if str(bk_answer(responses, "q_decision") or "").lower().startswith("approve"):
            t = run.get("pack_totals") or {}
            email = api.ai.generate(prompt=APPROVAL_PROMPT, input=json.dumps({
                "business": run["name"], "approvers": ps.get("approvers") or "the approvers", "pay_period": period,
                "pay_day": run["payment_date"], "employees": run.get("staff"), "wages": bk_fmt(t.get("Wages")),
                "tax": bk_fmt(t.get("Tax")), "super": bk_fmt(t.get("Super")), "net_pay": bk_fmt(t.get("NetPay")),
                "notes": notes}))
            item = api.workq.create(
                title=("Client approval: " + run["name"] + " pay run, " + period)[:200],
                scope="me",
                description=("The internal review approved this pay run.\n\n1. Email " + (ps.get("approvers") or "the client's approvers")
                             + " using the draft below, with the [review pack](" + str(run.get("pack_url") or "") + ").\n"
                             "2. When they reply, fill in the **Client payroll approval** form on this item.\n\n"
                             "**Draft email**\n\n" + str(email)),
                priority="high",
                due_date=run["payment_date"],
                assignee_ids=officer,
                labels=["bookkeeping", "payroll-approval", run["slug"]],
            )
            api.workq.attach_form(todo_id=item["id"], form_id=params["client_form"])
            pay_link(item["id"], run)
            run.update(status="client_approval", client_item_id=item["id"])
            api.workq.comment(todo_id=todo_id, body="Approved. The client approval item has a draft email for the payroll officer.")
            api.workq.comment(todo_id=run["item_id"], body="The internal review approved the pay run. It's waiting for the client's approval.")
            outcome = "client_approval"
        else:
            run["status"] = "changes"
            api.workq.comment(todo_id=todo_id, body="Sent back to the payroll officer.")
            api.workq.comment(todo_id=run["item_id"], body="The internal review asked for changes:\n\n" + (notes or "(no notes)")
                              + "\n\nFix them, run the checks again and choose **Ready for review**.")
            api.workq.set_status(todo_id=run["item_id"], status="in_progress")
            outcome = "changes"
        api.workq.complete(todo_id=todo_id)
    elif form_id == params["client_form"]:
        if str(bk_answer(responses, "q_client_decision") or "").lower().startswith("they approved"):
            run["client_approved_at"] = str(bk_answer(responses, "q_reply_date") or bk_today(settings))
            if ps.get("who_posts") == "practice":
                run["status"] = "approved"
                api.workq.comment(todo_id=run["item_id"], body=(
                    "The client approved the pay run. **Post it in Xero Payroll** and make sure STP is filed, then complete "
                    "this item."))
                outcome = "approved_practice_posts"
            else:
                run["status"] = "done"
                api.workq.comment(todo_id=run["item_id"], body="The client approved the pay run. They post it in Xero Payroll.")
                api.workq.complete(todo_id=run["item_id"])
                outcome = "approved_client_posts"
        else:
            run["status"] = "changes"
            api.workq.comment(todo_id=run["item_id"], body="The client asked for changes:\n\n" + (notes or "(no notes)")
                              + "\n\nFix them, run the checks again and choose **Ready for review**.")
            api.workq.set_status(todo_id=run["item_id"], status="in_progress")
            outcome = "client_changes"
        api.workq.complete(todo_id=todo_id)
    bk_write_json(path, run)
