import hashlib

from pypdf import PdfReader, PdfWriter

MATCH_PROMPT = (
    "A bookkeeping practice keeps the books for the client businesses listed in 'clients'. Which one does this invoice "
    "belong to? For a supplier bill it is the business the invoice is addressed to (the 'Bill to', 'Invoice to', "
    "customer or account name); for a sales invoice ('kind' says which) it is the business that issued it (the "
    "letterhead and ABN at the top); for an invoice request it is the business asking the bookkeeper to raise an "
    "invoice, usually the sender; for a bank or credit card statement it is the account holder; for a statement of "
    "account it is the business it is addressed to (or, if the business sent it, the business that issued it). Compare names, trading names and ABNs, ignoring Pty Ltd and punctuation. Answer "
    "with that client's slug, or an empty slug when none of them matches or you aren't sure."
)
MATCH_HINT = '{"client_slug": "acme-plumbing", "bill_to": "Acme Plumbing Pty Ltd", "confidence": "high", "reason": ""}'

provider = params["provider"]
problem = params.get("problem") or ""
settings = bk_read_json(BK_SETTINGS) or {}
ledger_path = BK_MAIL + "/" + provider + ".json"
ledger = bk_read_json(ledger_path) or {}
seen = ledger.get("seen") or {}
errors = ledger.get("errors") or {}
today = bk_today(settings)
now = bk_now_iso(settings)
mailbox = "Outlook" if provider == "outlook" else "Gmail"
filed = 0
requested = 0
unmatched = 0
lines = []

clients = []
for f in (api.files.list(path=BK_CLIENTS) if not problem else []):
    if f.get("kind") == "file" and str(f.get("path", "")).endswith(".json"):
        c = bk_read_json(f["path"]) or {}
        if c.get("slug") and c.get("xero_tenant_id"):
            clients.append(c)
slugs = {c["slug"] for c in clients}


def _pdf_text(path):
    try:
        return "\n".join((page.extract_text() or "") for page in PdfReader(path).pages[:3])
    except Exception:
        return ""


def _first_page(path):
    """What the AI looks at to place a scan or a photo: the photo itself, or a scanned PDF's first page."""
    if not path.lower().endswith(".pdf"):
        return path
    try:
        reader = PdfReader(path)
        if len(reader.pages) <= 1:
            return path
        writer = PdfWriter()
        writer.add_page(reader.pages[0])
        out = api.files.scratch_path("first-page.pdf")
        writer.write(out)
        return out
    except Exception:
        return path


def _client_for(email, text, local=""):
    """(slug, how it was decided). Slug is "" when the bill, invoice or request can't be placed with confidence."""
    kind = str(email.get("kind") or "")
    if "request" in kind:
        # A request comes from the business itself: its contact email in the client settings is the surest match.
        sender = mail_sender(email.get("from"))
        for c in clients:
            if sender and sender == str(c.get("contact_email") or "").strip().lower():
                return c["slug"], "sent by " + str(c.get("contact_name") or sender)
    if len(clients) == 1:
        return clients[0]["slug"], "the only client"
    limit = 10 if "request" in kind else 40
    ask = json.dumps({"clients": [{"slug": c["slug"], "name": c.get("name"), "xero_org_name": c.get("xero_org_name")}
                                  for c in clients],
                      "email": {"subject": email["subject"], "from": email["from"]},
                      "kind": email.get("kind") or "supplier bill", "invoice_text": text[:6000]})
    exc = None  # the platform lint wants names bound before `except ... as`
    if len(text.strip()) >= limit:
        guess = api.ai.extract(prompt=MATCH_PROMPT, input=ask, schema_hint=MATCH_HINT)
    elif local:
        # A scan or a photo: the AI reads the page itself.
        try:
            guess = api.ai.extract(prompt=MATCH_PROMPT, input=ask, schema_hint=MATCH_HINT, scratch_file=_first_page(local))
        except Exception as exc:
            return "", "the AI couldn't read the scan or photo (" + str(exc)[:150] + ")"
    else:
        return "", "the email has no text"
    guess = guess if isinstance(guess, dict) else {}
    slug = str(guess.get("client_slug") or "")
    if slug in slugs and str(guess.get("confidence") or "").lower() != "low":
        return slug, (("issued by " if "sales" in kind else "requested by " if "request" in kind else "addressed to ")
                      + str(guess.get("bill_to") or "that client"))
    return "", ("the AI couldn't tell which client it's for" + (" (it's addressed to " + str(guess["bill_to"]) + ")"
                                                                 if guess.get("bill_to") else ""))


def _file_name(email, att):
    tag = hashlib.sha1((email["id"] + "/" + att["id"]).encode("utf-8")).hexdigest()[:6]
    base = re.sub(r"[^A-Za-z0-9._ -]+", "", att["name"]).strip() or "bill.pdf"
    if not base.lower().endswith((".pdf", ".jpg", ".jpeg", ".png")):
        base += ".pdf"
    # Unique per email attachment, so each one is a new Knowledge file (a new file is what starts Process bill).
    return str(today) + " " + tag + " " + base[-80:]


for s in params.get("skipped") or []:
    if s.get("outcome") == "error":
        errors[s["id"]] = int(errors.get(s["id"]) or 0) + 1
        if errors[s["id"]] < 3:
            continue
    seen[s["id"]] = {"at": now, "outcome": s.get("outcome"), "note": s.get("reason") or "", "print": s.get("print") or ""}

for email in params.get("bills") or []:
    try:
        placed = []
        for att in email.get("pdfs") or []:
            name = _file_name(email, att)
            local = api.files.scratch_path(name)
            mail_download(provider, email["id"], att, local)
            slug, why = _client_for(email, _pdf_text(local), local)
            if slug:
                dest = BK_INBOX + "/" + slug + "/" + name
                api.files.put(file=dest, scratch_file=local)
                filed += 1
                placed.append(slug)
                lines.append("- " + att["name"] + " from " + email["from"] + ": " + str(email.get("kind") or "bill")
                             + " filed for **" + slug + "** (" + why + ")")
                continue
            dest = BK_FAILED + "/unmatched/" + name
            api.files.put(file=dest, scratch_file=local)
            unmatched += 1
            owner = bk_exceptions_owner(settings, {})
            api.workq.create(
                title=("Which client is this invoice for? " + att["name"])[:200],
                scope="org",
                description=("A " + str(email.get("kind") or "bill") + " arrived by email, but " + why
                             + ", so it wasn't filed under a client.\n\n"
                             "- From: " + email["from"] + "\n- Subject: " + email["subject"] + "\n- Received: "
                             + email["received"] + " (" + mailbox + ")\n- File: `" + dest + "` in Knowledge\n\n"
                             "Download it and upload it into `" + BK_INBOX + "/<client>/` in Knowledge, and it's "
                             "processed from there. Then complete this item."),
                priority="high",
                due_date=str(bk_add_business_days(today, 1)),
                assignee_ids=[owner] if owner else None,
                labels=["bookkeeping", "bill-exception", "email-intake"],
            )
            lines.append("- " + att["name"] + " from " + email["from"] + ": **needs a client** (" + why + ")")
        seen[email["id"]] = {"at": now, "outcome": "filed" if placed else "unmatched", "clients": placed,
                              "print": email.get("print") or ""}
        errors.pop(email["id"], None)
    except Exception as exc:
        errors[email["id"]] = int(errors.get(email["id"]) or 0) + 1
        lines.append("- " + email["subject"] + ": couldn't be filed (" + str(exc)[:200] + ")")
        if errors[email["id"]] >= 3:
            seen[email["id"]] = {"at": now, "outcome": "failed", "note": str(exc)[:200], "print": email.get("print") or ""}
            owner = bk_exceptions_owner(settings, {})
            api.workq.create(
                title=("Couldn't take a bill from email: " + email["subject"])[:200],
                scope="org",
                description=("Email intake tried three times and couldn't save this email's PDF: " + str(exc)[:400]
                             + "\n\n- From: " + email["from"] + "\n- Received: " + email["received"] + " (" + mailbox
                             + ")\n\nSave the PDF from the email and upload it into `" + BK_INBOX
                             + "/<client>/` in Knowledge, then complete this item."),
                priority="high",
                due_date=str(bk_add_business_days(today, 1)),
                assignee_ids=[owner] if owner else None,
                labels=["bookkeeping", "bill-exception", "email-intake"],
            )

for email in params.get("requests") or []:
    try:
        text = mail_body(provider, email["id"], email.get("preview") or "")
        slug, why = _client_for(email, text)
        tag = hashlib.sha1(email["id"].encode("utf-8")).hexdigest()[:6]
        title = re.sub(r"[^A-Za-z0-9 -]+", "", email["subject"]).strip()[:60] or "invoice request"
        request = {"from": email["from"], "subject": email["subject"], "received": email["received"],
                   "mailbox": mailbox, "message_id": email["id"], "text": text}
        if slug:
            # A new file here starts Bookkeeping: Draft requested invoice.
            bk_write_json(BK_REQUESTS + "/" + slug + "/" + str(today) + " " + tag + " " + title + ".json", request)
            requested += 1
            seen[email["id"]] = {"at": now, "outcome": "request", "clients": [slug], "print": email.get("print") or ""}
            lines.append("- " + email["subject"] + " from " + email["from"] + ": invoice request filed for **" + slug
                         + "** (" + why + ")")
        else:
            unmatched += 1
            owner = bk_exceptions_owner(settings, {})
            quoted = "\n".join("> " + ln for ln in text[:1500].splitlines() if ln.strip())
            api.workq.create(
                title=("Which client is this invoice request from? " + email["subject"])[:200],
                scope="org",
                description=("An email asks for an invoice to be raised, but " + why + ".\n\n- From: " + email["from"]
                             + "\n- Subject: " + email["subject"] + "\n- Received: " + email["received"] + " (" + mailbox
                             + ")\n\n" + quoted + "\n\nRun **Bookkeeping: Draft requested invoice (Xero)** by hand with "
                             "the client's name and the request text, then complete this item."),
                priority="high",
                due_date=str(bk_add_business_days(today, 1)),
                assignee_ids=[owner] if owner else None,
                labels=["bookkeeping", "bill-exception", "email-intake"],
            )
            seen[email["id"]] = {"at": now, "outcome": "unmatched", "clients": [], "print": email.get("print") or ""}
            lines.append("- " + email["subject"] + " from " + email["from"] + ": **request needs a client** (" + why + ")")
        errors.pop(email["id"], None)
    except Exception as exc:
        errors[email["id"]] = int(errors.get(email["id"]) or 0) + 1
        lines.append("- " + email["subject"] + ": couldn't be filed (" + str(exc)[:200] + ")")
        if errors[email["id"]] >= 3:
            seen[email["id"]] = {"at": now, "outcome": "failed", "note": str(exc)[:200], "print": email.get("print") or ""}

if not problem:
    # Keep the ledger bounded: the newest 2000 emails are plenty to stop anything being filed twice.
    keep = sorted(seen.items(), key=lambda kv: str((kv[1] or {}).get("at") or ""))[-2000:]
    bk_write_json(ledger_path, {"since": params.get("since") or now, "seen": dict(keep), "errors": errors})

summary = (problem or ("Filed " + str(filed) + " bill(s) or invoice(s) and " + str(requested) + " invoice request(s); "
                       + str(unmatched) + " need a client; "
                       + str(len(params.get("skipped") or [])) + " email(s) left alone."
                       + ("\n\n" + "\n".join(lines) if lines else "")))
