# ── bookkeeping kit: Australian Business Register adapter (inlined into register nodes by gen-ext.js) ──
# Talks to the ABR Lookup extension's `abr` connector. Only the Register lookups automation calls it, so practices
# without ABR Lookup can publish everything else; the checks read what it saves in Knowledge.
ABR_SERVER = "abr"
# Re-check a business on the register at most this often; search a name at most this often.
ABR_RECHECK_DAYS = 7
ABR_SEARCH_DAYS = 30
ABR_SEARCHES_PER_RUN = 10
ABR_KEEP = ("found", "valid_checksum", "status", "status_from", "entity_name", "gst_registered", "gst_from", "gst_to",
            "dgr_endorsed", "acnc_registered", "error")


def abr_call(tool, **args):
    exc = None
    try:
        return api.connectors.invoke(server=ABR_SERVER, tool=tool, args=args)
    except Exception as exc:
        raise RuntimeError("ABR: " + str(exc)[:300]) from None


def abr_lookup(abns):
    """Register rows for up to 100 ABNs: {abn: {found, status, status_from, entity_name, names, gst_*, dgr_endorsed, ...}}."""
    got = abr_call("abr_lookup_abns", abns=list(abns)[:100], include_names=True)
    out = {}
    for row in (got or {}).get("results") or []:
        abn = re.sub(r"\D", "", str(row.get("abn") or ""))
        # Keep only real answers: a record, "No records found", or a bad checksum. A timeout or a register error
        # mustn't overwrite what was known (it would close real findings and lose people's ticks).
        definite = row.get("found") or row.get("error") == "No records found" or row.get("valid_checksum") is False
        if not abn or not definite:
            continue
        kept = {k: row.get(k) for k in ABR_KEEP}
        kept["names"] = [str(n) for n in (list(row.get("business_names") or []) + list(row.get("trading_names") or []))
                         if n][:6]
        out[abn] = kept
    return out


def abr_best_match(name):
    """The register's one confident match for a business name (score 95+ and clearly ahead of the next), or None."""
    got = abr_call("abr_search_by_name", name=str(name)[:200], active_only=True, min_score=90, max_results=5)
    rows = [r for r in (got or {}).get("results") or [] if r.get("abn") and r.get("score") is not None]
    rows.sort(key=lambda r: -float(r["score"]))
    if not rows or float(rows[0]["score"]) < 95:
        return None
    if len(rows) > 1 and float(rows[1]["score"]) >= float(rows[0]["score"]) - 2 and rows[1]["abn"] != rows[0]["abn"]:
        return None
    return {"abn": re.sub(r"\D", "", str(rows[0]["abn"])), "name": rows[0].get("name") or "", "score": rows[0]["score"]}
