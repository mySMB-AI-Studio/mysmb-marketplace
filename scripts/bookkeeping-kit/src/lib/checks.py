# ── bookkeeping kit: ledger checks (inlined into the Ledger checks nodes by gen-ext.js) ──
# The rules are ledger-neutral. They read the snapshot a ledger adapter builds (xero_ledger for Xero), so a
# Bookkeeping for MYOB or QuickBooks pack only needs its own adapter:
#   contacts  [{id, name, tax_number (digits), bank (digits; never stored), has_address, link}]
#   docs      [{id, kind: bill|invoice|bill_credit|invoice_credit, number, contact_id, contact, date, due,
#               status: draft|submitted|authorised|paid|void, total, tax, due_amount, paid_on, attachments, sent,
#               lines: [{account, tax_type, amount (ex GST), tax}], link}]
#   bank      [{id, kind: spend|receive|other (transfers, prepayments), contact_id, contact, date, total, tax, attachments, reconciled, lines, link}]
#   weekly only: accounts [{id, code, name, type, tax_type, active, pl}], tax_rates {tax_type: rate %},
#               journals [{id, date, narration, link}], org {lock_date, eoy_lock_date, settings_link},
#               balances {now, month_ago: {account id: balance}}, pl_12m {income, moved: [account ids]}
# IDs, names and default severities are the mySMB checks catalogue's (Prompt Library, Checks sheet). Urgent is
# never set automatically. Readings marked heuristic wait on the content owner's confirmation.
import secrets

CK_CATALOGUE = {
    "CHK-006": ("Contacts", "Duplicate Contact", "Medium"),
    "CHK-007": ("Contacts", "TPAR Information Missing", "Medium"),
    "CHK-008": ("Contacts", "Large GST Activity for Contact Without ABN", "Medium"),
    "CHK-017": ("Banking", "Contact Bank Account Changed", "High"),
    "CHK-018": ("Banking", "Contact Bank Account Same as Existing Supplier", "Low"),
    "CHK-021": ("Banking", "Expenses in (Month) Without Attachments Over $75", "Low"),
    "CHK-022": ("Banking", "Unreconciled Transactions Last Month", "Low"),
    "CHK-024": ("Sales", "Invoice Not Sent to Contact", "Low"),
    "CHK-028": ("Sales", "Possible Duplicate Customer Invoice", "Medium"),
    "CHK-031": ("Sales", "GST on Invoice and/or Credit Note When Not Registered", "Medium"),
    "CHK-033": ("Sales", "Invoices in Draft or Awaiting Approval", "Low"),
    "CHK-035": ("Sales", "Duplicate Invoice Paid", "Medium"),
    "CHK-055": ("Purchases", "Possible Duplicate Bill", "Medium"),
    "CHK-056": ("Purchases", "Unusual New-Supplier Payment Pattern", "Low"),
    "CHK-057": ("Purchases", "Supplier Bank Details Changed Before A Payment", "High"),
    "CHK-058": ("Purchases", "GST Claimed on a Non-Claimable Item", "Medium"),
    "CHK-059": ("Purchases", "Transaction With a GST Inconsistency", "Medium"),
    "CHK-079": ("Purchases", "Duplicate Bill Raised", "Medium"),
    "CHK-080": ("Purchases", "Duplicate Bill Paid", "Medium"),
    "CHK-086": ("Purchases", "Bills Raised Without Attachments Over $75", "Low"),
    "CHK-087": ("Purchases", "Spend Money Transaction with Like or Similar Bill", "Low"),
    "CHK-125": ("Bookkeeping", "Suspense or Uncoded Account With an Aged Balance", "Medium"),
    "CHK-129": ("Bookkeeping", "GST Account Has No GST Against It", "Medium"),
    "CHK-132": ("Bookkeeping", "Accounting System Getting Lonely", "Low"),
    "CHK-133": ("Bookkeeping", "Month-End Journals Missing", "Medium"),
    "CHK-134": ("Bookkeeping", "Lock Date Not Set", "Medium"),
    "CHK-135": ("Bookkeeping", "Lock Date Change", "Medium"),
    "CHK-136": ("Bookkeeping", "GST Registration Required", "Medium"),
    "CHK-138": ("Bookkeeping", "Inactive Account", "Low"),
}
# Cadence (extension owner, 14 Oct 2026): fraud and duplicate checks daily, the rest weekly.
CK_DAILY = ("CHK-006", "CHK-017", "CHK-018", "CHK-028", "CHK-035", "CHK-055", "CHK-056", "CHK-057", "CHK-079",
            "CHK-080", "CHK-087")
CK_WEEKLY = ("CHK-007", "CHK-008", "CHK-021", "CHK-022", "CHK-024", "CHK-031", "CHK-033", "CHK-058", "CHK-059",
             "CHK-086", "CHK-125", "CHK-129", "CHK-132", "CHK-133", "CHK-134", "CHK-135", "CHK-136", "CHK-138")
CK_HEURISTIC = ("CHK-056", "CHK-129", "CHK-133")
# Findings the client has to answer (receipts, ABNs, TPAR details): the Client Queries part of the weekly report.
CK_CLIENT_QUERY = ("CHK-007", "CHK-008", "CHK-021", "CHK-086")
CK_CATEGORIES = ("Contacts", "Banking", "Sales", "Purchases", "Bookkeeping")
CK_SEVERITY_RANK = {"High": 0, "Medium": 1, "Low": 2}
CK_PRIORITY = {"High": "high", "Medium": "medium", "Low": "low"}
CK_DAILY_DAYS = 35
CK_DUP_DAYS = 7
CK_NEW_SUPPLIER_DAYS = 30
CK_NEW_SUPPLIER_LARGE = 5000.0
CK_QUICK_PAY_DAYS = 2
CK_BANK_CHANGE_DAYS = 30
CK_DUE_SOON_DAYS = 14
CK_LONELY_DAYS = 30
CK_GST_TURNOVER = 75000.0
CK_LOCK_MONTHS = 6
CK_MAX_LINES = 60
# Patterns are plain strings, used with re.search and re.sub: the Publish lint rejects compiling them.
CK_NON_CLAIMABLE = (r"(?i)\b(wages?|salar(y|ies)|superannuation|super|payg|bank (fees?|charges?)|interest|"
                    r"depreciation|amortis\w*|asic|stamp duty|fines?|penalt\w*|donations?|land tax|"
                    r"income tax|fbt|drawings|dividends?)\b")
CK_SUSPENSE = r"(?i)\b(suspense|clearing|uncoded|unallocated|holding)\b"
CK_MONTHS = r"(?i)\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b"


def ck_day(value):
    try:
        return datetime.date.fromisoformat(str(value)[:10])
    except Exception:
        return None


def ck_money(amount):
    return "$" + bk_fmt(amount) if amount is not None else ""


def ck_gap(first, second):
    """Days from one date to another; a very large number when either is missing."""
    a, b = ck_day(first), ck_day(second)
    return (b - a).days if a and b else 99999


def ck_date_text(value):
    d = ck_day(value)
    return d.strftime("%d %b %Y").lstrip("0") if d else "no date"


def ck_finding(check, key, text, amount=None, link="", sig=None):
    """One finding. fp changes when its details change, which brings back a dismissed finding."""
    category, name, severity = CK_CATALOGUE[check]
    full_key = check + ":" + key
    return {"check": check, "key": full_key, "category": category, "name": name, "severity": severity,
            "amount": round(amount, 2) if amount is not None else None, "text": text, "link": link,
            "heuristic": check in CK_HEURISTIC,
            "fp": hashlib.sha256((full_key + "|" + (text if sig is None else str(sig))).encode("utf-8")).hexdigest()[:12]}


def ck_ref(key):
    """The short code printed on a finding's line, so a tick or the Check findings form can point at it."""
    return hashlib.sha256(str(key).encode("utf-8")).hexdigest()[:6].upper()


def ck_bank_hash(secret, digits):
    """A keyed hash of a bank account: bank numbers are short enough to reverse a plain hash."""
    if not digits:
        return ""
    return hashlib.blake2b(digits.encode("utf-8"), key=str(secret).encode("utf-8")[:64], digest_size=10).hexdigest()


def ck_names(rows, field="name", limit=5):
    names = [str(r.get(field) or "") for r in rows if r.get(field)]
    shown = ", ".join(names[:limit])
    return shown + (" and " + str(len(names) - limit) + " more" if len(names) > limit else "")


def ck_fy_start(today):
    return datetime.date(today.year if today.month >= 7 else today.year - 1, 7, 1)


def ck_last_month(today):
    end = today.replace(day=1) - datetime.timedelta(days=1)
    return end.replace(day=1), end


def ck_live(doc):
    return doc["status"] in ("submitted", "authorised", "paid")


# ── Contacts and banking (daily) ──
def ck_contact_rules(ledger, snap, today, secret):
    out = []
    banks = snap.setdefault("banks", {})
    seen = snap.setdefault("seen", {})
    seeding = not snap.get("seeded")
    groups = {"abn": {}, "name": {}, "bank": {}}
    for c in ledger.get("contacts") or []:
        cid = c["id"]
        h = ck_bank_hash(secret, c.get("bank"))
        prev = banks.get(cid)
        known_before = not seeding and cid in seen and seen[cid] != str(today)
        if h and prev is None and known_before:
            # Bank details added to a contact that had none: as risky as a change.
            banks[cid] = {"h": h, "changed": str(today)}
        elif h and prev is None:
            banks[cid] = {"h": h}
        elif h and prev is not None and prev.get("h") != h:
            # A change only counts once there is a snapshot to compare with (the second run onwards).
            banks[cid] = {"h": h, "changed": str(today)}
        if cid not in seen:
            seen[cid] = "" if seeding else str(today)
        if len(c.get("tax_number") or "") == 11:
            groups["abn"].setdefault(c["tax_number"], []).append(c)
        if len(bk_norm(c.get("name"))) > 2:
            groups["name"].setdefault(bk_norm(c["name"]), []).append(c)
        if h:
            groups["bank"].setdefault(h, []).append(c)
    snap["seeded"] = True
    for how, label in (("abn", "the same ABN"), ("name", "the same name")):
        for value, rows in groups[how].items():
            if len(rows) > 1:
                ids = sorted(r["id"] for r in rows)
                out.append(ck_finding("CHK-006", how + ":" + "|".join(ids),
                                      str(len(rows)) + " active contacts have " + label + ": " + ck_names(rows)
                                      + ". Merge them in Xero, or archive the one not used.", link=rows[0]["link"]))
    for rows in groups["bank"].values():
        if len(rows) > 1:
            ids = sorted(r["id"] for r in rows)
            out.append(ck_finding("CHK-018", "|".join(ids), str(len(rows)) + " contacts are paid into the same bank account: "
                                  + ck_names(rows) + ". Check they really are the same business.", link=rows[0]["link"]))
    by_id = {c["id"]: c for c in ledger.get("contacts") or []}
    for cid, b in banks.items():
        changed = ck_day(b.get("changed"))
        if cid in by_id and changed and (today - changed).days <= CK_BANK_CHANGE_DAYS:
            out.append(ck_finding("CHK-017", cid, "Bank details on " + by_id[cid]["name"] + " changed on "
                                  + ck_date_text(changed) + ". Confirm the change with them on a phone number you already "
                                  "have before paying.", link=by_id[cid]["link"], sig=b.get("h")))
    return out


# ── Duplicates, payments and new suppliers (daily) ──
def ck_pairs(docs, kind, since):
    live = [d for d in docs if d["kind"] == kind and ck_live(d) and d["total"] > 0]
    by_contact = {}
    for d in live:
        by_contact.setdefault(d["contact_id"] or bk_norm(d["contact"]), []).append(d)
    pairs = []
    for rows in by_contact.values():
        rows.sort(key=lambda d: (d["date"], d["id"]))
        for i, a in enumerate(rows):
            for b in rows[i + 1:]:
                if b["date"] < str(since):
                    continue
                same_number = bool(a["number"]) and bk_norm(a["number"]) == bk_norm(b["number"])
                da, db = ck_day(a["date"]), ck_day(b["date"])
                gap = abs((db - da).days) if da and db else None
                close = gap is not None and gap <= CK_DUP_DAYS and abs(a["total"] - b["total"]) < 0.01
                if same_number or close:
                    pairs.append((a, b, same_number, gap))
    return pairs


def ck_duplicate_rules(ledger, today, since):
    out = []
    docs = ledger.get("docs") or []
    for a, b, same_number, gap in ck_pairs(docs, "bill", since):
        both_paid = a["status"] == "paid" and b["status"] == "paid"
        check = "CHK-080" if both_paid else ("CHK-079" if same_number else "CHK-055")
        why = "the same invoice number" if same_number else "the same amount " + str(gap) + " day(s) apart"
        out.append(ck_finding(check, a["id"] + "|" + b["id"],
                              "Bills " + (a["number"] or "(no number)") + " (" + ck_date_text(a["date"]) + ") and "
                              + (b["number"] or "(no number)") + " (" + ck_date_text(b["date"]) + ") from " + b["contact"]
                              + " have " + why + (". Both are paid: ask the supplier for a refund or credit."
                                                  if both_paid else ". Void one if it's the same bill."),
                              amount=b["total"], link=b["link"], sig=a["status"] + b["status"]))
    for a, b, same_number, gap in ck_pairs(docs, "invoice", since):
        both_paid = a["status"] == "paid" and b["status"] == "paid"
        out.append(ck_finding("CHK-035" if both_paid else "CHK-028", a["id"] + "|" + b["id"],
                              "Sales invoices " + (a["number"] or "(no number)") + " and " + (b["number"] or "(no number)")
                              + " to " + b["contact"] + (" have the same number" if same_number
                                                         else " are for the same amount " + str(gap) + " day(s) apart")
                              + (". Both are paid: check the customer wasn't charged twice." if both_paid
                                 else ". Void one if it's the same sale."),
                              amount=b["total"], link=b["link"], sig=a["status"] + b["status"]))
    bills = [d for d in docs if d["kind"] == "bill" and d["status"] in ("authorised", "paid") and d["contact_id"]]
    for s in ledger.get("bank") or []:
        if s["kind"] != "spend" or not s["contact_id"] or s["date"] < str(since):
            continue
        sd = ck_day(s["date"])
        for b in bills:
            if b["contact_id"] != s["contact_id"] or abs(b["total"] - s["total"]) > max(1.0, b["total"] * 0.01):
                continue
            near = [x for x in (ck_day(b["date"]), ck_day(b["due"])) if x]
            if sd and any(abs((sd - x).days) <= 14 for x in near):
                out.append(ck_finding("CHK-087", s["id"] + "|" + b["id"],
                                      "Spend money of " + ck_money(s["total"]) + " to " + s["contact"] + " on " + ck_date_text(s["date"])
                                      + " looks like bill " + (b["number"] or "(no number)") + " (" + ck_money(b["total"]) + ", "
                                      + b["status"] + "). If it paid that bill, apply the payment to the bill instead so it "
                                      "isn't paid twice.", amount=s["total"], link=s["link"], sig=b["status"]))
                break
    return out


def ck_payment_rules(ledger, snap, today, since):
    out = []
    docs = ledger.get("docs") or []
    spend = [s for s in ledger.get("bank") or [] if s["kind"] == "spend"]
    by_id = {c["id"]: c for c in ledger.get("contacts") or []}
    for cid, b in (snap.get("banks") or {}).items():
        changed = ck_day(b.get("changed"))
        if cid not in by_id or not changed or (today - changed).days > CK_BANK_CHANGE_DAYS:
            continue
        due = [d for d in docs if d["contact_id"] == cid and d["kind"] == "bill" and d["status"] == "authorised"
               and d["due_amount"] > 0 and (not ck_day(d["due"]) or ck_day(d["due"]) <= today + datetime.timedelta(days=CK_DUE_SOON_DAYS))]
        paid = ([d for d in docs if d["contact_id"] == cid and d["kind"] == "bill" and d["paid_on"] >= str(changed)]
                + [s for s in spend if s["contact_id"] == cid and s["date"] >= str(changed)])
        if not due and not paid:
            continue
        parts = []
        if due:
            parts.append(ck_money(sum(d["due_amount"] for d in due)) + " of bills due by "
                         + ck_date_text(max(d["due"] or str(today) for d in due)))
        if paid:
            parts.append(ck_money(sum(p["total"] for p in paid)) + " already paid since")
        out.append(ck_finding("CHK-057", cid + ":" + str(changed),
                              "Bank details on " + by_id[cid]["name"] + " changed on " + ck_date_text(changed) + "; "
                              + " and ".join(parts) + ". Hold payment until the new details are confirmed with the supplier "
                              "on a phone number you already have.",
                              amount=sum(d["due_amount"] for d in due) + sum(p["total"] for p in paid),
                              link=(due or paid)[0]["link"], sig=b.get("h")))
    seen = snap.get("seen") or {}
    for cid, first in seen.items():
        first_day = ck_day(first)
        if cid not in by_id or not first_day or (today - first_day).days > CK_NEW_SUPPLIER_DAYS:
            continue
        mine = ([d for d in docs if d["contact_id"] == cid and d["kind"] == "bill" and ck_live(d) and d["date"] >= str(since)]
                + [s for s in spend if s["contact_id"] == cid and s["date"] >= str(since)])
        total = sum(x["total"] for x in mine)
        quick = [d for d in mine if d.get("paid_on") and 0 <= ck_gap(d.get("date"), d.get("paid_on")) <= CK_QUICK_PAY_DAYS]
        if total >= CK_NEW_SUPPLIER_LARGE or quick:
            why = (ck_money(total) + " billed or paid since it first appeared on " + ck_date_text(first_day)
                   + (", and a bill paid within " + str(CK_QUICK_PAY_DAYS) + " days of its date" if quick else ""))
            out.append(ck_finding("CHK-056", cid, "New supplier " + by_id[cid]["name"] + ": " + why
                                  + ". Check it's a genuine supplier.", amount=total, link=by_id[cid]["link"],
                                  sig="%.2f|%d" % (total, len(quick))))
    return out


# ── GST, attachments, sales and housekeeping (weekly) ──
def ck_purchases(ledger):
    """Bills (not draft or void) and spend money: everything GST is claimed on."""
    return ([d for d in ledger.get("docs") or [] if d["kind"] == "bill" and ck_live(d)]
            + [s for s in ledger.get("bank") or [] if s["kind"] == "spend"])


def ck_weekly_rules(ledger, client, snap, today, captured):
    out = []
    docs = ledger.get("docs") or []
    contacts = {c["id"]: c for c in ledger.get("contacts") or []}
    accounts = {a["code"]: a for a in ledger.get("accounts") or [] if a.get("code")}
    rates = ledger.get("tax_rates") or {}
    purchases = ck_purchases(ledger)
    lm_start, lm_end = ck_last_month(today)
    month = lm_start.strftime("%B %Y")
    captured = set(captured or [])

    # CHK-008: GST claimed on purchases over $82.50 from a contact with no ABN.
    no_abn = {}
    for p in purchases:
        c = contacts.get(p["contact_id"])
        if c and len(c.get("tax_number") or "") != 11 and p["tax"] > 0 and p["total"] > BK_GST_INVOICE_LIMIT:
            no_abn.setdefault(c["id"], []).append(p)
    for cid, rows in no_abn.items():
        gst = sum(r["tax"] for r in rows)
        out.append(ck_finding("CHK-008", cid, ck_money(gst) + " GST claimed on " + str(len(rows)) + " purchase(s) over "
                              + ck_money(BK_GST_INVOICE_LIMIT) + " from " + contacts[cid]["name"] + ", which has no ABN in Xero. "
                              "Get its ABN or a tax invoice, or the GST can't be claimed.", amount=gst,
                              link=contacts[cid]["link"], sig="%d|%.2f" % (len(rows), gst)))

    # CHK-007: suppliers paid this financial year without the ABN or address a TPAR needs.
    if client.get("tpar"):
        fy = str(ck_fy_start(today))
        paid = {}
        for p in purchases:
            when = p.get("paid_on") or (p["date"] if p["kind"] == "spend" else "")
            c = contacts.get(p["contact_id"])
            if c and when >= fy and (len(c.get("tax_number") or "") != 11 or not c.get("has_address")):
                paid[c["id"]] = paid.get(c["id"], 0.0) + p["total"]
        if paid:
            rows = [contacts[i] for i in sorted(paid)]
            out.append(ck_finding("CHK-007", "tpar", str(len(rows)) + " supplier(s) paid this financial year are missing the "
                                  "ABN or address the TPAR needs: " + ck_names(rows) + ".", amount=sum(paid.values()),
                                  sig="|".join(sorted(paid))))

    # CHK-021 / CHK-086: last month's spend money and bills over $82.50 with nothing attached.
    for check, rows, what in (("CHK-021", [s for s in ledger.get("bank") or [] if s["kind"] == "spend"], "spend money transaction(s)"),
                              ("CHK-086", [d for d in docs if d["kind"] == "bill" and ck_live(d)], "bill(s)")):
        bare = [r for r in rows if not r["attachments"] and r["total"] > BK_GST_INVOICE_LIMIT
                and str(lm_start) <= r["date"] <= str(lm_end)]
        if bare:
            out.append(ck_finding(check, str(lm_start)[:7], str(len(bare)) + " " + what + " over " + ck_money(BK_GST_INVOICE_LIMIT)
                                  + " in " + month + " have nothing attached (" + ck_names(bare, "contact") + "). Attach the "
                                  "receipts or ask the client for them.", amount=sum(r["total"] for r in bare),
                                  link=bare[0]["link"], sig="|".join(sorted(r["id"] for r in bare))))

    # CHK-022: bank transactions up to the end of last month that aren't reconciled.
    loose = [s for s in ledger.get("bank") or [] if not s["reconciled"] and s["date"] <= str(lm_end)]
    if loose:
        out.append(ck_finding("CHK-022", "unreconciled", str(len(loose)) + " bank transaction(s) dated up to "
                              + ck_date_text(lm_end) + " aren't reconciled. (Statement lines not yet coded aren't counted: "
                              "Xero doesn't share them.)", amount=sum(abs(s["total"]) for s in loose),
                              sig="|".join(sorted(s["id"] for s in loose))))

    # CHK-024 / CHK-033: sales invoices never sent, and ones still in draft or awaiting approval.
    # Invoices this extension captured from PDFs are recorded without emailing on purpose, so they're left out.
    sales = [d for d in docs if d["kind"] == "invoice" and d["id"] not in captured]
    unsent = [d for d in sales if d["status"] in ("authorised", "paid") and d.get("sent") is False]
    if unsent:
        out.append(ck_finding("CHK-024", "unsent", str(len(unsent)) + " approved sales invoice(s) were never sent from Xero ("
                              + ck_names(unsent, "number") + "). Send them, or mark them sent if they went another way.",
                              amount=sum(d["total"] for d in unsent), link=unsent[0]["link"],
                              sig="|".join(sorted(d["id"] for d in unsent))))
    waiting = [d for d in sales if d["status"] in ("draft", "submitted")]
    if waiting:
        out.append(ck_finding("CHK-033", "waiting", str(len(waiting)) + " sales invoice(s) are in draft or awaiting approval ("
                              + ck_names(waiting, "number") + ").", amount=sum(d["total"] for d in waiting),
                              link=waiting[0]["link"], sig="|".join(sorted(d["id"] for d in waiting))))

    # CHK-031: GST on sales or credit notes when the business isn't registered (per its client settings).
    if not client.get("gst_registered"):
        taxed = [d for d in docs if d["kind"] in ("invoice", "invoice_credit") and ck_live(d) and d["tax"] > 0]
        if taxed:
            out.append(ck_finding("CHK-031", "gst-unregistered", str(len(taxed)) + " sales invoice(s) or credit note(s) charge "
                                  "GST, but the business isn't registered for GST (" + ck_names(taxed, "number") + ").",
                                  amount=sum(d["tax"] for d in taxed), link=taxed[0]["link"],
                                  sig="|".join(sorted(d["id"] for d in taxed))))

    # CHK-058: GST claimed on accounts that normally carry none (wages, super, bank fees, interest, ASIC fees ...).
    by_account = {}
    for p in purchases:
        for ln in p["lines"]:
            a = accounts.get(ln["account"])
            if a and ln["tax"] > 0 and (re.search(CK_NON_CLAIMABLE, a["name"]) or a["type"] == "DEPRECIATN"):
                by_account.setdefault(a["code"], []).append(ln["tax"])
    for code, taxes in by_account.items():
        out.append(ck_finding("CHK-058", code, ck_money(sum(taxes)) + " GST claimed on " + str(len(taxes)) + " line(s) coded to "
                              + code + " " + accounts[code]["name"] + ", which normally has no GST. Check the tax code.",
                              amount=sum(taxes), sig="%d|%.2f" % (len(taxes), sum(taxes))))

    # CHK-059: GST that isn't the rate's share of the line, and one supplier's account coded with GST and without.
    wrong = []
    mixes = {}
    for p in purchases:
        for ln in p["lines"]:
            rate = rates.get(ln["tax_type"])
            if rate and ln["amount"] and abs(ln["tax"] - ln["amount"] * rate / 100) > max(0.05, abs(ln["amount"] * rate / 100) * 0.02):
                wrong.append(p)
                break
        for ln in p["lines"]:
            if ln["tax_type"] and ln["account"] and p["contact_id"] and ln["tax_type"] in rates:
                mixes.setdefault((p["contact_id"], ln["account"]), []).append(ln["tax_type"])
    if wrong:
        out.append(ck_finding("CHK-059", "gst-amount", str(len(wrong)) + " purchase(s) have GST that isn't the tax rate's "
                              "share of the line (" + ck_names(wrong, "contact") + "). Check the GST amounts.",
                              amount=sum(w["tax"] for w in wrong), link=wrong[0]["link"],
                              sig="|".join(sorted(w["id"] for w in wrong))))
    for (cid, code), types in mixes.items():
        with_gst = {t for t in types if (rates.get(t) or 0) > 0}
        without = {t for t in types if (rates.get(t) or 0) == 0}
        if len(types) >= 3 and with_gst and without and cid in contacts:
            out.append(ck_finding("CHK-059", "mix:" + cid + ":" + code, "Purchases from " + contacts[cid]["name"] + " coded to "
                                  + code + ((" " + accounts[code]["name"]) if code in accounts else "") + " use tax codes with GST ("
                                  + ", ".join(sorted(with_gst)) + ") and without (" + ", ".join(sorted(without)) + "). Check which is right.",
                                  link=contacts[cid]["link"], sig="|".join(sorted(set(types)))))

    # CHK-125: suspense or clearing accounts that have carried a balance for 30 days or more.
    balances = ledger.get("balances") or {}
    watch = set(client.get("suspense_codes") or [])
    for a in ledger.get("accounts") or []:
        if not (a["code"] in watch or re.search(CK_SUSPENSE, a["name"])):
            continue
        now = (balances.get("now") or {}).get(a["id"]) or 0
        before = (balances.get("month_ago") or {}).get(a["id"]) or 0
        if now and before:
            out.append(ck_finding("CHK-125", a["code"] or a["id"], "Account " + (a["code"] + " " if a["code"] else "") + a["name"]
                                  + " has had a balance for at least 30 days (" + ck_money(abs(now)) + " now). Clear it to the "
                                  "right accounts.", amount=abs(now), sig="%.2f" % now))

    # CHK-129 (heuristic): an account that defaults to GST whose recent lines mostly have none.
    usage = {}
    for d in purchases + [d for d in docs if d["kind"] == "invoice" and ck_live(d)]:
        for ln in d["lines"]:
            usage.setdefault(ln["account"], []).append(rates.get(ln["tax_type"]) or 0)
    for code, used in usage.items():
        a = accounts.get(code)
        zero = len([r for r in used if not r])
        if a and (rates.get(a["tax_type"]) or 0) > 0 and len(used) >= 5 and zero >= 0.8 * len(used):
            out.append(ck_finding("CHK-129", code, "Account " + code + " " + a["name"] + " defaults to GST, but " + str(zero)
                                  + " of its " + str(len(used)) + " recent lines have none. Check the account's default tax "
                                  "rate, or the coding.", sig="%d/%d" % (zero, len(used))))

    # CHK-132: nothing new in the ledger for a month.
    dates = [d["date"] for d in docs if d["date"]] + [s["date"] for s in ledger.get("bank") or [] if s["date"]]
    latest = max(dates) if dates else ""
    if not latest or latest < str(today - datetime.timedelta(days=CK_LONELY_DAYS)):
        out.append(ck_finding("CHK-132", "lonely", ("Nothing has been entered since " + ck_date_text(latest) if latest
                                                    else "Nothing has been entered in the last 90 days")
                              + ". Is the bookkeeping up to date, and is the bank feed working?", sig=latest))

    # CHK-133 (heuristic): a journal posted in each of the 3 months before last month, but not last month.
    months = {}
    for j in ledger.get("journals") or []:
        key = re.sub(r"\s+", " ", re.sub(r"[^a-z ]", " ", re.sub(CK_MONTHS, " ", j["narration"].lower()))).strip()
        if key and j["date"]:
            months.setdefault(key, {})[j["date"][:7]] = j
    prior = []
    m = lm_start
    for _ in range(3):
        m = (m - datetime.timedelta(days=1)).replace(day=1)
        prior.append(str(m)[:7])
    for key, seen in months.items():
        if all(p in seen for p in prior) and str(lm_start)[:7] not in seen:
            last = seen[prior[0]]
            out.append(ck_finding("CHK-133", key, "The journal \"" + last["narration"][:80] + "\" was posted in each of the 3 "
                                  "months before " + month + " but not in " + month + ". Post it if it's still needed.",
                                  link=last["link"], sig=str(lm_start)[:7]))

    # CHK-134 / CHK-135: no recent lock date; a lock date moved back (snapshot, flagged for 30 days).
    org = ledger.get("org") or {}
    lock = max(org.get("lock_date") or "", org.get("eoy_lock_date") or "")
    if not lock:
        out.append(ck_finding("CHK-134", "lock-date", "No lock date is set in Xero, so past periods can still be changed.",
                              link=org.get("settings_link") or "", sig=""))
    elif lock < str(today - datetime.timedelta(days=CK_LOCK_MONTHS * 30)):
        out.append(ck_finding("CHK-134", "lock-date", "The lock date is " + ck_date_text(lock) + ", more than " + str(CK_LOCK_MONTHS)
                              + " months ago. Move it forward to the last period lodged.", link=org.get("settings_link") or "",
                              sig=lock))
    previous = snap.get("lock")
    if previous is not None and (not lock or lock < previous):
        snap["lock_change"] = {"from": previous, "to": lock, "on": str(today)}
    snap["lock"] = lock
    change = snap.get("lock_change") or {}
    if change and ck_day(change.get("on")) and (today - ck_day(change["on"])).days <= CK_BANK_CHANGE_DAYS:
        out.append(ck_finding("CHK-135", change["from"] + ">" + change["to"], "The lock date was moved back from "
                              + ck_date_text(change["from"]) + " to " + (ck_date_text(change["to"]) if change["to"] else "none")
                              + " (noticed " + ck_date_text(change["on"]) + "). Check why, and that nothing in the reopened "
                              "period changed by mistake.", link=org.get("settings_link") or ""))

    # CHK-136: over the GST registration threshold without being registered.
    income = (ledger.get("pl_12m") or {}).get("income") or 0
    if not client.get("gst_registered") and income >= CK_GST_TURNOVER:
        out.append(ck_finding("CHK-136", "gst-registration", "Income for the last 12 months is " + ck_money(income) + ", at or over the "
                              + ck_money(CK_GST_TURNOVER) + " GST registration threshold, and the business isn't registered for "
                              "GST (per its client settings).", amount=income, sig="over the threshold"))

    # CHK-138: profit and loss accounts with no movement in 12 months.
    moved = set((ledger.get("pl_12m") or {}).get("moved") or [])
    idle = [a for a in ledger.get("accounts") or [] if a["active"] and a["pl"] and a["code"] and a["id"] not in moved]
    if idle:
        idle.sort(key=lambda a: a["code"])
        out.append(ck_finding("CHK-138", "inactive", str(len(idle)) + " profit and loss account(s) haven't been used in 12 months: "
                              + ", ".join(a["code"] + " " + a["name"] for a in idle[:8]) + (" and more" if len(idle) > 8 else "")
                              + ". Archive the ones that aren't needed.", sig="|".join(a["code"] for a in idle)))
    return out


def ck_run(ledger, client, snap, today, secret, captured):
    """Every check due on this run. Returns (findings, the check IDs evaluated)."""
    since = today - datetime.timedelta(days=CK_DAILY_DAYS)
    # The daily checks see only what a daily run fetches (the last 35 days, plus approved bills still to pay), even
    # on a weekly run, so their findings don't come and go between daily and weekly runs.
    daily = dict(ledger)
    daily["docs"] = [d for d in ledger.get("docs") or [] if d["date"] >= str(since)
                     or (d["kind"] == "bill" and d["status"] == "authorised")]
    daily["bank"] = [s for s in ledger.get("bank") or [] if s["date"] >= str(since)]
    found = ck_contact_rules(daily, snap, today, secret)
    found += ck_duplicate_rules(daily, today, since)
    found += ck_payment_rules(daily, snap, today, since)
    evaluated = set(CK_DAILY)
    if ledger.get("weekly"):
        found += ck_weekly_rules(ledger, client, snap, today, captured)
        evaluated |= set(CK_WEEKLY)
    return found, evaluated


# ── The findings file and the client's checklist ──
def ck_ticked(description):
    """The refs of lines ticked on the item: a ticked line is dismissed until that finding's details change."""
    return set(re.findall(r"(?m)^\s*[-*+]\s*\\?\[[xX]\\?\][^\n]*?\bref\s+([0-9A-F]{6})\b", str(description or "")))


def ck_reconcile(state, found, evaluated, ticked, today, actor=""):
    """Merge this run's findings into the findings file. Returns (newly open, resolved)."""
    findings = state.setdefault("findings", {})
    dismissed = state.setdefault("dismissed", {})
    snoozed = state.setdefault("snoozed", {})
    for key, f in findings.items():
        if f.get("status") == "open" and ck_ref(key) in ticked:
            dismissed[key] = {"fp": f["fp"], "on": str(today), "by": actor or "ticked on the item"}
            # Hidden now, even when this run doesn't re-evaluate the check (a weekly finding on a daily run).
            f["status"] = "dismissed"
    current = {f["key"]: f for f in found}
    new, resolved = [], []
    for key, f in current.items():
        prev = findings.get(key) or {}
        f["first_seen"] = prev.get("first_seen") or str(today)
        f["last_seen"] = str(today)
        if key in dismissed and dismissed[key].get("fp") != f["fp"]:
            dismissed.pop(key)
        if key in snoozed and str(snoozed[key].get("until") or "") <= str(today):
            snoozed.pop(key)
        f["status"] = "dismissed" if key in dismissed else ("snoozed" if key in snoozed else "open")
        if f["status"] == "open" and prev.get("status") != "open":
            new.append(f)
        findings[key] = f
    for key in list(findings):
        if key not in current and findings[key]["check"] in evaluated:
            if findings[key].get("status") == "open":
                resolved.append(findings[key])
            findings.pop(key)
            dismissed.pop(key, None)
            snoozed.pop(key, None)
    for key in list(snoozed):
        if key in findings and findings[key]["status"] == "snoozed" and str(snoozed[key].get("until") or "") <= str(today):
            snoozed.pop(key)
            findings[key]["status"] = "open"
            new.append(findings[key])
    return new, resolved


def ck_open(state):
    rows = [f for f in (state.get("findings") or {}).values() if f.get("status") == "open"]
    rows.sort(key=lambda f: (CK_CATEGORIES.index(f["category"]) if f["category"] in CK_CATEGORIES else 9,
                             CK_SEVERITY_RANK.get(f["severity"], 9), -(f.get("amount") or 0), f["key"]))
    return rows


def ck_line(f):
    """One checklist line in the D7 format: severity, check, $ at risk, what to do, the link and its ref."""
    parts = ["**" + f["severity"] + "**", f["check"] + " " + f["name"]]
    if f.get("amount") is not None:
        parts.append(ck_money(f["amount"]))
    text = f["text"] + (" (a heuristic reading, to be confirmed)" if f.get("heuristic") else "")
    if f.get("link"):
        text += " [Open in Xero](" + f["link"] + ")"
    parts.append(text)
    return "- [ ] " + " — ".join(parts) + " · ref " + ck_ref(f["key"])


def ck_priority(rows):
    best = min((CK_SEVERITY_RANK.get(f["severity"], 9) for f in rows), default=9)
    return {0: "high", 1: "medium"}.get(best, "low")


def ck_description(client, state, truncated=None):
    rows = ck_open(state)
    out = ["Ledger checks for **" + str(client.get("name") or "") + "** (Xero: " + str(client.get("xero_org_name") or "") + "). "
           "Fix each one in Xero; it drops off this list on the next check.", ""]
    shown = 0
    for category in CK_CATEGORIES:
        mine = [f for f in rows if f["category"] == category]
        if not mine or shown >= CK_MAX_LINES:
            continue
        out.append("**" + category + "**")
        out.append("")
        for f in mine:
            if shown >= CK_MAX_LINES:
                break
            out.append(ck_line(f))
            shown += 1
        out.append("")
    if len(rows) > shown:
        out.append("…and " + str(len(rows) - shown) + " more, lower down the list. They appear here as these are cleared.")
        out.append("")
    quiet = [f for f in (state.get("findings") or {}).values() if f.get("status") in ("dismissed", "snoozed")]
    out.append("**Not an issue?** Tick its line: it stays off this list until its details change. To snooze findings "
               "or add a note, fill in the **Check findings** form with their refs.")
    out.append("")
    out.append("Daily checks (fraud and duplicates) last ran " + ck_date_text(state.get("last_daily")) + "; weekly checks "
               + ck_date_text(state.get("last_weekly")) + "." + (" " + str(len(quiet)) + " finding(s) dismissed or snoozed."
                                                                   if quiet else ""))
    if truncated:
        out.append("")
        out.append("Some data was cut short (" + ", ".join(truncated) + "): the checks covered the first 2,000 of each.")
    return "\n".join(out)


# ── The client's Checks item in WorkQ: one open item per client, found by the id kept in its findings file ──
def ck_secret():
    """The key for the bank-detail fingerprints, made once per workspace."""
    path = BK_CHECKS + "/_key.json"
    data = bk_read_json(path) or {}
    if not data.get("key"):
        data = {"key": secrets.token_hex(32),
                "note": "Keys the bank-detail fingerprints in the ledger checks findings files. If it is deleted, the next "
                        "run starts the fingerprints again (no bank-change alerts that night)."}
        bk_write_json(path, data)
    return data["key"]


def ck_item_title(client):
    return ("Checks: " + str(client.get("name") or client.get("slug") or ""))[:200]


def ck_find_item(state, client):
    """The client's Checks item: by the id in the findings file, else by its title (titles get edited, so that's the
    fallback only). None when there isn't one."""
    todo_id = state.get("todo_id") or ""
    exc = None
    if todo_id:
        try:
            item = api.workq.get(todo_id=todo_id)
            if isinstance(item, dict) and item.get("id"):
                return item
        except Exception as exc:
            pass
    title = ck_item_title(client)
    try:
        rows = api.workq.list(search=title)
    except Exception as exc:
        rows = []
    for r in rows or []:
        if r.get("title") == title and r.get("status") not in ("done", "cancelled") and "checks" in (r.get("labels") or []):
            state["todo_id"] = r["id"]
            return r
    return None


def ck_item_open(item):
    return bool(item) and item.get("status") not in ("done", "cancelled")


def ck_remember_item(todo_id, slug):
    index = bk_read_json(BK_CHECKS + "/_items.json") or {}
    index[todo_id] = {"slug": slug, "at": bk_now_iso({})}
    if len(index) > 2000:
        # Files are written with sorted keys, so evict by when each item was made, not by position.
        newest = sorted(index.items(), key=lambda kv: str(kv[1].get("at") if isinstance(kv[1], dict) else ""))[-2000:]
        index = dict(newest)
    bk_write_json(BK_CHECKS + "/_items.json", index)


def ck_item_slug(todo_id):
    entry = (bk_read_json(BK_CHECKS + "/_items.json") or {}).get(todo_id) or ""
    return str(entry.get("slug") or "") if isinstance(entry, dict) else str(entry)


def ck_new_item(client, settings, state, form_id, note=""):
    rows = ck_open(state)
    owner = bk_checks_owner(settings, client)
    item = api.workq.create(title=ck_item_title(client), scope="org",
                            description=ck_description(client, state, state.get("truncated")),
                            priority=ck_priority(rows), labels=["bookkeeping", "checks", client["slug"]],
                            assignee_ids=[owner] if owner else None)
    api.workq.attach_form(todo_id=item["id"], form_id=form_id)
    if note:
        api.workq.comment(todo_id=item["id"], body=note)
    ck_remember_item(item["id"], client["slug"])
    state["todo_id"] = item["id"]
    state["listed"] = [f["key"] for f in rows]
    return item["id"]


def ck_change_note(new, resolved):
    out = [str(len(new)) + " new, " + str(len(resolved)) + " resolved since the last check."]
    for f in new[:10]:
        out.append("- New: " + f["check"] + " " + f["name"] + (" (" + ck_money(f["amount"]) + ")" if f.get("amount") is not None else ""))
    for f in resolved[:10]:
        out.append("- Resolved: " + f["check"] + " " + f["name"])
    return "\n".join(out)


def ck_sync_item(client, settings, state, item, new, resolved, form_id):
    """Rewrite the open item with the current findings, comment only when something changed, complete it when nothing
    is open. A new item opens only when there's no open one and something new turned up (a person may have closed the
    last one on purpose). Never sets urgent, and leaves a person's urgent alone."""
    rows = ck_open(state)
    if ck_item_open(item):
        if rows:
            api.workq.update(todo_id=item["id"], description=ck_description(client, state, state.get("truncated")))
            if item.get("priority") != "urgent" and item.get("priority") != ck_priority(rows):
                api.workq.update(todo_id=item["id"], priority=ck_priority(rows))
            if new or resolved:
                api.workq.comment(todo_id=item["id"], body=ck_change_note(new, resolved))
            state["listed"] = [f["key"] for f in rows]
            return "updated"
        api.workq.comment(todo_id=item["id"], body="All clear: nothing is open after this check" + (
            " (" + str(len(resolved)) + " resolved)." if resolved else "."))
        api.workq.complete(todo_id=item["id"])
        state["todo_id"] = ""
        state["listed"] = []
        return "completed"
    listed = set(state.get("listed") or [])
    if rows and (not state.get("todo_id") or any(f["key"] not in listed for f in rows)):
        ck_new_item(client, settings, state, form_id)
        return "created"
    return "unchanged"
