provider = params["provider"]
problem = ""
candidates = []
settings = bk_read_json(BK_SETTINGS) or {}
ledger = bk_read_json(BK_MAIL + "/" + provider + ".json") or {}
now = datetime.datetime.now(datetime.timezone.utc)
# The first run looks back a day; after that only emails the ledger hasn't seen are picked up.
since_at = mail_when(ledger.get("since")) or (now - datetime.timedelta(hours=MAIL_FIRST_RUN_HOURS))
since = since_at.replace(microsecond=0).isoformat()

if not settings:
    problem = "Bookkeeping isn't set up yet."
else:
    seen = ledger.get("seen") or {}
    # An email moved out of the inbox and back (or between folders) comes back with a new Outlook id; its
    # fingerprint is unchanged, so it isn't filed a second time.
    prints = {str(v.get("print")) for v in seen.values() if isinstance(v, dict) and v.get("print")}
    for m in mail_recent(provider):
        if m["id"] in seen or (m.get("print") and m["print"] in prints):
            continue
        when = mail_when(m["received"])
        if when and when < since_at:
            continue
        candidates.append(m)
        if m.get("print"):
            prints.add(m["print"])
    # Oldest first, and a bounded batch per run; the rest are picked up by the next run.
    candidates = sorted(candidates, key=lambda m: m["received"])[:MAIL_PER_RUN]
