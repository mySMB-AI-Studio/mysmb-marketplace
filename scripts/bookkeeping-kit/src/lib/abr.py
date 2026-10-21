# ── bookkeeping kit: Australian Business Register adapter (inlined into register nodes by gen-ext.js) ──
# Talks to the ABR Lookup extension's `abr` connector. Only the Register lookups automation calls it, so practices
# without ABR Lookup can publish everything else; the checks read what it saves in Knowledge.
import csv
import io

ABR_SERVER = "abr"
# Re-check a business on the register at most this often; search a name at most this often.
ABR_RECHECK_DAYS = 7
ABR_SEARCH_DAYS = 30
ABR_SEARCHES_PER_RUN = 10
# Bump when abr_best_match changes, so names searched under an older rule are searched again.
ABR_MATCH_RULE = 3
ABR_KEEP = ("found", "valid_checksum", "status", "status_from", "entity_name", "gst_registered", "gst_from", "gst_to",
            "dgr_endorsed", "acnc_registered", "error")
# A test company's made-up ABNs aren't on the real register (the demo seed packs' are "No record found"), so its
# register checks can't be tested. A CSV in this folder named after the client (e.g. "Irvine Jackson Pty Ltd.csv")
# is read instead of the register, for that client only, and its checklist says so.
ABR_TEST_FOLDER = "Bookkeeping/Test register"


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


# The test register's columns (header names, lower case), as in the seed packs' "Registry fixture" tab.
ABR_TEST_COLUMNS = {"abn": ("abn on record", "abn"), "status": ("abn status", "status"),
                    "entity": ("registry entity name", "entity name", "registered name"), "gst": ("gst registration", "gst"),
                    "dgr": ("dgr",)}


def abr_test_register(client, name_key=""):
    """(path, {abn: row}) from the client's test register file, or (None, {}) when it has none."""
    wanted = {client.get("slug") or "", bk_slug(client.get("name")), bk_slug(client.get(name_key) if name_key else "")}
    wanted.discard("client")  # bk_slug's answer for a blank name
    exc = None
    try:
        files = api.files.list(path=ABR_TEST_FOLDER) or []
    except Exception as exc:
        return None, {}
    for f in files:
        name = str(f.get("name") or "")
        if name.lower().endswith(".csv") and bk_slug(name[:-4]) in wanted:
            return str(f["path"]), abr_parse_test_register(api.files.read(file=f["path"]))
    return None, {}


def abr_test_cell(cells, cols, key):
    i = cols.get(key, -1)
    return cells[i] if 0 <= i < len(cells) else ""


def abr_parse_test_register(text):
    """Register rows from a CSV saved from the seed packs' "Registry fixture" tab (title lines above the header are
    fine): ABN on record, Registry entity name, ABN status ("Active", "Cancelled (30/11/2025)", "Not found …"),
    GST registration ("Registered" / "Not registered") and DGR ("Yes" / "No"). Rows without an 11-digit ABN are
    skipped: the register is looked up by ABN."""
    cols = {}
    out = {}
    for cells in csv.reader(io.StringIO(str(text or "").lstrip("﻿"))):
        cells = [str(c or "").strip() for c in cells]
        if not cols:
            low = [c.lower() for c in cells]
            found_cols = {key: next((i for i, h in enumerate(low) if h in names), -1) for key, names in ABR_TEST_COLUMNS.items()}
            if found_cols["abn"] >= 0 and found_cols["status"] >= 0:
                cols = found_cols
            continue
        abn = re.sub(r"\D", "", abr_test_cell(cells, cols, "abn"))
        if len(abn) != 11:
            continue
        status = abr_test_cell(cells, cols, "status").lower()
        valid = bk_abn_valid(abn)
        found = valid and (status.startswith("active") or status.startswith("cancel"))
        dated = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", status)
        entity = abr_test_cell(cells, cols, "entity")
        gst = abr_test_cell(cells, cols, "gst").lower()
        dgr = abr_test_cell(cells, cols, "dgr").lower()
        out[abn] = {
            "found": found, "valid_checksum": valid, "error": None if found else "No records found",
            "status": ("Cancelled" if status.startswith("cancel") else "Active") if found else None,
            "status_from": "%s-%02d-%02d" % (dated.group(3), int(dated.group(2)), int(dated.group(1))) if found and dated else None,
            "entity_name": entity if found and entity not in ("", "-", "—") else None,
            "gst_registered": found and gst.startswith("registered"),
            # Registered with no date means registered throughout: GST began on 1 July 2000.
            "gst_from": "2000-07-01" if found and gst.startswith("registered") else None, "gst_to": None,
            "dgr_endorsed": found and dgr in ("yes", "y", "true"), "acnc_registered": None, "names": []}
    return out


def abr_best_match(name):
    """The register's one confident match for a business name, or None: score 95+, clearly ahead of the next, and
    containing every word of the name (the register's score alone matched "Harbour IT Solutions" to
    "HARBOUR SOLUTIONS")."""
    words = set(bk_norm(name).split())
    got = abr_call("abr_search_by_name", name=str(name)[:200], active_only=True, min_score=90, max_results=10)
    rows = [r for r in (got or {}).get("results") or [] if r.get("abn") and r.get("score") is not None]
    rows.sort(key=lambda r: -float(r["score"]))
    if not rows or float(rows[0]["score"]) < 95:
        return None
    # Ambiguous across everything the register returned (another business scoring about as high), not just the
    # results that pass the word check: filtering first turned a close call into a confident-looking match.
    if len(rows) > 1 and float(rows[1]["score"]) >= float(rows[0]["score"]) - 2 and rows[1]["abn"] != rows[0]["abn"]:
        return None
    if not words or not words <= set(bk_norm(rows[0].get("name")).split()):
        return None
    return {"abn": re.sub(r"\D", "", str(rows[0]["abn"])), "name": rows[0].get("name") or "", "score": rows[0]["score"]}
