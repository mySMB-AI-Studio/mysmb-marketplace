# ── bookkeeping kit: mailbox adapter (inlined into email-intake nodes by gen-ext.js) ──
# Reads the automation owner's own mailbox (Outlook through m365-mail-read, a personal Hotmail / Outlook.com account
# through hotmail-mail, Gmail through google-workspace-gmail) or a shared Outlook mailbox (m365-mail-shared).
# Read-only: nothing in the mailbox is changed, so emails that aren't bills stay exactly as they were.
import base64
import hashlib
import html

MAIL_SERVER = {"outlook": "m365-mail-read", "outlook-shared": "m365-mail-shared", "hotmail": "hotmail-mail",
               "gmail": "google-workspace-gmail"}
MAIL_FIRST_RUN_HOURS = 24
# Emails handled per run (oldest first); the rest wait for the next run, which starts where this one stopped.
MAIL_PER_RUN = 20
MAIL_TRIAGE_BATCH = 10
MAIL_PHOTO_MIN_BYTES = 30000
MAIL_PHOTO_TYPES = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff", ".heic", ".heif")
MAIL_PHOTO_MIMES = ("image/jpeg", "image/png", "image/webp", "image/gif", "image/tiff", "image/heic", "image/heif")
MAIL_GMAIL_PAGES = 10
# Outlook/Hotmail pages read past a full page of emails already handled (see mail_list).
MAIL_OUTLOOK_PAGES = 10
# The shared mailbox the outlook-shared intake reads (set by the node from the Bookkeeping settings).
MAIL_MAILBOX = {"address": ""}


def mail_call(provider, tool, **args):
    if provider == "outlook-shared":
        args["mailbox"] = MAIL_MAILBOX["address"]
    return api.connectors.invoke(server=MAIL_SERVER[provider], tool=tool, args=args)


def mail_is_outlook(provider):
    """Outlook-shaped (Microsoft Graph): a work Outlook mailbox, a shared one, or a personal Hotmail / Outlook.com one.
    hotmail-mail has the same tools and answers as m365-mail-read, without shared mailboxes."""
    return provider in ("outlook", "outlook-shared", "hotmail")


def mail_addr(value):
    """Outlook sends {"emailAddress": {"name", "address"}}; Gmail sends "Name <address>"."""
    if isinstance(value, dict):
        e = value.get("emailAddress") or value
        name = str(e.get("name") or "").strip()
        addr = str(e.get("address") or "").strip()
        return (name + " <" + addr + ">").strip() if addr else name
    return str(value or "").strip()


def mail_when(value):
    """An ISO timestamp or epoch (s or ms) as an aware datetime; None when it can't be read."""
    s = str(value or "").strip()
    if not s:
        return None
    if s.isdigit():
        try:
            return datetime.datetime.fromtimestamp(int(s) / (1000 if len(s) > 11 else 1), datetime.timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    try:
        d = datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=datetime.timezone.utc)


def mail_iso(when):
    return when.astimezone(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def mail_is_pdf(att):
    name = str(att.get("name") or att.get("filename") or "").lower()
    ctype = str(att.get("contentType") or att.get("mimeType") or "").lower()
    return ((name.endswith(".pdf") or ctype == "application/pdf") and not att.get("isInline")
            and str(att.get("kind") or "file") == "file")


def mail_is_photo(att):
    """A photographed bill: an image file attachment (JPEG, PNG, WebP, GIF, TIFF or an iPhone's HEIC), big enough not to
    be a logo or a signature image."""
    name = str(att.get("name") or att.get("filename") or "").lower()
    ctype = str(att.get("contentType") or att.get("mimeType") or "").lower()
    return ((name.endswith(MAIL_PHOTO_TYPES) or ctype in MAIL_PHOTO_MIMES) and not att.get("isInline")
            and str(att.get("kind") or "file") == "file" and int(att.get("size") or 0) >= MAIL_PHOTO_MIN_BYTES)


def mail_print(m):
    """A fingerprint of an email that survives it being moved: Outlook gives a moved email a new id, but the sender,
    subject and time received stay the same. Empty when the time received is missing, so distinct emails with the
    same subject (a supplier's monthly "Invoice") are never mistaken for one another."""
    when = mail_when(m.get("received"))
    if not when:
        return ""
    key = "|".join([mail_sender(m.get("from")), re.sub(r"\s+", " ", str(m.get("subject") or "")).strip().lower(),
                    when.astimezone(datetime.timezone.utc).replace(microsecond=0).isoformat()])
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]


def mail_folders(settings, clients):
    """The folders (Outlook) or labels (Gmail) to read: the Inbox, the practice's extra ones, and each client's own
    folder, as [(folder, client slug or "")]. A folder that is also a client's is that client's."""
    out = {"inbox": ("inbox", "")}
    for f in ((settings or {}).get("intake") or {}).get("folders") or []:
        f = str(f or "").strip().strip("/")
        if f and f.lower() not in out:
            out[f.lower()] = (f, "")
    for c in clients:
        f = str(c.get("mail_folder") or "").strip().strip("/")
        if f:
            out[f.lower()] = (f, c["slug"])
    return list(out.values())


def mail_gmail_labels(provider):
    """Gmail label names (lower-cased) to label ids."""
    rows = mail_call(provider, "list_labels")
    rows = rows.get("labels") if isinstance(rows, dict) else rows
    return {str(r.get("name") or "").lower(): str(r.get("id")) for r in rows or [] if isinstance(r, dict) and r.get("id")}


def mail_list(provider, folder, after, labels=None, known=None):
    """The folder's emails received after `after` (an aware datetime), oldest first, as
    [{id, subject, from, received, preview, has_attachments, print}]. Requests to raise an invoice usually have no
    attachment, so every email is a candidate; triage decides. `known` holds the ids already handled."""
    out = []
    if mail_is_outlook(provider):
        # The connector filters and sorts (receivedAfter + oldestFirst), so the first page is the next batch however
        # much mail arrived. One second earlier than the cursor: emails received in the same second are listed again
        # and skipped by the ledger, rather than missed. A full page of emails already handled (more than a page
        # received in one second, say) would then come back every run and stall the folder, so it's read past with
        # `skip`; a connector without `skip` returns the same page again, which ends the paging.
        since = mail_iso(after - datetime.timedelta(seconds=1))
        skip = 0
        last_ids = None
        listed = set()
        for _ in range(MAIL_OUTLOOK_PAGES):
            args = {"folder": folder, "limit": 50, "receivedAfter": since, "oldestFirst": True}
            if skip:
                args["skip"] = skip
            rows = mail_call(provider, "list_emails", **args)
            if isinstance(rows, dict):
                rows = rows.get("value") or rows.get("emails") or rows.get("messages") or []
            page = [m for m in rows or [] if isinstance(m, dict) and m.get("id")]
            ids = [str(m["id"]) for m in page]
            if ids == last_ids:
                break
            last_ids = ids
            for m in page:
                if str(m["id"]) in listed:
                    continue
                listed.add(str(m["id"]))
                out.append({"id": str(m["id"]), "subject": str(m.get("subject") or ""), "from": mail_addr(m.get("from")),
                            "received": str(m.get("receivedDateTime") or ""),
                            "preview": str(m.get("bodyPreview") or "")[:1500],
                            "has_attachments": bool(m.get("hasAttachments"))})
            if len(page) < 50 or any(i not in (known or {}) for i in ids):
                break
            skip += len(page)
    else:
        label = "INBOX" if folder.lower() == "inbox" else (labels or {}).get(folder.lower())
        if not label:
            raise RuntimeError("there's no Gmail label called " + folder)
        # Gmail lists newest first, so read every page since the cursor (one second early, as above).
        q = "after:" + str(int(after.timestamp()) - 1)
        token = None
        for _ in range(MAIL_GMAIL_PAGES):
            args = {"labelIds": [label], "maxResults": 50, "q": q}
            if token:
                args["pageToken"] = token
            res = mail_call(provider, "list_messages", **args)
            rows = res.get("messages") if isinstance(res, dict) else res
            for m in rows or []:
                if isinstance(m, dict) and m.get("id"):
                    out.append({"id": str(m["id"]), "subject": str(m.get("subject") or ""), "from": mail_addr(m.get("from")),
                                "received": str(m.get("internalDate") or m.get("date") or m.get("timestamp") or ""),
                                "preview": str(m.get("snippet") or "")[:1500],
                                # list_messages has no attachment flag; get_message (in mail_attachments) says.
                                "has_attachments": True})
            token = res.get("nextPageToken") if isinstance(res, dict) else None
            if not token:
                break
    for m in out:
        m["print"] = mail_print(m)
        when = mail_when(m["received"])
        m["at"] = when.timestamp() if when else 0
    # Oldest first, and only after the cursor (a connector that ignores receivedAfter still works, just less far back).
    return sorted([m for m in out if m["at"] == 0 or m["at"] > after.timestamp() - 1], key=lambda m: m["at"])


def mail_body(provider, msg_id, fallback=""):
    """The email's text: Outlook's full body (HTML reduced to text); for Gmail the snippet, all its connector returns."""
    if not mail_is_outlook(provider):
        return fallback
    msg = mail_call(provider, "get_email", id=msg_id)
    body = msg.get("body") if isinstance(msg, dict) else None
    text = str(body.get("content") or "") if isinstance(body, dict) else ""
    if "<" in text and ">" in text:
        text = re.sub(r"(?is)<(script|style)[^>]*>.*?</(script|style)>", " ", text)
        text = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</tr>|</li>|</h[1-6]>", "\n", text)
        text = html.unescape(re.sub(r"<[^>]+>", " ", text))
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text).strip()
    return text[:8000] or fallback


def mail_sender(value):
    """The address in "Name <address>" (or a bare address), lower-cased."""
    m = re.search(r"[\w.+'-]+@[\w-]+(\.[\w-]+)+", str(value or ""))
    return m.group(0).lower() if m else ""


def mail_attachments(provider, msg_id):
    """The email's file attachments: {"pdfs": [...], "photos": [...], "other": [names]}, each pdf or photo as
    {id, name, size}. Photos (a bill photographed on a phone) count only when there's no PDF, so a logo or a picture of
    the job sent with an invoice isn't read as a bill. "other" names attachments that can't be read (Word, Excel…)."""
    if mail_is_outlook(provider):
        rows = mail_call(provider, "list_email_attachments", id=msg_id)
        if isinstance(rows, dict):
            rows = rows.get("attachments") or rows.get("value") or []
        rows = [{"id": str(a["id"]), "name": str(a.get("name") or ""), "size": a.get("size") or 0, "raw": a}
                for a in rows or [] if isinstance(a, dict) and a.get("id")]
    else:
        msg = mail_call(provider, "get_message", id=msg_id)
        rows = [{"id": str(a["attachmentId"]), "name": str(a.get("filename") or ""), "size": a.get("size") or 0, "raw": a}
                for a in (msg.get("attachments") if isinstance(msg, dict) else []) or []
                if isinstance(a, dict) and a.get("attachmentId")]
    pdfs = [{"id": r["id"], "name": r["name"] or "bill.pdf", "size": r["size"]} for r in rows if mail_is_pdf(r["raw"])]
    photos = [{"id": r["id"], "name": r["name"] or "photo.jpg", "size": r["size"]} for r in rows if mail_is_photo(r["raw"])]
    other = [r["name"] for r in rows if r["name"] and not mail_is_pdf(r["raw"]) and not mail_is_photo(r["raw"])
             and not r["raw"].get("isInline") and str(r["raw"].get("kind") or "file") == "file"
             and not str(r["raw"].get("contentType") or r["raw"].get("mimeType") or "").lower().startswith("image/")]
    return {"pdfs": pdfs, "photos": [] if pdfs else photos, "other": other}


def mail_is_heic(data):
    """An iPhone HEIC/HEIF photo, by its bytes (an ISO-BMFF ftyp box with a HEIF brand)."""
    return len(data) >= 12 and data[4:8] == b"ftyp" and data[8:12].lower() in (
        b"heic", b"heix", b"hevc", b"hevx", b"heim", b"heis", b"hevm", b"hevs", b"mif1", b"msf1")


def mail_download(provider, msg_id, att, dest, photo=False):
    """Save one attachment's bytes to the scratch path `dest`: {"size", "name", "heic"}. A photo is asked for as a JPEG,
    so an iPhone's HEIC comes back converted (name ends .jpg); "heic" is true when it still arrived as HEIC."""
    tool = "get_email_attachment" if mail_is_outlook(provider) else "get_attachment"
    args = {"messageId": msg_id, "attachmentId": att["id"]}
    if photo:
        args["heicToJpeg"] = True
    res = mail_call(provider, tool, **args)
    data = base64.b64decode(str((res or {}).get("contentBase64") or "")) if isinstance(res, dict) else b""
    if not data:
        raise RuntimeError("the attachment came back empty")
    with open(dest, "wb") as fh:
        fh.write(data)
    name = att["name"]
    if isinstance(res, dict) and res.get("convertedFrom"):
        name = str(res.get("name") or "") or (re.sub(r"\.(heic|heif)$", "", name, flags=re.I) + ".jpg")
    return {"size": len(data), "name": name, "heic": mail_is_heic(data)}


def mail_seen_prints():
    """Fingerprints of every email any intake has handled, so one copied to two mailboxes is filed once."""
    prints = set()
    for provider in MAIL_SERVER:
        for v in ((bk_read_json(BK_MAIL + "/" + provider + ".json") or {}).get("seen") or {}).values():
            if isinstance(v, dict) and v.get("print"):
                prints.add(str(v["print"]))
    return prints


def mail_shared_mailbox(settings):
    return str(((settings or {}).get("intake") or {}).get("shared_mailbox") or "").strip()
