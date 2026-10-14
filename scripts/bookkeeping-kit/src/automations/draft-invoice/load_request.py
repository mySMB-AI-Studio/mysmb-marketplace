path = str(params.get("path") or "").replace("\\", "/").strip("/")
manual_text = str(params.get("request_text") or "").strip()
manual_client = str(params.get("client_name") or "").strip()
should_process = False
problem = ""
skip_reason = ""
request = {}
ctx = {}
folder = ""

parts = path.split("/")
if len(parts) == 3 and parts[0] == BK_REQUESTS and parts[2].lower().endswith(".json"):
    # Filed by email intake.
    request = bk_read_json(path) or {}
    request["path"] = path
    request["source"] = "email"
    folder = parts[1]
    should_process = True
elif path:
    skip_reason = "not an invoice request in " + BK_REQUESTS
elif manual_text:
    # Run by hand: a request taken over the phone, or one email intake couldn't place.
    request = {"from": "", "subject": "Invoice request", "received": bk_now_iso(bk_read_json(BK_SETTINGS) or {}),
               "text": manual_text, "path": "", "source": "manual"}
    folder = bk_slug(manual_client)
    should_process = True
else:
    skip_reason = "no request: run it by hand with the client's name and what to invoice"

if should_process:
    settings = bk_read_json(BK_SETTINGS)
    client = bk_client_for(settings, folder) if folder else None
    if not client and manual_client:
        for f in api.files.list(path=BK_CLIENTS):
            c = (bk_read_json(f.get("path") or "") or {}) if str(f.get("path", "")).endswith(".json") else {}
            if c and bk_norm(manual_client) in (bk_norm(c.get("name")), bk_norm(c.get("xero_org_name"))):
                client = c
    rules = {"suppliers": {}, "customers": {}}
    if not settings:
        problem = "Bookkeeping isn't set up yet. Run **Bookkeeping: Start setup** and submit the Bookkeeping setup form."
    elif not client:
        problem = ("There are no client settings for " + (manual_client or folder or "this request") + ". Run "
                   "**Bookkeeping: Start setup** with the business's name and submit its settings form.")
    elif not client.get("xero_tenant_id"):
        problem = "The client settings for " + str(client.get("name")) + " have no Xero organisation. Submit them again."
    elif not str(request.get("text") or "").strip():
        problem = "The request has no text to draft an invoice from."
    else:
        rules = bk_read_json(BK_RULES + "/" + client["slug"] + ".json", rules) or rules
    ctx = {"settings": settings or {}, "client": client or {}, "rules": rules, "folder": (client or {}).get("slug") or folder}
