# Process bill saves the parts of a split PDF here; moving them into the inbox starts Process bill for each one.
BK_SPLIT = "Bookkeeping Split"

path = str(params.get("path") or "").replace("\\", "/").strip("/")
parts = path.split("/")
moved_to = ""
if len(parts) == 3 and parts[0] == BK_SPLIT and parts[2].lower().endswith(".pdf") and not parts[2].startswith("_"):
    moved_to = bk_move(path, BK_INBOX + "/" + parts[1] + "/" + parts[2])
