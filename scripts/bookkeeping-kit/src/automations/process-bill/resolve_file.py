from pypdf import PdfReader

PHOTO_TYPES = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff")
# iPhone photos: nothing here can open them, so Read the document explains what to do (Email intake converts them).
HEIC_TYPES = (".heic", ".heif")

path = str(params.get("path") or "").replace("\\", "/").strip("/")
parts = path.split("/")
should_process = False
client_folder = ""
file_name = ""
skip_reason = ""
learned = ""


def _photo_to_pdf(photo_path):
    """A photo of a bill becomes a one-page PDF beside it (the photo is removed), so it's attached in Xero and filed
    like any other PDF; the AI reads it from the image. The original path when it can't be converted."""
    try:
        name = photo_path.split("/")[-1].rsplit(".", 1)[0] + " (photo).pdf"
        local = bk_images_pdf([api.files.get(file=photo_path)], api.files.scratch_path(name))
        dest = photo_path.rsplit("/", 1)[0] + "/" + name
        api.files.put(file=dest, scratch_file=local)
        api.files.delete(file=photo_path)
        return dest
    except Exception:
        return photo_path


def _which_client(clients):
    """(slug, why, who it names) for a file dropped straight into the inbox; slug is "" when it can't be placed."""
    local = api.files.get(file=path)
    text = ""
    try:
        text = "\n".join((page.extract_text() or "") for page in PdfReader(local).pages[:3])
    except Exception:
        text = ""
    found = route_match(clients, bk_read_json(BK_ROUTING) or {}, "", text, local, "", parts[-1])
    return found["slug"], found["why"], found.get("addressed_to") or ""


name_lower = parts[-1].lower()
if parts[0] != BK_INBOX or len(parts) not in (2, 3):
    skip_reason = "not a file in " + BK_INBOX
elif parts[-1].startswith("_") or not name_lower.endswith((".pdf",) + PHOTO_TYPES + HEIC_TYPES):
    skip_reason = "not a PDF or a photo of a bill"
else:
    if name_lower.endswith(PHOTO_TYPES):
        path = _photo_to_pdf(path)
        parts = path.split("/")
    if len(parts) == 3:
        should_process = True
        client_folder = parts[1]
        file_name = parts[2]
        # Filed here by hand after it couldn't be placed: remember who it was addressed to, for next time.
        learned = route_learn(file_name, client_folder)
    else:
        # Dropped straight into Bookkeeping Inbox instead of a client's folder. It's read where it is: moving it into
        # the client's folder wouldn't start this automation again (an automation's own files don't re-trigger it).
        settings = bk_read_json(BK_SETTINGS) or {}
        clients = route_clients() if settings else []
        if not clients:
            skip_reason = "dropped into " + BK_INBOX + " itself, and no client is set up yet"
        else:
            slug, why, names = _which_client(clients)
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
                route_note_unmatched(parts[1], names, "", "")
                owner = bk_exceptions_owner(settings, {})
                today = bk_today(settings)
                api.workq.create(
                    title=("Which client is this for? " + parts[1])[:200],
                    scope="org",
                    description=("`" + parts[1] + "` was dropped into `" + BK_INBOX + "` itself rather than a client's "
                                 "folder, and " + why + ", so it wasn't processed.\n\n- File: `" + dest + "` in Knowledge\n\n"
                                 "Move it into `" + BK_INBOX + "/<client>/` in Knowledge and it's processed from there; who it "
                                 "was addressed to is remembered, so the next one is placed by itself. Then complete this item."),
                    priority="high",
                    due_date=str(bk_add_business_days(today, 1)),
                    assignee_ids=[owner] if owner else None,
                    labels=["bookkeeping", "bill-exception"],
                )
                skip_reason = "dropped into " + BK_INBOX + " itself and " + why
