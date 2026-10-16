provider = params["provider"]
problem = ""
candidates = []
cursors = {}
notes = []
settings = bk_read_json(BK_SETTINGS) or {}
ledger = bk_read_json(BK_MAIL + "/" + provider + ".json") or {}
now = datetime.datetime.now(datetime.timezone.utc)
# A folder read for the first time looks back a day; after that each folder carries on from its own cursor (the last
# email handled there), so nothing is skipped however many emails arrive between runs.
first_run = now - datetime.timedelta(hours=MAIL_FIRST_RUN_HOURS)
since = mail_iso(first_run)

if not settings:
    problem = "Bookkeeping isn't set up yet."
elif provider == "outlook-shared" and not mail_shared_mailbox(settings):
    problem = ("No shared mailbox is set. Add its address to the Bookkeeping setup form (Email intake), then run this "
               "again.")
else:
    MAIL_MAILBOX["address"] = mail_shared_mailbox(settings)
    seen = ledger.get("seen") or {}
    # An email moved between folders comes back with a new Outlook id (and one copied to two mailboxes has two ids);
    # its fingerprint is unchanged, so it isn't filed a second time.
    prints = mail_seen_prints()
    old = ledger.get("cursors") or {}
    labels = {}
    if not mail_is_outlook(provider):
        try:
            labels = mail_gmail_labels(provider)
        except Exception as exc:
            notes.append("Couldn't list the Gmail labels: " + str(exc)[:150])
    listed = {}
    for folder, client_slug in mail_folders(settings, route_clients()):
        key = folder.lower()
        start = mail_when(old.get(key)) or first_run
        cursors[key] = mail_iso(start)
        try:
            rows = mail_list(provider, folder, start, labels)
        except Exception as exc:
            notes.append("Couldn't read the folder " + folder + ": " + str(exc)[:200])
            continue
        for m in rows:
            # Gmail can show one email under two labels; a client's own folder decides its client.
            if m["id"] not in listed or (client_slug and not listed[m["id"]].get("folder_client")):
                listed[m["id"]] = dict(m, folder=key, folder_client=client_slug)
    fresh = []
    for m in sorted(listed.values(), key=lambda m: m["at"]):
        if m["id"] in seen or (m.get("print") and m["print"] in prints):
            continue
        fresh.append(m)
        if m.get("print"):
            prints.add(m["print"])
    # Oldest first, and a bounded batch per run; the rest are picked up by the next run.
    candidates = fresh[:MAIL_PER_RUN]
    waiting = {m["id"] for m in fresh[MAIL_PER_RUN:]}
    # Each folder's cursor moves up to the last email before the first one still waiting for a run.
    for m in sorted(listed.values(), key=lambda m: m["at"]):
        if m["id"] in waiting:
            continue
        stop = min([w["at"] for w in fresh[MAIL_PER_RUN:] if w["folder"] == m["folder"]] or [m["at"] + 1])
        if m["at"] and m["at"] < stop and m["at"] > (mail_when(cursors[m["folder"]]) or first_run).timestamp():
            cursors[m["folder"]] = mail_iso(datetime.datetime.fromtimestamp(m["at"], datetime.timezone.utc))
    if len(fresh) > MAIL_PER_RUN:
        notes.append(str(len(fresh) - MAIL_PER_RUN) + " more new email(s) wait for the next run.")
