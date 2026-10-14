# ── bookkeeping kit: mailbox adapter (inlined into email-intake nodes by gen-ext.js) ──
# Reads the automation owner's own mailbox: Outlook through m365-mail-read, Gmail through google-workspace-gmail.
# Read-only: nothing in the mailbox is changed, so emails that aren't bills stay exactly as they were.
import base64
import hashlib
import html

MAIL_SERVER = {"outlook": "m365-mail-read", "gmail": "google-workspace-gmail"}
MAIL_FIRST_RUN_HOURS = 24
MAIL_PER_RUN = 10
MAIL_PHOTO_MIN_BYTES = 30000


def mail_call(provider, tool, **args):
    return api.connectors.invoke(server=MAIL_SERVER[provider], tool=tool, args=args)


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


def mail_is_pdf(att):
    name = str(att.get("name") or att.get("filename") or "").lower()
    ctype = str(att.get("contentType") or att.get("mimeType") or "").lower()
    return ((name.endswith(".pdf") or ctype == "application/pdf") and not att.get("isInline")
            and str(att.get("kind") or "file") == "file")


def mail_is_photo(att):
    """A photographed bill: a JPEG or PNG file attachment, big enough not to be a logo or a signature image."""
    name = str(att.get("name") or att.get("filename") or "").lower()
    ctype = str(att.get("contentType") or att.get("mimeType") or "").lower()
    return ((name.endswith((".jpg", ".jpeg", ".png")) or ctype in ("image/jpeg", "image/png")) and not att.get("isInline")
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


def mail_recent(provider, limit=50):
    """Newest inbox emails, as [{id, subject, from, received, preview, has_attachments, print}]. Requests to raise an invoice
    usually have no attachment, so every email is a candidate; triage decides."""
    out = []
    if provider == "outlook":
        rows = mail_call(provider, "list_emails", folder="inbox", limit=limit)
        if isinstance(rows, dict):
            rows = rows.get("value") or rows.get("emails") or rows.get("messages") or []
        for m in rows or []:
            if isinstance(m, dict) and m.get("id"):
                out.append({"id": str(m["id"]), "subject": str(m.get("subject") or ""), "from": mail_addr(m.get("from")),
                            "received": str(m.get("receivedDateTime") or ""),
                            "preview": str(m.get("bodyPreview") or "")[:1500],
                            "has_attachments": bool(m.get("hasAttachments"))})
    else:
        res = mail_call(provider, "list_messages", labelIds=["INBOX"], maxResults=limit, q="newer_than:3d")
        rows = res.get("messages") if isinstance(res, dict) else res
        for m in rows or []:
            if isinstance(m, dict) and m.get("id"):
                out.append({"id": str(m["id"]), "subject": str(m.get("subject") or ""), "from": mail_addr(m.get("from")),
                            "received": str(m.get("internalDate") or m.get("date") or m.get("timestamp") or ""),
                            "preview": str(m.get("snippet") or "")[:1500],
                            # list_messages has no attachment flag; get_message (in mail_pdfs) says.
                            "has_attachments": True})
    for m in out:
        m["print"] = mail_print(m)
    return out


def mail_body(provider, msg_id, fallback=""):
    """The email's text: Outlook's full body (HTML reduced to text); for Gmail the snippet, all its connector returns."""
    if provider != "outlook":
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


def mail_pdfs(provider, msg_id):
    """The email's PDF file attachments, as [{id, name, size}]; when it has none, its photos (a bill photographed on a
    phone). An email with a PDF keeps its photos out, so a logo or a picture of the job isn't read as a bill."""
    if provider == "outlook":
        rows = mail_call(provider, "list_email_attachments", id=msg_id)
        if isinstance(rows, dict):
            rows = rows.get("attachments") or rows.get("value") or []
        rows = [a for a in rows or [] if isinstance(a, dict) and a.get("id")]
        found = [{"id": str(a["id"]), "name": str(a.get("name") or "bill.pdf"), "size": a.get("size") or 0}
                 for a in rows if mail_is_pdf(a)]
        return found or [{"id": str(a["id"]), "name": str(a.get("name") or "photo.jpg"), "size": a.get("size") or 0}
                         for a in rows if mail_is_photo(a)]
    msg = mail_call(provider, "get_message", id=msg_id)
    rows = [a for a in (msg.get("attachments") if isinstance(msg, dict) else []) or []
            if isinstance(a, dict) and a.get("attachmentId")]
    found = [{"id": str(a["attachmentId"]), "name": str(a.get("filename") or "bill.pdf"), "size": a.get("size") or 0}
             for a in rows if mail_is_pdf(a)]
    return found or [{"id": str(a["attachmentId"]), "name": str(a.get("filename") or "photo.jpg"), "size": a.get("size") or 0}
                     for a in rows if mail_is_photo(a)]


def mail_download(provider, msg_id, att, dest):
    """Save one attachment's bytes to the scratch path `dest`; returns the size."""
    tool = "get_email_attachment" if provider == "outlook" else "get_attachment"
    res = mail_call(provider, tool, messageId=msg_id, attachmentId=att["id"])
    data = base64.b64decode(str((res or {}).get("contentBase64") or "")) if isinstance(res, dict) else b""
    if not data:
        raise RuntimeError("the attachment came back empty")
    with open(dest, "wb") as fh:
        fh.write(data)
    return len(data)
