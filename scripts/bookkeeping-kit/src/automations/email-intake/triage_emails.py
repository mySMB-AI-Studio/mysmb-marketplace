TRIAGE_PROMPT = (
    "You triage an Australian bookkeeper's inbox. For each email, decide whether it is work to pick up. Kinds: "
    "\"supplier bill\" (its PDF, or a photo of it, is a bill the business has to pay); \"sales invoice\" (its PDF is an invoice the "
    "business itself issued to one of its customers, sent or copied to the bookkeeper to record); \"invoice request\" "
    "(the business asks the bookkeeper to raise and send a new invoice to one of its customers, e.g. \"please invoice "
    "Bayview for 12 hours in September\"); \"bank statement\" (its PDF is a bank or credit card statement for the "
    "business's account); \"statement of account\" (its PDF is a statement of account from a supplier, or one the business "
    "sent its customer); or \"other\". Set capture true for those five kinds. These are \"other\": remittance advices, receipts for something already paid, quotes, purchase orders, credit "
    "notes, payment reminders whose PDF isn't the invoice itself, newsletters and marketing, questions and any other "
    "work. Judge from the subject, sender, preview text and attachment names. Give a short reason for each."
)
TRIAGE_HINT = '[{"index": 0, "kind": "supplier bill", "capture": true, "reason": ""}]'

provider = params["provider"]
problem = params.get("problem") or ""
bills = []
requests = []
skipped = []
if not problem:
    looked = []
    for m in params.get("candidates") or []:
        pdfs = []
        if m.get("has_attachments"):
            try:
                pdfs = mail_pdfs(provider, m["id"])
            except Exception as exc:
                skipped.append({"id": m["id"], "print": m.get("print") or "", "outcome": "error", "reason": "Couldn't read the attachments: " + str(exc)[:200]})
                continue
        looked.append(dict(m, pdfs=pdfs))
    if looked:
        verdicts = api.ai.extract(
            prompt=TRIAGE_PROMPT,
            input=json.dumps([{"index": i, "subject": m["subject"], "from": m["from"], "preview": m["preview"][:800],
                               "attachments": [p["name"] for p in m["pdfs"]]} for i, m in enumerate(looked)])[:20000],
            schema_hint=TRIAGE_HINT,
        )
        by_index = {}
        for v in verdicts if isinstance(verdicts, list) else []:
            if isinstance(v, dict) and isinstance(v.get("index"), (int, float)):
                by_index[int(v["index"])] = v
        for i, m in enumerate(looked):
            v = by_index.get(i)
            if v is None:
                # No verdict (the AI call failed or skipped it): try again on the next run.
                skipped.append({"id": m["id"], "print": m.get("print") or "", "outcome": "error", "reason": "The AI didn't triage this email"})
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
                skipped.append({"id": m["id"], "print": m.get("print") or "", "outcome": "no_pdf", "reason": (kind or "invoice") + " with no PDF attached"})
            else:
                skipped.append({"id": m["id"], "print": m.get("print") or "", "outcome": "not_a_bill", "reason": ((kind or "other") + ": " + reason)[:200]})
