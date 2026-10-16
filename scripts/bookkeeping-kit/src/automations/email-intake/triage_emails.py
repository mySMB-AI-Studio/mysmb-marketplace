TRIAGE_PROMPT = (
    "You triage an Australian bookkeeper's inbox. For each email, decide whether it is work to pick up. Kinds: "
    "\"supplier bill\" (its PDF, or a photo of it, is a bill the business has to pay); \"sales invoice\" (its PDF is an invoice the "
    "business itself issued to one of its customers, sent or copied to the bookkeeper to record); \"invoice request\" "
    "(the business asks the bookkeeper to raise and send a new invoice to one of its customers, e.g. \"please invoice "
    "Bayview for 12 hours in September\"); \"bank statement\" (its PDF is a bank or credit card statement for the "
    "business's account); \"statement of account\" (its PDF is a statement of account from a supplier, or one the business "
    "sent its customer); or \"other\". Set capture true for those five kinds, also when the bill has no attachment and "
    "the email only links to it online (\"your bill is ready, view it here\"). These are \"other\": remittance advices, receipts for something already paid, quotes, purchase orders, credit "
    "notes, payment reminders whose PDF isn't the invoice itself, newsletters and marketing, questions and any other "
    "work. Judge from the subject, sender, preview text and attachment names. Give a short reason for each."
)
TRIAGE_HINT = '[{"index": 0, "kind": "supplier bill", "capture": true, "reason": ""}]'

provider = params["provider"]
problem = params.get("problem") or ""
bills = []
requests = []
unreadable = []
skipped = []
if not problem:
    MAIL_MAILBOX["address"] = mail_shared_mailbox(bk_read_json(BK_SETTINGS) or {})
    looked = []
    for m in params.get("candidates") or []:
        files = {"pdfs": [], "photos": [], "other": []}
        if m.get("has_attachments"):
            try:
                files = mail_attachments(provider, m["id"])
            except Exception as exc:
                skipped.append({"id": m["id"], "print": m.get("print") or "", "folder": m.get("folder") or "inbox",
                                "at": m.get("at") or 0, "outcome": "error",
                                "reason": "Couldn't read the attachments: " + str(exc)[:200]})
                continue
        looked.append(dict(m, pdfs=files["pdfs"] or files["photos"], photos=bool(files["photos"]), other=files["other"]))
    # A batch of emails per AI call, so a long run never overflows the AI's input.
    for start in range(0, len(looked), MAIL_TRIAGE_BATCH):
        batch = looked[start:start + MAIL_TRIAGE_BATCH]
        verdicts = api.ai.extract(
            prompt=TRIAGE_PROMPT,
            input=json.dumps([{"index": i, "subject": m["subject"], "from": m["from"], "preview": m["preview"][:800],
                               "attachments": [p["name"] for p in m["pdfs"]] + m["other"]} for i, m in enumerate(batch)])[:20000],
            schema_hint=TRIAGE_HINT,
        )
        by_index = {}
        for v in verdicts if isinstance(verdicts, list) else []:
            if isinstance(v, dict) and isinstance(v.get("index"), (int, float)):
                by_index[int(v["index"])] = v
        for i, m in enumerate(batch):
            v = by_index.get(i)
            base = {"id": m["id"], "print": m.get("print") or "", "folder": m.get("folder") or "inbox", "at": m.get("at") or 0}
            if v is None:
                # No verdict (the AI call failed or skipped it): try again on the next run.
                skipped.append(dict(base, outcome="error", reason="The AI didn't triage this email"))
                continue
            kind = str(v.get("kind") or "").lower()
            capture = v.get("capture", v.get("is_bill"))
            reason = str(v.get("reason") or "")
            if capture and "request" in kind:
                requests.append(dict(m, kind="invoice request", reason=reason))
            elif capture and m["pdfs"]:
                # Bills, sales invoices and statements all go to the client's inbox folder; Process works out which.
                bills.append(dict(m, kind=kind or "supplier bill", reason=reason))
            elif capture:
                # A bill with nothing readable attached: it links to the bill online, or sends a Word or Excel file.
                unreadable.append(dict(m, kind=kind or "supplier bill", reason=reason))
            else:
                skipped.append(dict(base, outcome="not_a_bill", reason=((kind or "other") + ": " + reason)[:200]))
