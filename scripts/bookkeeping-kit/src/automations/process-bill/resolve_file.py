from PIL import Image, ImageOps
from pypdf import PdfReader, PdfWriter

MATCH_PROMPT = (
    "A bookkeeping practice keeps the books for the client businesses listed in 'clients'. A document was dropped into "
    "its inbox without saying which client it's for. Which one does it belong to? For a supplier bill it is the "
    "business the bill is addressed to (the 'Bill to', 'Invoice to', customer or account name); for a sales invoice it "
    "is the business that issued it (the letterhead and ABN at the top); for a bank or credit card statement it is the "
    "account holder; for a statement of account it is the business it is addressed to (or, if the business sent it, "
    "the business that issued it). The document is 'text', or the attached scan or photo when there's no text. Compare "
    "names, trading names and ABNs, ignoring Pty Ltd and punctuation. Answer with that client's slug, or an empty slug "
    "when none of them matches or you aren't sure."
)
MATCH_HINT = '{"client_slug": "acme-plumbing", "addressed_to": "Acme Plumbing Pty Ltd", "confidence": "high", "reason": ""}'
PHOTO_TYPES = (".jpg", ".jpeg", ".png")

path = str(params.get("path") or "").replace("\\", "/").strip("/")
parts = path.split("/")
should_process = False
client_folder = ""
file_name = ""
skip_reason = ""


def _clients():
    out = []
    for f in api.files.list(path=BK_CLIENTS):
        if f.get("kind") == "file" and str(f.get("path", "")).endswith(".json"):
            c = bk_read_json(f["path"]) or {}
            if c.get("slug") and c.get("xero_tenant_id"):
                out.append(c)
    return out


def _photo_to_pdf(photo_path):
    """A photo of a bill becomes a one-page PDF beside it (the photo is removed), so it's attached in Xero and filed
    like any other PDF; the AI reads it from the image. The original path when it can't be converted."""
    try:
        img = ImageOps.exif_transpose(Image.open(api.files.get(file=photo_path))).convert("RGB")
        img.thumbnail((2000, 2000))  # the AI reads at most about 1,600 pixels a side
        name = photo_path.split("/")[-1].rsplit(".", 1)[0] + " (photo).pdf"
        local = api.files.scratch_path(name)
        img.save(local, "PDF", resolution=150)
        dest = photo_path.rsplit("/", 1)[0] + "/" + name
        api.files.put(file=dest, scratch_file=local)
        api.files.delete(file=photo_path)
        return dest
    except Exception:
        return photo_path


def _which_client(clients):
    """(slug, why) for a file dropped straight into the inbox; slug is "" when it can't be placed with confidence."""
    if len(clients) == 1:
        return clients[0]["slug"], "the only client"
    local = api.files.get(file=path)
    text = ""
    try:
        text = "\n".join((page.extract_text() or "") for page in PdfReader(local).pages[:3])
    except Exception:
        text = ""
    exc = None  # the platform lint wants names bound before `except ... as`
    ask = {"clients": [{"slug": c["slug"], "name": c.get("name"), "xero_org_name": c.get("xero_org_name")} for c in clients],
           "file_name": parts[-1], "text": text[:6000]}
    try:
        if len(text.strip()) < 40:
            # A scan or a photo: the AI reads the page itself (the first one is enough to see who it's for).
            guess = api.ai.extract(prompt=MATCH_PROMPT, input=json.dumps(ask), schema_hint=MATCH_HINT,
                                   scratch_file=_first_page(local))
        else:
            guess = api.ai.extract(prompt=MATCH_PROMPT, input=json.dumps(ask), schema_hint=MATCH_HINT)
    except Exception as exc:
        return "", "the AI couldn't read it (" + str(exc)[:150] + ")"
    guess = guess if isinstance(guess, dict) else {}
    slug = str(guess.get("client_slug") or "")
    if slug in {c["slug"] for c in clients} and str(guess.get("confidence") or "").lower() != "low":
        return slug, "it's for " + str(guess.get("addressed_to") or slug)
    return "", ("the AI couldn't tell which client it's for" + (" (it names " + str(guess["addressed_to"]) + ")"
                                                                 if guess.get("addressed_to") else ""))


def _first_page(local):
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


name_lower = parts[-1].lower()
if parts[0] != BK_INBOX or len(parts) not in (2, 3):
    skip_reason = "not a file in " + BK_INBOX
elif parts[-1].startswith("_") or not (name_lower.endswith(".pdf") or name_lower.endswith(PHOTO_TYPES)):
    skip_reason = "not a PDF or a photo of a bill"
else:
    if name_lower.endswith(PHOTO_TYPES):
        path = _photo_to_pdf(path)
        parts = path.split("/")
    if len(parts) == 3:
        should_process = True
        client_folder = parts[1]
        file_name = parts[2]
    else:
        # Dropped straight into Bookkeeping Inbox instead of a client's folder. It's read where it is: moving it into
        # the client's folder wouldn't start this automation again (an automation's own files don't re-trigger it).
        settings = bk_read_json(BK_SETTINGS) or {}
        clients = _clients() if settings else []
        if not clients:
            skip_reason = "dropped into " + BK_INBOX + " itself, and no client is set up yet"
        else:
            slug, why = _which_client(clients)
            if slug:
                should_process = True
                client_folder = slug
                file_name = parts[1]
            else:
                dest = BK_FAILED + "/unmatched/" + parts[1]
                try:
                    bk_move(path, dest)
                except Exception:
                    dest = path
                owner = bk_exceptions_owner(settings, {})
                today = bk_today(settings)
                api.workq.create(
                    title=("Which client is this for? " + parts[1])[:200],
                    scope="org",
                    description=("`" + parts[1] + "` was dropped into `" + BK_INBOX + "` itself rather than a client's "
                                 "folder, and " + why + ", so it wasn't processed.\n\n- File: `" + dest + "` in Knowledge\n\n"
                                 "Move it into `" + BK_INBOX + "/<client>/` in Knowledge and it's processed from there. "
                                 "Then complete this item."),
                    priority="high",
                    due_date=str(bk_add_business_days(today, 1)),
                    assignee_ids=[owner] if owner else None,
                    labels=["bookkeeping", "bill-exception"],
                )
                skip_reason = "dropped into " + BK_INBOX + " itself and " + why
