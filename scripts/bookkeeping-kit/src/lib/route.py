# ── bookkeeping kit: which client a document belongs to (inlined into nodes by gen-ext.js) ──
# Used by Email intake and by Process bill for files dropped into Bookkeeping Inbox itself. The AI compares the document
# with every client's names, trading names, ABN and the names the practice has taught; when it isn't sure, a name the
# practice taught or a single client ABN printed on the document still places it. Nothing is ever guessed.
from pypdf import PdfReader, PdfWriter

BK_ROUTING = BK_MAIL + "/routing.json"
BK_UNMATCHED = BK_MAIL + "/unmatched.json"
ROUTE_PROMPT = (
    "A bookkeeping practice keeps the books for the client businesses listed in 'clients' (each with its names, the "
    "other names it trades or is billed under, and its ABN). Which one does this document belong to? For a supplier "
    "bill it is the business it is addressed to (the 'Bill to', 'Invoice to', customer or account name, which may be "
    "one of its other names or its owner's name); for a sales invoice ('kind' says which) it is the business that "
    "issued it (the letterhead and ABN at the top); for an invoice request it is the business asking the bookkeeper to "
    "raise an invoice, usually the sender; for a bank or credit card statement it is the account holder; for a "
    "statement of account it is the business it is addressed to (or, if the business sent it, the business that "
    "issued it). Compare names, other names and ABNs, ignoring Pty Ltd and punctuation. 'sender_history' says which "
    "clients earlier documents from this sender belonged to: a hint, not proof, since one supplier bills many clients. "
    "Answer with that client's slug, or an empty slug when none of them matches or you aren't sure. Also say what the "
    "document itself is: \"bill or invoice\" (a supplier bill, tax invoice or receipt for a purchase, or a sales "
    "invoice), \"statement\" (bank, credit card or statement of account), \"invoice request\", or \"other\" (terms and "
    "conditions, a remittance advice, a quote, a purchase order, a brochure, a timesheet, a photo of a job, a logo)."
)
ROUTE_HINT = ('{"document": "bill or invoice", "client_slug": "acme-plumbing", "addressed_to": "Acme Plumbing Pty Ltd", '
              '"confidence": "high", "reason": ""}')


def route_clients():
    """Every client set up with a Xero organisation."""
    out = []
    for f in api.files.list(path=BK_CLIENTS):
        if f.get("kind") == "file" and str(f.get("path", "")).endswith(".json"):
            c = bk_read_json(f["path"]) or {}
            if c.get("slug") and c.get("xero_tenant_id"):
                out.append(c)
    return out


def route_abns(text):
    """Every valid ABN printed in the text (11 digits, spaced like 51 824 753 556 or not)."""
    found = []
    for m in re.finditer(r"(?<!\d)(\d{2} ?\d{3} ?\d{3} ?\d{3})(?!\d)", str(text or "")):
        abn = re.sub(r"\D", "", m.group(1))
        if bk_abn_valid(abn) and abn not in found:
            found.append(abn)
    return found


def route_names(client, routing):
    """The names a client's documents may be addressed to, normalised: its own, its Xero organisation's, its other
    names from the client settings, and the names the practice taught by filing an unmatched document."""
    names = ([client.get("name"), client.get("xero_org_name")] + list(client.get("org_names") or [])
             + list(client.get("aliases") or []))
    names += [n for n, slug in ((routing or {}).get("names") or {}).items() if slug == client.get("slug")]
    out = []
    for n in names:
        key = bk_norm(n)
        if key and key not in out:
            out.append(key)
    return out


def route_match(clients, routing, kind, text, local="", sender="", subject="", classify=False):
    """Who a document belongs to: {"slug", "why", "addressed_to", "document"}. slug is "" when it can't be placed with
    confidence. local is the scratch file (a scan or photo is read from the image when the text is too short); with
    classify, the AI is asked even for a practice with one client, to say what the document is."""
    slugs = {c["slug"] for c in clients}
    if len(clients) == 1 and not classify:
        return {"slug": clients[0]["slug"], "why": "the only client", "addressed_to": "", "document": ""}
    history = ((routing or {}).get("senders") or {}).get(str(sender or "").lower()) or {}
    ask = json.dumps({
        "clients": [{"slug": c["slug"], "names": [c.get("name"), c.get("xero_org_name")] + list(c.get("org_names") or []),
                     "other_names": list(c.get("aliases") or []) + [n for n, s in ((routing or {}).get("names") or {}).items()
                                                                     if s == c["slug"]],
                     "abn": c.get("abn") or ""} for c in clients],
        "sender": sender, "subject": subject, "kind": kind or "supplier bill",
        "sender_history": history, "text": str(text or "")[:6000]})
    limit = 10 if "request" in str(kind or "") else 40
    exc = None  # the platform lint wants names bound before `except ... as`
    try:
        if len(str(text or "").strip()) >= limit:
            guess = api.ai.extract(prompt=ROUTE_PROMPT, input=ask, schema_hint=ROUTE_HINT)
        elif local:
            # A scan or a photo: the AI reads the page itself.
            guess = api.ai.extract(prompt=ROUTE_PROMPT, input=ask, schema_hint=ROUTE_HINT, scratch_file=route_first_page(local))
        else:
            return {"slug": "", "why": "there's no text to go on", "addressed_to": "", "document": ""}
    except Exception as exc:
        return {"slug": "", "why": "the AI couldn't read it (" + str(exc)[:150] + ")", "addressed_to": "", "document": ""}
    guess = guess if isinstance(guess, dict) else {}
    addressed = str(guess.get("addressed_to") or guess.get("bill_to") or "")
    document = str(guess.get("document") or "").lower()
    slug = str(guess.get("client_slug") or "")
    if len(clients) == 1:
        return {"slug": clients[0]["slug"], "why": "the only client", "addressed_to": addressed, "document": document}
    if slug in slugs and str(guess.get("confidence") or "").lower() != "low":
        how = "issued by " if "sales" in str(kind or "") else "requested by " if "request" in str(kind or "") else "addressed to "
        return {"slug": slug, "why": how + (addressed or "that client"), "addressed_to": addressed, "document": document}
    # The AI wasn't sure: a name the practice taught (or a trading name) is still a match, then a single client ABN.
    key = bk_norm(addressed)
    named = [c for c in clients if key and key in route_names(c, routing)]
    if len(named) == 1:
        return {"slug": named[0]["slug"], "why": "addressed to " + addressed + ", a name of " + str(named[0].get("name")),
                "addressed_to": addressed, "document": document}
    printed = set(route_abns(text))
    by_abn = [c for c in clients if c.get("abn") and c["abn"] in printed]
    if len(by_abn) == 1:
        return {"slug": by_abn[0]["slug"], "why": "its ABN " + by_abn[0]["abn"] + " is on the document",
                "addressed_to": addressed, "document": document}
    return {"slug": "", "why": "the AI couldn't tell which client it's for" + (" (it names " + addressed + ")" if addressed else ""),
            "addressed_to": addressed, "document": document}


def route_first_page(local):
    """What the AI looks at to place a scan or a photo: the photo itself, or a scanned PDF's first page."""
    if not local.lower().endswith(".pdf"):
        return local
    try:
        reader = PdfReader(local)
        if len(reader.pages) <= 1:
            return local
        writer = PdfWriter()
        writer.add_page(reader.pages[0])
        out = api.files.scratch_path("first-page.pdf")
        writer.write(out)
        return out
    except Exception:
        return local


def route_note_unmatched(file_name, addressed_to, sender, subject):
    """Remember an unplaced document, so when someone files it under a client the practice's answer is learned."""
    log = bk_read_json(BK_UNMATCHED) or {}
    log[file_name] = {"addressed_to": addressed_to, "sender": str(sender or "").lower(), "subject": subject,
                      "at": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()}
    keep = sorted(log.items(), key=lambda kv: str((kv[1] or {}).get("at") or ""))[-500:]
    bk_write_json(BK_UNMATCHED, dict(keep))


def route_learn(file_name, slug):
    """A document that couldn't be placed was filed under a client by hand: the name it was addressed to now belongs to
    that client, and its sender counts towards that client. Returns what was learned ("" when the file wasn't one)."""
    log = bk_read_json(BK_UNMATCHED) or {}
    entry = log.pop(file_name, None)
    if not entry:
        return ""
    routing = bk_read_json(BK_ROUTING) or {}
    learned = ""
    if bk_norm(entry.get("addressed_to")):
        routing.setdefault("names", {})[str(entry["addressed_to"]).strip()] = slug
        learned = "documents addressed to " + str(entry["addressed_to"]).strip() + " are for " + slug
    route_count_sender(routing, entry.get("sender"), slug)
    bk_write_json(BK_ROUTING, routing)
    bk_write_json(BK_UNMATCHED, log)
    return learned


def route_count_sender(routing, sender, slug):
    """Count a document from this sender for this client (the AI's sender_history hint)."""
    sender = str(sender or "").lower()
    if not sender or not slug:
        return
    per = routing.setdefault("senders", {}).setdefault(sender, {})
    per[slug] = int(per.get(slug) or 0) + 1
