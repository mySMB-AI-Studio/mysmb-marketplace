import hashlib
import time

from pypdf import PdfReader

provider = params["provider"]
problem = params.get("problem") or ""
settings = bk_read_json(BK_SETTINGS) or {}
MAIL_MAILBOX["address"] = mail_shared_mailbox(settings)
ledger_path = BK_MAIL + "/" + provider + ".json"
ledger = bk_read_json(ledger_path) or {}
seen = ledger.get("seen") or {}
errors = ledger.get("errors") or {}
cursors = dict(ledger.get("cursors") or {})
cursors.update(params.get("cursors") or {})
today = bk_today(settings)
now = bk_now_iso(settings)
mailbox = {"outlook": "Outlook", "outlook-shared": "Outlook (" + MAIL_MAILBOX["address"] + ")", "hotmail": "Hotmail",
           "gmail": "Gmail"}[provider]
filed = 0
requested = 0
unmatched = 0
lines = list(params.get("notes") or [])
started = time.time()
# Stop starting new emails after this long; the rest are kept for the next run (it starts where this one stopped).
BUDGET_SECONDS = 8 * 60

clients = route_clients() if not problem else []
by_slug = {c["slug"]: c for c in clients}
routing = bk_read_json(BK_ROUTING) or {}
routing_changed = False


def _pdf_text(path):
    try:
        return "\n".join((page.extract_text() or "") for page in PdfReader(path).pages[:3])
    except Exception:
        return ""


def _hold(m):
    """Keep this email for the next run: its folder's cursor stops just before it, so it's listed again."""
    at = m.get("at") or 0
    if not at:
        return
    key = m.get("folder") or "inbox"
    hold = datetime.datetime.fromtimestamp(at - 1, datetime.timezone.utc)
    current = mail_when(cursors.get(key))
    if current is None or hold < current:
        cursors[key] = mail_iso(hold)


def _tag(*parts):
    return hashlib.sha1("/".join(parts).encode("utf-8")).hexdigest()[:6]


def _file_name(email, att_id, name):
    base = re.sub(r"[^A-Za-z0-9._ ()-]+", "", name).strip() or "bill.pdf"
    if not base.lower().endswith(".pdf"):
        base = base.rsplit(".", 1)[0] + ".pdf" if "." in base else base + ".pdf"
    # Unique per email attachment, so each one is a new Knowledge file (a new file is what starts Process bill).
    return str(today) + " " + _tag(email["id"], att_id) + " " + base[-80:]


def _owner():
    """The exceptions owner's user id, or "" when none is set."""
    return str(bk_exceptions_owner(settings, {}) or "")


def _client_line(slug):
    return "**" + slug + "**"


def _documents(email):
    """The email's bill documents as [(scratch path, file name, attachment id)] plus notes on what was left out. Several
    photos (the pages of one bill, or a few receipts) become one PDF; Process splits it when it holds more than one."""
    docs = []
    notes = []
    if not email.get("photos"):
        for att in email.get("pdfs") or []:
            name = _file_name(email, att["id"], att["name"])
            local = api.files.scratch_path(name)
            mail_download(provider, email["id"], att, local)
            docs.append((local, name, att["id"]))
        return docs, notes
    images = []
    for att in email.get("pdfs") or []:
        local = api.files.scratch_path("photo-" + _tag(email["id"], att["id"]) + "-" + re.sub(r"[^A-Za-z0-9.]+", "", att["name"])[-40:])
        got = mail_download(provider, email["id"], att, local, photo=True)
        if got["heic"]:
            notes.append(att["name"] + " is an iPhone HEIC photo that couldn't be converted to JPEG")
            continue
        images.append(local)
    if not images:
        return docs, notes
    pages = email.get("pdfs") or []
    subject = re.sub(r"[^A-Za-z0-9 -]+", "", email.get("subject") or "").strip()[:50]
    if len(images) == 1:
        label = pages[0]["name"].rsplit(".", 1)[0] + " (photo).pdf"
    else:
        label = (subject or "photos") + " (" + str(len(images)) + " photos).pdf"
    name = _file_name(email, "photos", label)
    local = api.files.scratch_path(name)
    exc = None  # the platform lint wants names bound before `except ... as`
    try:
        bk_images_pdf(images, local)
    except Exception as exc:
        notes.append("the photos couldn't be opened (" + str(exc)[:120] + ")")
        return docs, notes
    docs.append((local, name, "photos"))
    return docs, notes


def _item(title, description, priority="high", extra=None):
    owner = _owner()
    api.workq.create(
        title=title[:200], scope="org", description=description, priority=priority,
        due_date=str(bk_add_business_days(today, 1)), assignee_ids=[owner] if owner else None,
        labels=["bookkeeping", "bill-exception", "email-intake"] + (extra or []),
    )


for s in params.get("skipped") or []:
    if s.get("outcome") == "error":
        errors[s["id"]] = int(errors.get(s["id"]) or 0) + 1
        if errors[s["id"]] < 3:
            _hold(s)
            continue
    seen[s["id"]] = {"at": now, "outcome": s.get("outcome"), "note": s.get("reason") or "", "print": s.get("print") or ""}

for email in params.get("bills") or []:
    if time.time() - started > BUDGET_SECONDS:
        _hold(email)
        continue
    sender = mail_sender(email.get("from"))
    try:
        docs, notes = _documents(email)
        placed = []
        left_out = []
        several = len(docs) > 1
        for local, name, att_id in docs:
            text = _pdf_text(local)
            folder_client = email.get("folder_client") or ""
            if folder_client and not several:
                found = {"slug": folder_client, "why": "it's in " + str((by_slug.get(folder_client) or {}).get("name") or folder_client) + "'s mail folder",
                         "addressed_to": "", "document": ""}
            else:
                # With several attachments, each one is checked: terms and conditions or a remittance sent with the
                # invoice are left alone instead of becoming exception items.
                found = route_match(clients, routing, email.get("kind"), text, local, sender, email.get("subject") or "",
                                    classify=several)
                if folder_client:
                    found = dict(found, slug=folder_client, why="it's in its client's mail folder")
            if several and found.get("document") == "other":
                left_out.append(name.split(" ", 2)[-1] + " (not a bill)")
                continue
            slug = found["slug"]
            if slug:
                # Noted before the file is saved: saving it starts Process bill, which puts this on the review item
                # (and asks which client it's for when it went to the only client but is addressed to someone else).
                bk_note_origin(name, {"from": email["from"], "subject": email.get("subject") or "",
                                      "received": email.get("received") or "", "mailbox": mailbox, "client": slug,
                                      "why": found["why"], "how": ("only client" if found["why"] == "the only client"
                                                                  else "folder" if "mail folder" in found["why"] else "matched")})
                api.files.put(file=BK_INBOX + "/" + slug + "/" + name, scratch_file=local)
                filed += 1
                placed.append(slug)
                route_count_sender(routing, sender, slug)
                routing_changed = True
                lines.append("- " + name.split(" ", 2)[-1] + " from " + email["from"] + ": " + str(email.get("kind") or "bill")
                             + " filed for " + _client_line(slug) + " (" + found["why"] + ")")
                continue
            dest = BK_FAILED + "/unmatched/" + name
            api.files.put(file=dest, scratch_file=local)
            unmatched += 1
            placed.append("")
            route_note_unmatched(name, found.get("addressed_to") or "", sender, email.get("subject") or "")
            _item("Which client is this invoice for? " + name.split(" ", 2)[-1],
                  bk_card("download the file below and upload it into `" + BK_INBOX + "/<client>/` in Knowledge (the "
                          "client's folder), then complete this item. It's processed from there, nothing has gone to "
                          "Xero yet.",
                          [("What arrived", "a " + str(email.get("kind") or "bill") + " (" + name.split(" ", 2)[-1] + ")"),
                           ("Came from", bk_origin_line({"from": email["from"], "subject": email["subject"],
                                                          "received": email["received"], "mailbox": mailbox}, settings)),
                           ("Addressed to", found.get("addressed_to") or "no business name could be read"),
                           ("Why it wasn't filed", found["why"]),
                           ("Clients set up", ", ".join(sorted(str(c.get("name") or c["slug"]) for c in clients)) or "none"),
                           ("File", "`" + dest + "` in Knowledge")],
                          after="Who it was addressed to is remembered, so the next one from them is filed by itself. If "
                                "it's for a business that isn't set up yet, run **Bookkeeping: Start setup** with its "
                                "name first."))
            lines.append("- " + name.split(" ", 2)[-1] + " from " + email["from"] + ": **needs a client** (" + found["why"] + ")")
        if notes or not placed:
            # Part or all of an email that looked like a bill couldn't be filed: say so rather than let it vanish.
            what = "; ".join(notes + left_out) or "none of its attachments looked like a bill"
            _item(("Part of this email wasn't filed: " if placed else "Check this email: ") + str(email.get("subject") or "(no subject)"),
                  bk_card("open the email. If it holds a bill, save it as a PDF (or a JPEG photo) and drop it into `"
                          + BK_INBOX + "/<client>/` in Knowledge, then complete this item. If it isn't a bill, just "
                          "complete this item.",
                          [("Came from", bk_origin_line({"from": email["from"], "subject": email["subject"],
                                                          "received": email["received"], "mailbox": mailbox}, settings)),
                           ("What happened", "it looked like a " + str(email.get("kind") or "bill") + ", but " + what
                            + (", so that part wasn't filed." if placed else ", so nothing was filed.")),
                           ("Already filed", ", ".join(_client_line(p) for p in placed if p) if any(placed) else "")]),
                  priority="medium")
            lines.append("- " + email["subject"] + ": " + what)
        elif left_out:
            lines.append("- " + email["subject"] + ": left out " + ", ".join(left_out))
        seen[email["id"]] = {"at": now, "outcome": "filed" if any(placed) else "unmatched" if placed else "nothing_filed",
                              "clients": [p for p in placed if p], "print": email.get("print") or ""}
        errors.pop(email["id"], None)
    except Exception as exc:
        errors[email["id"]] = int(errors.get(email["id"]) or 0) + 1
        lines.append("- " + email["subject"] + ": couldn't be filed (" + str(exc)[:200] + ")")
        if errors[email["id"]] >= 3:
            seen[email["id"]] = {"at": now, "outcome": "failed", "note": str(exc)[:200], "print": email.get("print") or ""}
            _item("Couldn't take a bill from email: " + email["subject"],
                  bk_card("save the PDF from the email and upload it into `" + BK_INBOX + "/<client>/` in Knowledge, "
                          "then complete this item. Email intake has stopped trying this one.",
                          [("Came from", bk_origin_line({"from": email["from"], "subject": email["subject"],
                                                          "received": email["received"], "mailbox": mailbox}, settings)),
                           ("What went wrong", "its attachment couldn't be saved, three times: " + str(exc)[:400])]))
        else:
            _hold(email)

for email in params.get("unreadable") or []:
    if time.time() - started > BUDGET_SECONDS:
        _hold(email)
        continue
    try:
        text = mail_body(provider, email["id"], email.get("preview") or "")
        slug = email.get("folder_client") or ""
        if not slug:
            slug = route_match(clients, routing, email.get("kind"), text, "", mail_sender(email.get("from")),
                               email.get("subject") or "")["slug"]
        folder = BK_INBOX + "/" + (slug or "<client>") + "/"
        attached = (" It has " + ", ".join(email.get("other") or []) + " attached, which can't be read.") if email.get("other") else (
            " It probably links to the bill online.")
        _item(("Bill with nothing to read attached" + (" (" + str((by_slug.get(slug) or {}).get("name") or slug) + ")" if slug else "")
               + ": " + str(email.get("subject") or "(no subject)")),
              bk_card("download the bill as a PDF (from the supplier's link or portal) and drop it into `" + folder
                      + "` in Knowledge, then complete this item. It's processed from there.",
                      [("Came from", bk_origin_line({"from": email["from"], "subject": email["subject"],
                                                      "received": email["received"], "mailbox": mailbox}, settings)),
                       ("Client", bk_client_label(by_slug.get(slug)) if slug else "not clear from the email"),
                       ("What happened", "it looks like a " + str(email.get("kind") or "bill") + ", but has no PDF or "
                        "photo attached." + attached)]),
              priority="medium", extra=["no-attachment"])
        seen[email["id"]] = {"at": now, "outcome": "no_attachment", "clients": [slug] if slug else [], "print": email.get("print") or ""}
        lines.append("- " + email["subject"] + " from " + email["from"] + ": **a bill with nothing to read attached**"
                     + (" for " + _client_line(slug) if slug else "") + " (a WorkQ item asks for the PDF)")
        errors.pop(email["id"], None)
    except Exception as exc:
        errors[email["id"]] = int(errors.get(email["id"]) or 0) + 1
        lines.append("- " + email["subject"] + ": couldn't be checked (" + str(exc)[:200] + ")")
        if errors[email["id"]] >= 3:
            seen[email["id"]] = {"at": now, "outcome": "failed", "note": str(exc)[:200], "print": email.get("print") or ""}
        else:
            _hold(email)

for email in params.get("requests") or []:
    if time.time() - started > BUDGET_SECONDS:
        _hold(email)
        continue
    try:
        text = mail_body(provider, email["id"], email.get("preview") or "")
        sender = mail_sender(email.get("from"))
        slug = email.get("folder_client") or ""
        why = "it's in its client's mail folder"
        if not slug:
            # A request comes from the business itself: its contact email in the client settings is the surest match.
            match = next((c for c in clients if sender and sender == str(c.get("contact_email") or "").strip().lower()), None)
            if match:
                slug, why = match["slug"], "sent by " + str(match.get("contact_name") or sender)
        if not slug:
            found = route_match(clients, routing, "invoice request", text, "", sender, email.get("subject") or "")
            slug, why = found["slug"], found["why"]
        tag = _tag(email["id"])
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
            quoted = "\n".join("> " + ln for ln in text[:1500].splitlines() if ln.strip())
            _item("Which client is this invoice request from? " + email["subject"],
                  bk_card("run **Bookkeeping: Draft requested invoice (Xero)** by hand with the client's name and the "
                          "request text below, then complete this item. Nothing has gone to Xero yet.",
                          [("Came from", bk_origin_line({"from": email["from"], "subject": email["subject"],
                                                          "received": email["received"], "mailbox": mailbox}, settings)),
                           ("Why it wasn't filed", why),
                           ("Tip", "add the sender's address as the contact email in that client's settings, and the "
                                   "next request from them is filed by itself")],
                          body="**The request**\n\n" + quoted))
            seen[email["id"]] = {"at": now, "outcome": "unmatched", "clients": [], "print": email.get("print") or ""}
            lines.append("- " + email["subject"] + " from " + email["from"] + ": **request needs a client** (" + why + ")")
        errors.pop(email["id"], None)
    except Exception as exc:
        errors[email["id"]] = int(errors.get(email["id"]) or 0) + 1
        lines.append("- " + email["subject"] + ": couldn't be filed (" + str(exc)[:200] + ")")
        if errors[email["id"]] >= 3:
            seen[email["id"]] = {"at": now, "outcome": "failed", "note": str(exc)[:200], "print": email.get("print") or ""}
        else:
            _hold(email)

if not problem:
    # Keep the ledger bounded: the newest 2000 emails are plenty to stop anything being filed twice.
    keep = sorted(seen.items(), key=lambda kv: str((kv[1] or {}).get("at") or ""))[-2000:]
    bk_write_json(ledger_path, {"since": ledger.get("since") or params.get("since") or now, "cursors": cursors,
                                "seen": dict(keep), "errors": errors})
    if routing_changed:
        bk_write_json(BK_ROUTING, routing)

summary = (problem or ("Filed " + str(filed) + " bill(s) or invoice(s) and " + str(requested) + " invoice request(s); "
                       + str(unmatched) + " need a client; "
                       + str(len(params.get("skipped") or [])) + " email(s) left alone."
                       + ("\n\n" + "\n".join(lines) if lines else "")))
