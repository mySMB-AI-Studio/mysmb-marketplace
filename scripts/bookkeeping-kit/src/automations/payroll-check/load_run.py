todo_id = params.get("todo_id") or ""
responses = params.get("responses") or {}
manual_client = str(params.get("client_name") or "").strip()
answer = str(bk_answer(responses, "q_action") or "").lower()
problem = ""
ctx = {}

if todo_id:
    action = "check" if answer.startswith("run") else ("cancel" if answer.startswith("cancel") else "")
else:
    action = "check" if manual_client else ""
path, run = pay_run_load(todo_id, manual_client) if action else ("", {})
settings = bk_read_json(BK_SETTINGS) or {}

if action and not run:
    action = ""
    problem = "There's no open pay run for " + (manual_client or "this item") + "."
elif action:
    note = str(bk_answer(responses, "q_notes") or "").strip()
    if note:
        run.setdefault("notes", []).append({"at": bk_now_iso(settings), "by": params.get("actor") or "", "text": note[:4000]})
    if action == "cancel":
        run["status"] = "cancelled"
        api.workq.comment(todo_id=run["item_id"], body="Pay run cancelled. Nothing was changed in Xero Payroll.")
        api.workq.complete(todo_id=run["item_id"])
        action = ""
    bk_write_json(path, run)
    if action:
        client = bk_client_for(settings, run["slug"]) or {}
        payroll = bk_read_json(BK_PAYROLL + "/" + run["slug"] + ".json") or {}
        if not client.get("xero_tenant_id"):
            problem = "The bookkeeping settings for " + run["name"] + " have no Xero organisation."
        ctx = {"settings": settings, "client": client, "payroll": payroll, "run": run, "run_path": path}

should_check = action == "check" and not problem
if problem and run.get("item_id"):
    api.workq.comment(todo_id=run["item_id"], body="The checks didn't run: " + problem)
