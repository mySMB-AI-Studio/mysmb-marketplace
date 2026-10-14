todo_id = params.get("todo_id") or ""
form_id = params.get("form_id") or ""
responses = params.get("responses") or {}
problem = ""
kind = ""
if form_id in (params["review_form"], params["invoice_form"], params["send_form"]):
    kind = "review"
elif form_id == params["approval_form"]:
    kind = "client"

record_todo = todo_id
record = bk_read_json(BK_BILLS + "/" + todo_id + ".json") or {}
if record.get("link"):
    record_todo = record["link"]
    record = bk_read_json(BK_BILLS + "/" + record_todo + ".json") or {}
settings = bk_read_json(BK_SETTINGS) or {}
client = bk_client_for(settings, record.get("client_slug") or "") or {}

if not kind or not todo_id or not record:
    problem = "ignored"
elif record.get("status") in ("approved", "rejected"):
    problem = "This bill was already " + record["status"] + ", so nothing was changed."

if kind == "review":
    answer = str(bk_answer(responses, "q_decision") or "").lower()
    action = ("approve_changes" if "changes" in answer else "approve" if answer.startswith("approve")
              else "reject" if answer.startswith("reject") else "ask" if answer.startswith("ask") else "")
else:
    answer = str(bk_answer(responses, "q_client_decision") or "").lower()
    action = ("client_approved" if "approved" in answer else "client_rejected" if "rejected" in answer
              else "client_question" if "question" in answer else "")
if not problem and not action:
    problem = "The form didn't say what to do with this bill."

decision = {
    "action": action,
    "changes": str(bk_answer(responses, "q_changes") or "").strip(),
    "remember": bool(bk_answer(responses, "q_remember")),
    "send": bool(bk_answer(responses, "q_send")),
    "notes": str(bk_answer(responses, "q_notes") or bk_answer(responses, "q_client_reply") or "").strip(),
    "actor": params.get("actor") or "",
}
ctx = {"settings": settings, "client": client, "record": record, "record_todo": record_todo, "kind": kind}
