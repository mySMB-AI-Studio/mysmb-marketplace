def _xero_date(value):
    """Xero JSON dates arrive as '2026-10-01T00:00:00' (…String fields) or '/Date(1759276800000+0000)/'."""
    s = str(value or "")
    m = re.match(r"/Date\((\d+)", s)
    if m:
        return datetime.datetime.fromtimestamp(int(m.group(1)) / 1000, datetime.timezone.utc).date()
    try:
        return datetime.date.fromisoformat(s[:10])
    except ValueError:
        return None


problem = ""
settings = bk_read_json(BK_SETTINGS) or {}
today = bk_today(settings)
soon = today + datetime.timedelta(days=14)
open_items = [t for t in (api.workq.list(status="not_started") + api.workq.list(status="in_progress"))
              if "bookkeeping" in (t.get("labels") or [])]
clients = []
if not settings:
    problem = "Bookkeeping isn't set up yet."
for f in api.files.list(path=BK_CLIENTS) if settings else []:
    if f.get("kind") != "file" or not str(f.get("path", "")).endswith(".json"):
        continue
    client = bk_read_json(f["path"]) or {}
    if not client.get("xero_tenant_id"):
        continue
    row = {"name": client.get("name"), "slug": client.get("slug"), "error": "",
           "draft": [0, 0.0], "awaiting": [0, 0.0], "due_soon": [0, 0.0], "overdue": [0, 0.0],
           "in_review": 0, "exceptions": 0, "top_overdue": []}
    try:
        bills = []
        # One where clause per status: Xero silently returns nothing when `where` and `statuses` are
        # combined (myhub-mcp-servers #560).
        for status_name in ("DRAFT", "SUBMITTED", "AUTHORISED"):
            for page in range(1, 11):
                rows = xero_rows(xero_call("list_invoices", client["xero_tenant_id"],
                                           where='Type=="ACCPAY" AND Status=="' + status_name + '"', page=page), "Invoices")
                bills.extend(rows)
                if len(rows) < 100:
                    break
        for b in bills:
            due = _xero_date(b.get("DueDateString") or b.get("DueDate"))
            amount = bk_money(b.get("AmountDue")) or bk_money(b.get("Total")) or 0.0
            status = b.get("Status")
            if status == "DRAFT":
                bucket = "draft"
            elif status == "SUBMITTED":
                bucket = "awaiting"
            elif due and due < today:
                bucket = "overdue"
                row["top_overdue"].append({"supplier": (b.get("Contact") or {}).get("Name"),
                                           "number": b.get("InvoiceNumber"), "due": str(due), "amount": amount})
            elif due and due <= soon:
                bucket = "due_soon"
            else:
                continue
            row[bucket][0] += 1
            row[bucket][1] = round(row[bucket][1] + amount, 2)
        row["top_overdue"] = sorted(row["top_overdue"], key=lambda x: -x["amount"])[:5]
    except Exception as exc:
        row["error"] = str(exc)[:200]
    for t in open_items:
        labels = t.get("labels") or []
        if client.get("slug") in labels:
            if "bill-review" in labels:
                row["in_review"] += 1
            if "bill-exception" in labels:
                row["exceptions"] += 1
    clients.append(row)

summary = {"as_of": str(today), "due_by": str(soon), "clients": clients,
           "recipients": settings.get("digest_recipient_ids") or [x for x in [settings.get("reviewer_id")] if x]}
