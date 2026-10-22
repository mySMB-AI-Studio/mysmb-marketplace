# ── bookkeeping kit: shared helpers (inlined into each node by gen-ext.js) ──
import json
import re
import datetime
import hashlib
from zoneinfo import ZoneInfo

# Knowledge layout. Folders may nest at most 2 levels, so inbox folders are top-level.
BK_SETTINGS = "Bookkeeping/settings.json"
BK_CLIENTS = "Bookkeeping/Clients"
BK_RULES = "Bookkeeping/Rules"
BK_BILLS = "Bookkeeping/Bills"
BK_INBOX = "Bookkeeping Inbox"
BK_PROCESSED = "Bookkeeping Processed"
BK_FAILED = "Bookkeeping Failed"
BK_MAIL = "Bookkeeping/Mail"
BK_REQUESTS = "Bookkeeping Requests"
BK_CHECKS = "Bookkeeping/Checks"
# One threshold for "needs a tax invoice / an ABN / an attachment": $75 excluding GST = $82.50 including GST.
BK_GST_INVOICE_LIMIT = 82.5


def bk_slug(name):
    s = re.sub(r"[^a-z0-9]+", "-", str(name or "").lower()).strip("-")
    return s[:40].strip("-") or "client"


def bk_read_json(path, default=None):
    try:
        raw = api.files.read(file=path)
    except Exception:
        return default
    try:
        return json.loads(raw)
    except Exception:
        return default


def bk_write_json(path, data):
    api.files.put(file=path, content=json.dumps(data, indent=2, sort_keys=True))


def bk_money(value):
    """Parse 1234.5, "1,234.50", "$12" or "A$ 12.00" into a float; None when blank or not a number."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = re.sub(r"[^0-9.\-]", "", str(value))
    if s in ("", "-", ".", "-."):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def bk_fmt(amount, currency=""):
    if amount is None:
        return "—"
    return (currency + " " if currency else "") + "{:,.2f}".format(amount)


def bk_tz(settings):
    # The sandbox may lack the tz database; fall back to AEST (UTC+10) rather than failing the run.
    try:
        return ZoneInfo((settings or {}).get("timezone") or "Australia/Sydney")
    except Exception:
        return datetime.timezone(datetime.timedelta(hours=10))


def bk_today(settings):
    return datetime.datetime.now(bk_tz(settings)).date()


def bk_now_iso(settings):
    return datetime.datetime.now(bk_tz(settings)).replace(microsecond=0).isoformat()


def bk_add_business_days(day, n):
    d = day
    while n > 0:
        d = d + datetime.timedelta(days=1)
        if d.weekday() < 5:
            n -= 1
    return d


def bk_abn_valid(abn):
    digits = re.sub(r"\D", "", str(abn or ""))
    if len(digits) != 11:
        return False
    weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
    nums = [int(c) for c in digits]
    nums[0] -= 1
    return sum(w * n for w, n in zip(weights, nums)) % 89 == 0


def bk_norm(name):
    s = re.sub(r"[^a-z0-9 ]+", " ", str(name or "").lower())
    s = re.sub(r"\b(pty|ltd|limited|p/l|the|inc|co)\b", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def bk_answer(responses, qid):
    """A form answer: str, bool, list, or a lookup {id, label}."""
    return (responses or {}).get(qid)


def bk_lookup_id(value):
    if isinstance(value, dict):
        return value.get("id") or None
    return None


def bk_lookup_label(value):
    if isinstance(value, dict):
        return value.get("label") or ""
    return ""


def bk_move(src, dst):
    """Move a knowledge file (binary-safe): copy through the run's scratch space, then delete the source."""
    local = api.files.get(file=src)
    with open(local, "rb") as fh:
        data = fh.read()
    scratch = api.files.scratch_path(dst.split("/")[-1])
    with open(scratch, "wb") as fh:
        fh.write(data)
    api.files.put(file=dst, scratch_file=scratch)
    api.files.delete(file=src)
    return dst


def bk_images_pdf(paths, out):
    """Photos of a bill (JPEG, PNG, WebP, GIF or TIFF; every page of a multi-page TIFF) as one PDF at `out`, a page per
    image in order, turned upright and sized for the AI, which reads at most about 1,600 pixels a side (and 20 pages).
    Raises when none can be opened."""
    from PIL import Image, ImageOps, ImageSequence
    pages = []
    for p in paths:
        img = Image.open(p)
        frames = list(ImageSequence.Iterator(img)) if str(img.format or "").upper() == "TIFF" else [img]
        for frame in frames:
            page = ImageOps.exif_transpose(frame.copy()).convert("RGB")
            page.thumbnail((2000, 2000))
            pages.append(page)
    pages = pages[:20]
    if not pages:
        raise ValueError("no images")
    pages[0].save(out, "PDF", resolution=150, save_all=True, append_images=pages[1:])
    return out


def bk_client_for(settings, slug):
    client = bk_read_json(BK_CLIENTS + "/" + slug + ".json")
    if not client:
        return None
    return client


def bk_reviewer(settings, client):
    return (client or {}).get("reviewer_id") or (settings or {}).get("reviewer_id")


def bk_checks_owner(settings, client):
    """Who follows up a client's ledger checks findings: the client's own, the practice default, then the reviewer."""
    return (client or {}).get("checks_owner_id") or (settings or {}).get("checks_owner_id") or bk_reviewer(settings, client)


def bk_exceptions_owner(settings, client):
    return (settings or {}).get("exceptions_owner_id") or bk_reviewer(settings, client)


def bk_card(todo, facts=None, body="", answers=None, after=""):
    """A WorkQ item's description, in the same order on every item: what to do (first, so it's never missed), then the
    facts (where it came from, which client and Xero organisation, the file), the details, what each answer on the form
    does, and anything after. facts and answers are [(label, text)]; empty texts are left out. Lists, not tables:
    WorkQ descriptions don't render markdown tables."""
    out = ["**What to do:** " + str(todo).strip(), ""]
    rows = [(k, v) for k, v in (facts or []) if v]
    if rows:
        out += ["- **" + k + ":** " + str(v) for k, v in rows]
        out.append("")
    if body:
        out += [str(body).strip(), ""]
    rows = [(k, v) for k, v in (answers or []) if v]
    if rows:
        out += ["**What each answer does**", ""] + ["- **" + k + ":** " + str(v) for k, v in rows] + [""]
    if after:
        out.append(str(after).strip())
    return "\n".join(out).strip()


def bk_when(value, settings=None):
    """An ISO time (an email's time received) as "Wed 22 Oct, 10:14 am" in the practice's time zone, or the text as
    given when it isn't one."""
    s = str(value or "").strip()
    if not s:
        return ""
    try:
        if s.isdigit():
            # Gmail gives epoch milliseconds.
            d = datetime.datetime.fromtimestamp(int(s) / (1000 if len(s) > 11 else 1), datetime.timezone.utc)
        else:
            d = datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))
    except (ValueError, OverflowError, OSError):
        return s
    if d.tzinfo:
        d = d.astimezone(bk_tz(settings))
    return (d.strftime("%a ") + str(d.day) + d.strftime(" %b, ") + str(d.hour % 12 or 12) + d.strftime(":%M ")
            + ("am" if d.hour < 12 else "pm"))


def bk_client_label(client):
    """"Irvine Jackson Pty Ltd (Xero: Irvine Jackson Pty Ltd)": the client and the Xero organisation its documents go
    to, so a client set up against the wrong organisation is plain to see."""
    c = client or {}
    name = str(c.get("name") or c.get("slug") or "")
    org = str(c.get("xero_org_name") or "")
    return (name + " (Xero: " + org + ")") if org else name


def bk_origin(file_name):
    """Where a document in Bookkeeping Inbox came from: what Email intake noted when it filed it ({from, subject,
    received, mailbox, why, how}), or {} for a file someone put there by hand."""
    log = bk_read_json(BK_MAIL + "/origins.json") or {}
    return dict(log.get(str(file_name or "").split("/")[-1]) or {})


def bk_note_origin(file_name, origin):
    """Remember where a document came from, before it's saved into Bookkeeping Inbox (saving it starts Process bill, which
    reads this). Bounded to the newest 1000."""
    path = BK_MAIL + "/origins.json"
    log = bk_read_json(path) or {}
    log[str(file_name).split("/")[-1]] = dict(origin, at=datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat())
    keep = sorted(log.items(), key=lambda kv: str((kv[1] or {}).get("at") or ""))[-1000:]
    bk_write_json(path, dict(keep))


def bk_origin_line(origin, settings=None):
    """One line saying where a document came from: the email (sender, subject, when, which mailbox) or Knowledge."""
    o = origin or {}
    if o.get("from"):
        return ("Email from " + str(o["from"]) + (", \"" + str(o.get("subject")) + "\"" if o.get("subject") else "")
                + (", " + bk_when(o.get("received"), settings) if o.get("received") else "")
                + (" (" + str(o["mailbox"]) + ")" if o.get("mailbox") else ""))
    if o.get("how") == "decided":
        return "Filed under this client from a *Which client is this for?* item"
    return "Put into Knowledge (Bookkeeping Inbox) by hand"


def bk_ledger_info(ledger):
    """A ledger pack's (name, the client setting that holds the client's file in it, what that file is called, the
    client setting with its name). Xero when unset: clients and nodes from before the MYOB and QuickBooks packs are Xero's."""
    return {"myob": ("MYOB", "myob_company_file_id", "MYOB company file", "myob_file_name"),
            "quickbooks": ("QuickBooks", "qbo_company_name", "QuickBooks company", "qbo_company_name")}.get(
        str(ledger or ""), ("Xero", "xero_tenant_id", "Xero organisation", "xero_org_name"))
