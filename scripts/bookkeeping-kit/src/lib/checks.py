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
    "CHK-016": ("Banking", "Batch Payment Contains Unsupported Characters", "Low"),
    "CHK-040": ("Sales", "Quotes in Draft Status", "Low"),
    "CHK-078": ("Purchases", "Bills in Draft or Awaiting Approval", "Low"),
    "CHK-093": ("Purchases", "Purchase Orders in Draft or Awaiting Approval", "Low"),
    "CHK-137": ("Bookkeeping", "Non-GST Account Has GST Against It", "Medium"),
    # Built 21 Oct 2026 from the library owner's demo seed packs (their scenarios are the definitions).
    "CHK-041": ("Sales", "Different Account Name Detected for an Income Transaction", "Low"),
    "CHK-074": ("Purchases", "Accounts Payable Process Not Followed", "Low"),
    "CHK-081": ("Purchases", "Duplicate Bill Raised Advanced", "Medium"),
    "CHK-094": ("Purchases", "Different account name detected for an expense transaction", "Low"),
    "CHK-131": ("Bookkeeping", "Fuel Tax Credits May Be Unclaimed", "Medium"),
    "CHK-141": ("Bookkeeping", "Fixed Asset Account", "Low"),
    "CHK-170": ("Other", "ASIC Renewal Due or Not Paid", "High"),
    "CHK-036": ("Sales", "Unusual Monthly Invoicing", "Low"),
    "CHK-037": ("Sales", "Unusually Overdue Invoice Outside Normal Behaviour", "Low"),
    "CHK-038": ("Sales", "Grouped Overdue Invoices Outside Normal Behaviour", "Low"),
    "CHK-082": ("Purchases", "Unusual Monthly Billing", "Low"),
    "CHK-083": ("Purchases", "Unusually Overdue Bill Outside Normal Behaviour", "Low"),
    "CHK-084": ("Purchases", "Grouped Overdue Bill Outside Normal Behaviour", "Low"),
    # Fixed asset checks: need what Asset lookups (Xero Assets) saved.
    "CHK-139": ("Bookkeeping", "Draft Fixed Asset", "Low"),
    "CHK-140": ("Bookkeeping", "Unmapped Fixed Asset Account With Balance", "Low"),
    # Register checks: need what Register lookups (ABR) saved.
    "CHK-002": ("Contacts", "Bill Attachment With a Cancelled ABN", "High"),
    "CHK-003": ("Contacts", "Business Has Incorrect GST Status", "Medium"),
    "CHK-004": ("Contacts", "Incorrect ABN for Business", "Medium"),
    "CHK-005": ("Contacts", "Matched ABN for Business", "Medium"),
    "CHK-009": ("Contacts", "Donation Against Non-DGR Entity", "Low"),
    "CHK-030": ("Sales", "Invoice Raised With a Cancelled Customer", "High"),
    "CHK-039": ("Sales", "Unpaid Income With A Cancelled Business", "High"),
    "CHK-068": ("Purchases", "GST Claimed on Multiple Bills While Not Registered for GST", "Medium"),
    "CHK-069": ("Purchases", "GST on Multiple Bank Transactions While Not Registered for GST", "Medium"),
    "CHK-071": ("Purchases", "Bill Raised With A Cancelled Supplier", "High"),
    "CHK-072": ("Purchases", "Payment to a Cancelled Supplier", "High"),
    "CHK-076": ("Purchases", "Payment to Supplier Not Registered for GST", "Medium"),
    "CHK-077": ("Purchases", "Bank Payment With GST to a Supplier Not Registered for GST", "Medium"),
    "CHK-085": ("Purchases", "Bill Raised with Supplier Not Registered for GST", "Medium"),
    "CHK-088": ("Purchases", "Expenses With a Cancelled Business", "High"),
}
# Cadence (extension owner, 14 Oct 2026): fraud and duplicate checks daily, the rest weekly.
CK_DAILY = ("CHK-006", "CHK-017", "CHK-018", "CHK-028", "CHK-035", "CHK-055", "CHK-056", "CHK-057", "CHK-079",
            "CHK-080", "CHK-087", "CHK-081")
CK_WEEKLY = ("CHK-007", "CHK-008", "CHK-021", "CHK-022", "CHK-024", "CHK-031", "CHK-033", "CHK-058", "CHK-059",
             "CHK-086", "CHK-125", "CHK-129", "CHK-132", "CHK-133", "CHK-134", "CHK-135", "CHK-136", "CHK-138",
             "CHK-016", "CHK-040", "CHK-078", "CHK-093", "CHK-137", "CHK-041", "CHK-074", "CHK-094", "CHK-131",
             "CHK-141", "CHK-170", "CHK-036", "CHK-037", "CHK-038", "CHK-082", "CHK-083", "CHK-084")
# The weekly checks that read a list only they need (batch payments, quotes, purchase orders): when that list can't be
# read, the check isn't evaluated, so its open findings stay as they are instead of closing.
CK_SOURCE_CHECKS = {"batch_payments": "CHK-016", "quotes": "CHK-040", "purchase_orders": "CHK-093"}
# Weekly, and only when Asset lookups (Xero Assets) has saved results in the last fortnight.
CK_ASSETS = ("CHK-139", "CHK-140")
CK_ASSETS_DAYS = 14
# Weekly, and only when Register lookups (ABR) has saved results in the last fortnight.
CK_REGISTER = ("CHK-002", "CHK-003", "CHK-004", "CHK-005", "CHK-009", "CHK-030", "CHK-039", "CHK-068", "CHK-069",
               "CHK-071", "CHK-072", "CHK-076", "CHK-077", "CHK-085", "CHK-088")
CK_REGISTER_DAYS = 14
CK_HEURISTIC = ("CHK-003", "CHK-005", "CHK-009", "CHK-016", "CHK-056", "CHK-129", "CHK-133", "CHK-041", "CHK-074",
                "CHK-094", "CHK-131", "CHK-141", "CHK-036", "CHK-037", "CHK-038", "CHK-082", "CHK-083", "CHK-084")
# The GST-related checks: the GST checks section of the weekly report (CRA-10 GST Check).
CK_GST = ("CHK-003", "CHK-008", "CHK-031", "CHK-058", "CHK-059", "CHK-068", "CHK-069", "CHK-076", "CHK-077", "CHK-085",
          "CHK-129", "CHK-136", "CHK-137")
# Catalogue checks a built check already covers (decision D9: merged, not built twice). A finding carries them in "also",
# so the reports count it against both IDs. CHK-073 (bill from an unknown supplier) is the intake's New supplier warning.
CK_ALSO = {"CHK-033": ("CHK-032",), "CHK-028": ("CHK-034",), "CHK-058": ("CHK-075",)}
# Resolved findings are kept this long (enough for a financial year's comparison), so reports can show what got fixed.
CK_RESOLVED_KEEP_DAYS = 400
# Findings the client has to answer (receipts, ABNs, TPAR details): the Client Queries part of the weekly report.
CK_CLIENT_QUERY = ("CHK-007", "CHK-008", "CHK-021", "CHK-086")
CK_CATEGORIES = ("Contacts", "Banking", "Sales", "Purchases", "Bookkeeping", "Other")
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
# CHK-016 (heuristic): the characters a bank's direct-entry (ABA) file takes in a batch payment's text fields: letters,
# digits, spaces and & ' ( ) * + , - . / : ; ? @. Anything else (accents, curly quotes, #, $, %, _, emoji) is flagged.
CK_ABA_BAD = r"[^A-Za-z0-9 &'()*+,\-./:;?@]"
# CHK-081: bills whose numbers differ only by a short non-numeric ending (TEL-0515 and TEL-0515R), same amount, this close.
CK_SIMILAR_DAYS = 60
# CHK-170: ASIC, by the contact's name.
CK_ASIC = r"(?i)\basic\b|australian securities (and|&) investments commission"
# CHK-131 (heuristic): fuel suppliers and accounts, and the account fuel tax credits are usually recorded in.
CK_FUEL = (r"(?i)\b(bp|shell|caltex|ampol|mobil|7-eleven|united petroleum|puma energy|liberty oil|metro petroleum|"
           r"viva energy|on the run)\b")
CK_FUEL_ACCOUNT = r"(?i)\b(fuel|petrol|diesel)\b"
CK_FTC = r"(?i)fuel tax credit"
CK_FUEL_MIN = 1000.0
# CHK-041 / CHK-094 (heuristic): a contact with at least this many coded lines, this share of them on one account.
CK_USUAL_MIN = 4
CK_USUAL_SHARE = 0.75
# CHK-141 (heuristic): accumulated depreciation accounts, the words that say so, and fixed assets that aren't depreciated.
CK_ACCUM_DEP = r"(?i)accum|depreciation|\bdep\b"
CK_ACCUM_WORDS = ("less", "accumulated", "accum", "depreciation", "dep", "on", "of", "for", "the", "and", "provision")
CK_NOT_DEPRECIATED = r"(?i)\bland\b|goodwill|work in progress|\bwip\b"
# A manual run can look back further than the 35 days the daily checks cover (a test company's seeded history).
CK_LOOK_BACK_MAX_MONTHS = 18
# Behaviour checks (heuristic): a contact compared with its own history in what the run read.
# CHK-036 / CHK-082: this month or the 3 before it, at least 2.5 times the contact's usual month (the median of 3+ earlier
# months with any) and at least $500 more.
CK_RECENT_MONTHS = 4
CK_BASELINE_MONTHS = 3
CK_UNUSUAL_RATIO = 2.5
CK_UNUSUAL_MIN = 500.0
# CHK-037 / CHK-038 / CHK-083 / CHK-084: a contact that's usually paid within about the same number of days of the
# document date (75% of its paid documents within its median + 7 days), with one overdue document more than 30 days past
# that, or two or more over a week past it.
CK_ON_TIME_DAYS = 7
CK_ON_TIME_SHARE = 0.75
CK_OVERDUE_MIN_DAYS = 30


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
            "heuristic": check in CK_HEURISTIC, "also": list(CK_ALSO.get(check, ())),
            "fp": hashlib.sha256((full_key + "|" + (text if sig is None else str(sig))).encode("utf-8")).hexdigest()[:12]}


def ck_ref(key):
    """The short code printed on a finding's line, so a tick or the Check findings form can point at it."""
    return hashlib.sha256(str(key).encode("utf-8")).hexdigest()[:6].upper()


def ck_where(ledger):
    """The snapshot's ledger by name, for the finding texts ("Merge them in Xero")."""
    return bk_ledger_info((ledger or {}).get("ledger"))[0]


def ck_account_label(a):
    """An account as a finding names it: its code and name, or its own label (a QuickBooks account with no number has
    only its name; its code is QuickBooks' internal id)."""
    return a.get("label") or (a["code"] + " " + a["name"])


def ck_account_ref(accounts, code):
    """An account code as "453 Office Expenses" when it's in the chart, else the code itself."""
    return ck_account_label(accounts[code]) if code in accounts else str(code)


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
        # A ledger whose connector fingerprints bank accounts itself (MYOB) gives bank_h; others give the digits.
        h = c.get("bank_h") or ck_bank_hash(secret, c.get("bank"))
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
                                      + ". Merge them in " + ck_where(ledger) + ", or archive the one not used.", link=rows[0]["link"]))
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
def ck_similar_number(a, b):
    """True when two document numbers differ only by a short ending that isn't a number: TEL-0515 and TEL-0515R, or
    INV-7781 and INV-7781 copy, but not INV-100 and INV-1001."""
    x, y = bk_norm(a).replace(" ", ""), bk_norm(b).replace(" ", "")
    if not x or not y or x == y:
        return False
    if len(x) > len(y):
        x, y = y, x
    return len(x) >= 3 and y.startswith(x) and len(y) - len(x) <= 4 and not y[len(x)].isdigit()


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
                same_amount = abs(a["total"] - b["total"]) < 0.01
                close = gap is not None and gap <= CK_DUP_DAYS and same_amount
                similar = (not same_number and same_amount and gap is not None and gap <= CK_SIMILAR_DAYS
                           and ck_similar_number(a["number"], b["number"]))
                if same_number or close or similar:
                    pairs.append((a, b, same_number, gap, similar))
    return pairs


def ck_duplicate_rules(ledger, today, since):
    out = []
    docs = ledger.get("docs") or []
    for a, b, same_number, gap, similar in ck_pairs(docs, "bill", since):
        both_paid = a["status"] == "paid" and b["status"] == "paid"
        # Nearly the same number (a re-keyed or "R" copy) is the advanced duplicate, paid or not.
        check = "CHK-081" if similar else ("CHK-080" if both_paid else ("CHK-079" if same_number else "CHK-055"))
        why = ("nearly the same invoice number and the same amount" if similar else "the same invoice number" if same_number
               else "the same amount " + str(gap) + " day(s) apart")
        out.append(ck_finding(check, a["id"] + "|" + b["id"],
                              "Bills " + (a["number"] or "(no number)") + " (" + ck_date_text(a["date"]) + ") and "
                              + (b["number"] or "(no number)") + " (" + ck_date_text(b["date"]) + ") from " + b["contact"]
                              + " have " + why + (". Both are paid: ask the supplier for a refund or credit."
                                                  if both_paid else ". Void one if it's the same bill."),
                              amount=b["total"], link=b["link"], sig=a["status"] + b["status"]))
    for a, b, same_number, gap, similar in ck_pairs(docs, "invoice", since):
        both_paid = a["status"] == "paid" and b["status"] == "paid"
        out.append(ck_finding("CHK-035" if both_paid else "CHK-028", a["id"] + "|" + b["id"],
                              "Sales invoices " + (a["number"] or "(no number)") + " and " + (b["number"] or "(no number)")
                              + " to " + b["contact"] + (" have the same number" if same_number
                                                         else " have nearly the same number and the same amount" if similar
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
    where = ck_where(ledger)
    # Open sales invoices older than the window are fetched for the register checks only.
    docs = [d for d in ledger.get("docs") or [] if not d.get("older_open")]
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
    if no_abn:
        # One line per client, largest first: a file with many ABN-less suppliers would otherwise bury everything else.
        gst_of = {cid: sum(r["tax"] for r in rows) for cid, rows in no_abn.items()}
        ranked = sorted(no_abn, key=lambda cid: (-gst_of[cid], contacts[cid]["name"]))
        listed = [contacts[cid]["name"] + " " + ck_money(gst_of[cid]) for cid in ranked[:8]]
        out.append(ck_finding("CHK-008", "no-abn", ck_money(sum(gst_of.values())) + " GST claimed on purchases over "
                              + ck_money(BK_GST_INVOICE_LIMIT) + " from " + str(len(ranked)) + " supplier(s) with no ABN in " + where + ": "
                              + ", ".join(listed) + (" and " + str(len(ranked) - 8) + " more" if len(ranked) > 8 else "")
                              + ". Get their ABNs or tax invoices, or the GST can't be claimed.", amount=sum(gst_of.values()),
                              link=contacts[ranked[0]]["link"], sig="|".join(sorted(no_abn))))

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
                              + ck_date_text(lm_end) + " aren't reconciled. ("
                              + ("Statement lines not yet coded aren't counted: Xero doesn't share them.)" if where == "Xero"
                                 else "Bank feed lines not yet coded aren't counted.)"), amount=sum(abs(s["total"]) for s in loose),
                              sig="|".join(sorted(s["id"] for s in loose))))

    # CHK-024 / CHK-033: sales invoices never sent, and ones still in draft or awaiting approval.
    # Invoices this extension captured from PDFs are recorded without emailing on purpose, so they're left out.
    sales = [d for d in docs if d["kind"] == "invoice" and d["id"] not in captured]
    unsent = [d for d in sales if d["status"] in ("authorised", "paid") and d.get("sent") is False]
    if unsent:
        out.append(ck_finding("CHK-024", "unsent", str(len(unsent)) + " approved sales invoice(s) were never sent from " + where + " ("
                              + ck_names(unsent, "number") + "). Send them, or mark them sent if they went another way.",
                              amount=sum(d["total"] for d in unsent), link=unsent[0]["link"],
                              sig="|".join(sorted(d["id"] for d in unsent))))
    waiting = [d for d in sales if d["status"] in ("draft", "submitted")]
    if waiting:
        out.append(ck_finding("CHK-033", "waiting", str(len(waiting)) + " sales invoice(s) are in draft or awaiting approval ("
                              + ck_names(waiting, "number") + ").", amount=sum(d["total"] for d in waiting),
                              link=waiting[0]["link"], sig="|".join(sorted(d["id"] for d in waiting))))
    # CHK-078: bills still in draft or awaiting approval (bills waiting for a Bill review here are drafts too).
    held = [d for d in docs if d["kind"] == "bill" and d["status"] in ("draft", "submitted")]
    if held:
        out.append(ck_finding("CHK-078", "held", str(len(held)) + " bill(s) are in draft or awaiting approval ("
                              + ck_names(held, "contact") + "), so they aren't in the payables or the GST. Approve the ones "
                              "that are right; bills still waiting for a Bill review here clear when it's approved.",
                              amount=sum(d["total"] for d in held), link=held[0]["link"], sig="|".join(sorted(d["id"] for d in held))))
    # CHK-040 / CHK-093: quotes still in draft, and purchase orders in draft or awaiting approval.
    for check, rows, what in (("CHK-040", ledger.get("quotes") or [], "quote(s) " + (ledger.get("quote_state") or "are still in draft")),
                              ("CHK-093", ledger.get("purchase_orders") or [],
                               "purchase order(s) " + (ledger.get("order_state") or "are in draft or awaiting approval"))):
        if rows:
            out.append(ck_finding(check, "drafts", str(len(rows)) + " " + what + " (" + ck_names(rows, "number") + "). Send, approve "
                                  "or delete them.", amount=sum(r["total"] for r in rows), link=rows[0].get("link") or "",
                                  sig="|".join(sorted(r["id"] for r in rows))))
    # CHK-016 (heuristic): batch payment text a bank's direct-entry (ABA) file can't take.
    odd = []
    for bp in ledger.get("batch_payments") or []:
        bad = sorted({ch for t in bp["texts"] for ch in re.findall(CK_ABA_BAD, t)})
        if bad:
            odd.append((bp, bad))
    if odd:
        shown = ["batch of " + ck_date_text(bp["date"]) + " (" + " ".join(ch if ch.strip() else "a special space" for ch in bad) + ")"
                 for bp, bad in odd[:5]]
        out.append(ck_finding("CHK-016", "aba", str(len(odd)) + " batch payment(s) have text a bank's direct-entry file may reject: "
                              + "; ".join(shown) + (" and " + str(len(odd) - 5) + " more" if len(odd) > 5 else "") + ". Use letters, "
                              "numbers, spaces and & ' ( ) * + , - . / : ; ? @ only.", amount=sum(bp["total"] for bp, _b in odd),
                              link=odd[0][0].get("link") or "", sig="|".join(sorted(bp["id"] for bp, _b in odd))))

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
                              + ck_account_label(accounts[code]) + ", which normally has no GST. Check the tax code.",
                              amount=sum(taxes), sig="%d|%.2f" % (len(taxes), sum(taxes))))

    # CHK-137: GST on lines coded to an account whose own tax rate has none (CHK-058 already covers the accounts that never
    # carry GST by their name, so those are left to it).
    taxed_on = {}
    for d in purchases + [d for d in docs if d["kind"] in ("invoice", "invoice_credit", "bill_credit") and ck_live(d)]:
        for ln in d["lines"]:
            a = accounts.get(ln["account"])
            if (a and ln["tax"] > 0 and a.get("tax_type") and (rates.get(a["tax_type"]) or 0) == 0 and a["tax_type"] in rates
                    and ln["account"] not in by_account):
                taxed_on.setdefault(a["code"], []).append(ln["tax"])
    for code, taxes in taxed_on.items():
        out.append(ck_finding("CHK-137", code, ck_money(sum(taxes)) + " GST on " + str(len(taxes)) + " line(s) coded to "
                              + ck_account_label(accounts[code]) + ", whose tax rate (" + accounts[code]["tax_type"] + ") has no GST. Check the "
                              "tax code on those lines, or the account's tax rate.", amount=sum(taxes), sig="%d|%.2f" % (len(taxes), sum(taxes))))

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
                                  + (ck_account_label(accounts[code]) if code in accounts else code) + " use tax codes with GST ("
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
            out.append(ck_finding("CHK-125", a["code"] or a["id"], "Account " + (ck_account_label(a) if a["code"] else a["name"])
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
            out.append(ck_finding("CHK-129", code, "Account " + ck_account_label(a) + " defaults to GST, but " + str(zero)
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
        out.append(ck_finding("CHK-134", "lock-date", "No lock date is set in " + where + ", so past periods can still be changed.",
                              link=org.get("settings_link") or "", sig=""))
    elif lock < str(today - datetime.timedelta(days=CK_LOCK_MONTHS * 30)):
        out.append(ck_finding("CHK-134", "lock-date", "The lock date is " + ck_date_text(lock) + ", more than " + str(CK_LOCK_MONTHS)
                              + " months ago. Move it forward to the last period lodged.", link=org.get("settings_link") or "",
                              sig=lock))
    previous = snap.get("lock")
    # Only a lock date that existed and then moved back, or was removed, is a change: none before and none now isn't.
    if previous and (not lock or lock < previous):
        snap["lock_change"] = {"from": previous, "to": lock, "on": str(today)}
    snap["lock"] = lock
    if not (snap.get("lock_change") or {}).get("from"):
        snap.pop("lock_change", None)
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

    # CHK-170: an ASIC fee (the annual review, a late fee) that's overdue or due within a fortnight.
    for d in docs:
        due = ck_day(d["due"])
        who = str((contacts.get(d["contact_id"]) or {}).get("name") or d["contact"] or "")
        if (d["kind"] == "bill" and d["status"] == "authorised" and d["due_amount"] > 0 and due
                and due <= today + datetime.timedelta(days=CK_DUE_SOON_DAYS) and re.search(CK_ASIC, who)):
            late = due < today
            out.append(ck_finding("CHK-170", d["id"], "ASIC fee " + (d["number"] or "(no number)") + " of " + ck_money(d["due_amount"])
                                  + (" was due on " if late else " is due on ") + ck_date_text(d["due"]) + (" and is unpaid" if late else "")
                                  + ". ASIC charges a late fee, and an unpaid annual review can lead to the company being "
                                  "deregistered. Pay it, or record the payment if it was paid another way.",
                                  amount=d["due_amount"], link=d["link"], sig="late" if late else "due"))

    # CHK-074 (heuristic): spend money to a supplier that's normally billed, so the payment skipped the bill and its approval.
    billed = {}
    for d in docs:
        if d["kind"] == "bill" and ck_live(d) and d["contact_id"]:
            billed[d["contact_id"]] = billed.get(d["contact_id"], 0) + 1
    skipped = {}
    for s in ledger.get("bank") or []:
        if (s["kind"] == "spend" and s["contact_id"] in contacts and billed.get(s["contact_id"], 0) >= 2
                and s["total"] > BK_GST_INVOICE_LIMIT):
            skipped.setdefault(s["contact_id"], []).append(s)
    for cid, rows in skipped.items():
        out.append(ck_finding("CHK-074", cid, str(len(rows)) + " spend money payment(s) to " + contacts[cid]["name"] + " ("
                              + ", ".join(ck_date_text(r["date"]) for r in rows[:5]) + "), which is normally billed ("
                              + str(billed[cid]) + " bills). Enter the bill and pay it from there, so it goes through approval.",
                              amount=sum(r["total"] for r in rows), link=rows[0]["link"], sig="|".join(sorted(r["id"] for r in rows))))

    # CHK-131 (heuristic): fuel bought, and no fuel tax credits recorded in 12 months.
    fuel = [p for p in purchases
            if re.search(CK_FUEL, str((contacts.get(p["contact_id"]) or {}).get("name") or p.get("contact") or ""))
            or any(re.search(CK_FUEL_ACCOUNT, (accounts.get(ln["account"]) or {}).get("name") or "") for ln in p["lines"])]
    moved_12m = set((ledger.get("pl_12m") or {}).get("moved") or [])
    credited = any(re.search(CK_FTC, a["name"]) and a["id"] in moved_12m for a in ledger.get("accounts") or [])
    spent = sum(p["total"] for p in fuel)
    if spent >= CK_FUEL_MIN and not credited:
        out.append(ck_finding("CHK-131", "fuel", ck_money(spent) + " of fuel bought (" + ck_names(fuel, "contact") + ") and no "
                              "fuel tax credits recorded in the last 12 months. If the business uses fuel in heavy vehicles, in "
                              "machinery or off-road, it may be able to claim fuel tax credits on its BAS.",
                              amount=spent, sig="%d" % (spent // 1000)))

    # CHK-041 / CHK-094 (heuristic): a contact's income or expense coded to another account than the one it nearly always uses.
    incomes = [d for d in docs if d["kind"] == "invoice" and ck_live(d)] + [s for s in ledger.get("bank") or [] if s["kind"] == "receive"]
    for check, rows, what in (("CHK-094", purchases, "expense"), ("CHK-041", incomes, "income")):
        used, named = {}, {}
        for r in rows:
            for ln in r["lines"]:
                if r["contact_id"] and ln["account"]:
                    used.setdefault(r["contact_id"], []).append((r, ln["account"]))
                    named[r["contact_id"]] = (contacts.get(r["contact_id"]) or {}).get("name") or r.get("contact") or r["contact_id"]
        for cid, pairs in used.items():
            counts = {}
            for _r, code in pairs:
                counts[code] = counts.get(code, 0) + 1
            usual = max(sorted(counts), key=lambda c: counts[c])
            if len(pairs) < CK_USUAL_MIN or counts[usual] < CK_USUAL_SHARE * len(pairs) or counts[usual] == len(pairs):
                continue
            odd, seen_ids = [], set()
            for r, code in pairs:
                if code != usual and r["id"] not in seen_ids:
                    seen_ids.add(r["id"])
                    odd.append((r, code))
            shown = ["%s %s → %s" % ("bill" if r.get("kind") == "bill" else "invoice" if r.get("kind") == "invoice" else "payment",
                                       r.get("number") or ck_date_text(r["date"]), ck_account_ref(accounts, code)) for r, code in odd[:5]]
            out.append(ck_finding(check, cid, named[cid] + "'s " + what + " is nearly always coded to "
                                  + ck_account_ref(accounts, usual)
                                  + " (" + str(counts[usual]) + " of " + str(len(pairs)) + " lines), but not here: " + "; ".join(shown)
                                  + ". Check the coding.", amount=sum(r["total"] for r, _c in odd), link=odd[0][0]["link"],
                                  sig="|".join(sorted(r["id"] + ">" + code for r, code in odd))))

    # CHK-138: profit and loss accounts with no movement in 12 months.
    moved = set((ledger.get("pl_12m") or {}).get("moved") or [])
    idle = [a for a in ledger.get("accounts") or [] if a["active"] and a["pl"] and a["code"] and a["id"] not in moved]
    if idle:
        idle.sort(key=lambda a: a["code"])
        out.append(ck_finding("CHK-138", "inactive", str(len(idle)) + " profit and loss account(s) haven't been used in 12 months: "
                              + ", ".join(ck_account_label(a) for a in idle[:8]) + (" and more" if len(idle) > 8 else "")
                              + ". Archive the ones that aren't needed.", sig="|".join(a["code"] for a in idle)))
    return out + ck_behaviour_rules(ledger, contacts, today)


# ── Behaviour checks (weekly, heuristic): a contact's month, or its overdue documents, against its own history ──
def ck_median(values):
    v = sorted(values)
    n = len(v)
    if not n:
        return 0.0
    return v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2


def ck_recent_months(today):
    """This month and the CK_RECENT_MONTHS - 1 before it, as YYYY-MM."""
    m = today.replace(day=1)
    out = [str(m)[:7]]
    for _ in range(CK_RECENT_MONTHS - 1):
        m = (m - datetime.timedelta(days=1)).replace(day=1)
        out.append(str(m)[:7])
    return out


def ck_age(d, today):
    dated = ck_day(d["date"])
    return (today - dated).days if dated else 0


def ck_days_over(d, today):
    due = ck_day(d["due"])
    return (today - due).days if due else 0


def ck_behaviour_rules(ledger, contacts, today):
    out = []
    docs = ledger.get("docs") or []
    recent = ck_recent_months(today)
    # A document's own contact name when the contact isn't listed (QuickBooks lists suppliers only, not customers).
    names = {cid: c["name"] for cid, c in contacts.items()}
    for d in docs:
        if d["contact_id"] and d["contact_id"] not in names:
            names[d["contact_id"]] = d["contact"] or d["contact_id"]
    # CHK-036 / CHK-082: a month far above the contact's usual month.
    for kind, check, verb in (("invoice", "CHK-036", "was invoiced"), ("bill", "CHK-082", "billed")):
        months = {}
        for d in docs:
            # Open documents from before the window are read for what's owed only: they'd make partial months.
            if d["kind"] == kind and ck_live(d) and d["contact_id"] and d["date"] and not d.get("older_open"):
                months.setdefault(d["contact_id"], {}).setdefault(d["date"][:7], []).append(d)
        for cid, by_month in months.items():
            totals = {m: sum(x["total"] for x in rows) for m, rows in by_month.items()}
            for month in recent:
                total = totals.get(month) or 0
                earlier = [t for m, t in totals.items() if m < month and t > 0]
                usual = ck_median(earlier)
                if (len(earlier) >= CK_BASELINE_MONTHS and total >= CK_UNUSUAL_RATIO * usual
                        and total - usual >= CK_UNUSUAL_MIN):
                    rows = sorted(by_month[month], key=lambda x: -x["total"])
                    named = datetime.date.fromisoformat(month + "-01").strftime("%B %Y")
                    out.append(ck_finding(check, cid + ":" + month, names[cid] + " " + verb + " " + ck_money(total) + " in "
                                          + named + " (" + ck_names(rows, "number") + "), against a usual " + ck_money(usual)
                                          + " a month (" + str(len(earlier)) + " earlier months). Check it's right.",
                                          amount=total, link=rows[0]["link"], sig="%.2f" % total))
    # CHK-037 / CHK-038 / CHK-083 / CHK-084: overdue, from a contact that's usually paid within about the same number of
    # days of the document date (measured from the date, as only open documents carry their due dates on every ledger).
    for kind, single, group, noun, who in (("invoice", "CHK-037", "CHK-038", "invoice", "customer"),
                                           ("bill", "CHK-083", "CHK-084", "bill", "supplier")):
        history, open_late = {}, {}
        for d in docs:
            dated, paid = ck_day(d["date"]), ck_day(d.get("paid_on"))
            if d["kind"] != kind or not d["contact_id"] or not dated:
                continue
            if d["status"] == "paid" and paid and paid >= dated:
                history.setdefault(d["contact_id"], []).append((paid - dated).days)
            elif d["status"] == "authorised" and d["due_amount"] > 0 and ck_days_over(d, today) > 0:
                open_late.setdefault(d["contact_id"], []).append(d)
        for cid, rows in open_late.items():
            past = history.get(cid) or []
            usual = ck_median(past)
            steady = [x for x in past if x <= usual + CK_ON_TIME_DAYS]
            if not past or len(steady) < CK_ON_TIME_SHARE * len(past):
                continue
            late = sorted([x for x in rows if ck_age(x, today) > usual + CK_ON_TIME_DAYS], key=lambda x: (-ck_age(x, today), x["id"]))
            habit = "usually paid within about " + str(int(round(usual))) + " days (" + str(len(past)) + " paid)"
            to = "to " if kind == "invoice" else "from "
            if len(late) >= 2:
                owed = sum(x["due_amount"] for x in late)
                listed = ", ".join((x["number"] or "(no number)") + " " + str(ck_days_over(x, today)) + " days" for x in late[:5])
                out.append(ck_finding(group, cid, str(len(late)) + " " + noun + "s " + to + names[cid] + " ("
                                      + ck_money(owed) + ") are overdue (" + listed + "), though its " + noun + "s are " + habit
                                      + ". Check whether something has changed with this " + who + ".", amount=owed,
                                      link=late[0]["link"], sig="|".join(sorted(x["id"] for x in late))))
            elif late and ck_age(late[0], today) > usual + CK_OVERDUE_MIN_DAYS:
                d = late[0]
                out.append(ck_finding(single, d["id"], noun.capitalize() + " " + (d["number"] or "(no number)") + " " + to
                                      + names[cid] + " (" + ck_money(d["due_amount"]) + ") is " + str(ck_days_over(d, today))
                                      + " days overdue, though its " + noun + "s are " + habit + ". "
                                      + ("Follow it up with the customer." if kind == "invoice" else "Check why it hasn't been paid."),
                                      amount=d["due_amount"], link=d["link"], sig=d["id"]))
    return out


# ── Register checks (weekly, from what Register lookups saved; skipped when there's nothing recent) ──
def ck_cancelled_on(row, day):
    """True when the register shows the ABN cancelled on or before the day."""
    return bool(row and row.get("found") and str(row.get("status") or "").lower().startswith("cancel")
                and (not row.get("status_from") or str(row["status_from"]) <= str(day)))


def ck_gst_off(row, day):
    """True when the register shows the business wasn't registered for GST on the day."""
    if not row or not row.get("found"):
        return False
    start, end = str(row.get("gst_from") or ""), str(row.get("gst_to") or "")
    return not start or str(day) < start or bool(end and str(day) > end)


def ck_by_contact(rows, contacts, test):
    """Documents grouped by contact, for those the test picks."""
    out = {}
    for r in rows:
        if r.get("contact_id") in contacts and test(r):
            out.setdefault(r["contact_id"], []).append(r)
    return out


def ck_register_rules(ledger, client, cache, intake_abns, today):
    out = []
    reg = (cache or {}).get("abns") or {}
    contacts = {c["id"]: c for c in ledger.get("contacts") or []}
    row_of = {cid: reg.get(c.get("tax_number") or "") for cid, c in contacts.items()}
    docs = ledger.get("docs") or []
    bills = [d for d in docs if d["kind"] == "bill" and ck_live(d)]
    sales = [d for d in docs if d["kind"] == "invoice" and ck_live(d)]
    spend = [s for s in ledger.get("bank") or [] if s["kind"] == "spend"]
    accounts = {a["code"]: a for a in ledger.get("accounts") or [] if a.get("code")}

    def line(check, key, cid, rows, what, amount_field="total"):
        amount = sum(r.get(amount_field) or 0 for r in rows)
        out.append(ck_finding(check, key + ":" + cid, what, amount=amount, link=contacts[cid]["link"],
                              sig="|".join(sorted(r["id"] for r in rows))))

    def cancelled_text(cid):
        r = row_of[cid] or {}
        return contacts[cid]["name"] + "'s ABN " + contacts[cid]["tax_number"] + " was cancelled on " + ck_date_text(r.get("status_from"))

    # Cancelled businesses: bills raised (CHK-071), bills paid (CHK-072), spend money (CHK-088), sales (CHK-030),
    # and money still owed to the client by one (CHK-039).
    for check, rows, when, what in (
            ("CHK-071", bills, "date", "bill(s) dated after it"),
            ("CHK-072", [b for b in bills if b.get("paid_on")], "paid_on", "bill(s) paid after it"),
            ("CHK-088", spend, "date", "spend money payment(s) after it"),
            ("CHK-030", sales, "date", "sales invoice(s) raised after it")):
        for cid, hit in ck_by_contact(rows, contacts, lambda r: ck_cancelled_on(row_of.get(r.get("contact_id")), r.get(when))).items():
            line(check, "cancelled", cid, hit, cancelled_text(cid) + ", and there are " + str(len(hit)) + " " + what
                 + ". Check the business still exists and the payee is right.")
    owed = ck_by_contact([d for d in sales if d["status"] == "authorised" and d["due_amount"] > 0], contacts,
                         lambda r: ck_cancelled_on(row_of.get(r.get("contact_id")), today))
    for cid, hit in owed.items():
        line("CHK-039", "owed", cid, hit, cancelled_text(cid) + ", and it still owes " + ck_money(sum(d["due_amount"] for d in hit))
             + " on " + str(len(hit)) + " invoice(s). Chase it now, or consider writing it off.", amount_field="due_amount")

    # GST from businesses the register shows weren't registered for GST at the time: unpaid bills (one: CHK-085,
    # several: CHK-068), bills already paid (CHK-076), spend money (one: CHK-077, several: CHK-069).
    taxed = lambda r: r["tax"] > 0 and ck_gst_off(row_of.get(r.get("contact_id")), r.get("date"))
    for cid, hit in ck_by_contact([b for b in bills if b["status"] != "paid"], contacts, taxed).items():
        line("CHK-068" if len(hit) > 1 else "CHK-085", "gst", cid, hit, ck_money(sum(r["tax"] for r in hit)) + " GST on "
             + str(len(hit)) + " unpaid bill(s) from " + contacts[cid]["name"] + ", which the register shows wasn't registered for "
             "GST at the time. Ask for a corrected invoice before paying; that GST can't be claimed.", amount_field="tax")
    for cid, hit in ck_by_contact([b for b in bills if b["status"] == "paid"], contacts, taxed).items():
        line("CHK-076", "gst-paid", cid, hit, ck_money(sum(r["tax"] for r in hit)) + " GST paid on " + str(len(hit)) + " bill(s) from "
             + contacts[cid]["name"] + ", which the register shows wasn't registered for GST at the time. That GST can't be "
             "claimed: recode it and ask the supplier for a refund.", amount_field="tax")
    for cid, hit in ck_by_contact(spend, contacts, taxed).items():
        line("CHK-069" if len(hit) > 1 else "CHK-077", "gst-spend", cid, hit, ck_money(sum(r["tax"] for r in hit)) + " GST on "
             + str(len(hit)) + " spend money payment(s) to " + contacts[cid]["name"] + ", which the register shows wasn't "
             "registered for GST at the time. That GST can't be claimed.", amount_field="tax")

    # CHK-003 (heuristic): registered for GST, yet every recent purchase from them claims none.
    no_gst = ck_by_contact(bills + spend, contacts, lambda r: True)
    for cid, rows in no_gst.items():
        r = row_of.get(cid)
        if (client.get("gst_registered") and r and r.get("found") and r.get("gst_registered") and len(rows) >= 2
                and all(x["tax"] == 0 for x in rows)):
            line("CHK-003", "gst-status", cid, rows, contacts[cid]["name"] + " is registered for GST, but none of its " + str(len(rows))
                 + " recent purchases claim any. Check whether GST should be claimed.")

    # CHK-004: ABNs in Xero that fail the checksum, aren't on the register, or belong to a differently named business.
    wrong = []
    for cid, c in contacts.items():
        r = row_of.get(cid)
        if not c.get("tax_number") or not r:
            continue
        if r.get("valid_checksum") is False:
            wrong.append(c["name"] + " (" + c["tax_number"] + " fails the ABN checksum)")
        elif not r.get("found"):
            wrong.append(c["name"] + " (" + c["tax_number"] + " isn't on the register)")
        else:
            mine = set(w for w in bk_norm(c["name"]).split() if len(w) >= 3)
            theirs = set(w for n in [r.get("entity_name")] + list(r.get("names") or []) for w in bk_norm(n).split() if len(w) >= 3)
            if mine and theirs and not mine & theirs:
                wrong.append(c["name"] + " (" + c["tax_number"] + " is registered to " + str(r.get("entity_name") or "another business") + ")")
    if wrong:
        out.append(ck_finding("CHK-004", "wrong-abn", str(len(wrong)) + " contact(s) have an ABN in " + ck_where(ledger) + " that looks wrong: "
                              + "; ".join(wrong[:6]) + (" and " + str(len(wrong) - 6) + " more" if len(wrong) > 6 else "")
                              + ". Correct the ABN on the contact.", sig="|".join(sorted(wrong))))

    # CHK-005 (heuristic): a confident register match for a supplier with no ABN in Xero.
    # Only suppliers that still have no ABN in Xero: once it's added, the finding closes.
    still_missing = {bk_norm(c["name"]) for c in contacts.values() if len(c.get("tax_number") or "") != 11}
    matches = [(v.get("name"), v["match"]) for key, v in ((cache or {}).get("names") or {}).items()
               if v.get("match") and key in still_missing]
    if matches:
        matches.sort(key=lambda m: str(m[0]))
        out.append(ck_finding("CHK-005", "matched-abn", "The register has a likely ABN for " + str(len(matches)) + " supplier(s) with "
                              "none in " + ck_where(ledger) + ": " + "; ".join(str(n) + " → " + m["abn"] + " (" + str(m.get("name") or "") + ")"
                                                            for n, m in matches[:6])
                              + ". Confirm with the supplier, then add it to the contact.",
                              sig="|".join(sorted(m["abn"] for _n, m in matches))))

    # CHK-009 (heuristic): purchases coded to a donations account, paid to a body the register doesn't show as a DGR.
    gifts = ck_by_contact(bills + spend, contacts, lambda r: any(
        re.search(r"(?i)\b(donations?|gifts?)\b", (accounts.get(ln["account"]) or {}).get("name") or "") for ln in r["lines"]))
    for cid, rows in gifts.items():
        r = row_of.get(cid)
        if contacts[cid].get("tax_number") and not r:
            continue  # its ABN hasn't been looked up yet
        if not (r and r.get("found") and r.get("dgr_endorsed")):
            line("CHK-009", "dgr", cid, rows, str(len(rows)) + " payment(s) coded as donations to " + contacts[cid]["name"]
                 + (", which the register doesn't show as a deductible gift recipient" if r and r.get("found")
                    else ", which has no ABN on the register to confirm it's a deductible gift recipient")
                 + ". The client may not be able to claim them as a tax deduction.")

    # CHK-002: a bill PDF from this supplier showed an ABN the register lists as cancelled (from Process bill's reads).
    for key, seen in (intake_abns or {}).items():
        # Only the ABN on the supplier's latest PDF: a sole trader who moved to a company ABN has an old, cancelled
        # one on earlier bills, which is fine.
        dead = [a for a in (seen or [])[-1:] if ck_cancelled_on(reg.get(a), today)]
        if dead and key in contacts:
            out.append(ck_finding("CHK-002", "pdf:" + key, "A bill PDF from " + contacts[key]["name"] + " showed ABN " + ", ".join(dead)
                                  + ", which the register lists as cancelled. Check who's really invoicing.",
                                  link=contacts[key]["link"], sig="|".join(dead)))
    if (cache or {}).get("test_register"):
        # A test company's answers come from a file (Register lookups' test register): say so on every finding.
        for f in out:
            f["text"] += " (Test register, not the Australian Business Register.)"
    return out


def ck_report_path(ledger):
    """Where a pack records its last weekly report: one file per ledger pack, so each keeps its own week."""
    return BK_CHECKS + ("/_report.json" if bk_ledger_info(ledger)[0] == "Xero" else "/_report-" + str(ledger) + ".json")


def ck_register_fresh(cache, today):
    day = ck_day((cache or {}).get("refreshed"))
    return bool(day and (today - day).days <= CK_REGISTER_DAYS)


# ── Fixed asset checks (weekly, from what Asset lookups saved: the Xero Assets register isn't in the accounting API) ──
def ck_asset_rules(ledger, cache, today):
    """cache: {refreshed, draft: [{id, name, number, price, date, link}], type_accounts: [account ids an asset type uses]}."""
    out = []
    draft = cache.get("draft") or []
    if draft:
        out.append(ck_finding("CHK-139", "draft", str(len(draft)) + " fixed asset(s) are still in draft in Xero (" + ck_names(draft)
                              + "), so they aren't depreciating. Register them, or delete the ones that aren't assets.",
                              amount=sum(a.get("price") or 0 for a in draft), link=draft[0].get("link") or "",
                              sig="|".join(sorted(a["id"] for a in draft))))
    used = set(cache.get("type_accounts") or [])
    now = (ledger.get("balances") or {}).get("now") or {}
    for a in ledger.get("accounts") or []:
        bal = now.get(a["id"]) or 0
        if a["type"] == "FIXED" and a["active"] and abs(bal) >= 0.01 and a["id"] not in used:
            out.append(ck_finding("CHK-140", a["code"] or a["id"], "Fixed asset account " + (a["code"] + " " if a["code"] else "")
                                  + a["name"] + " has a balance of " + ck_money(abs(bal)) + ", but no asset type in Xero's fixed asset "
                                  "register uses it, so what's in it isn't registered or depreciated. Add it to an asset type, or "
                                  "register the assets.", amount=abs(bal), sig="%.2f" % bal))
    return out


def ck_depreciation_rules(ledger, used, skip):
    """CHK-141 (heuristic): fixed asset accounts with a balance and no accumulated depreciation account of their own, so
    they don't look depreciated. used: accounts an asset type in Xero's fixed asset register uses (depreciated there);
    skip: accounts CHK-140 already reported this run. A single general accumulated depreciation account could cover any
    of them, so then nothing is reported."""
    out = []
    now = (ledger.get("balances") or {}).get("now") or {}
    fixed = [a for a in ledger.get("accounts") or [] if "fixed" in str(a.get("type") or "").lower().replace(" ", "")]
    covers = []
    for a in fixed:
        if re.search(CK_ACCUM_DEP, a["name"]):
            words = set(bk_norm(a["name"]).split()) - set(CK_ACCUM_WORDS)
            if not words:
                return []
            covers.append(words)
    for a in fixed:
        bal = now.get(a["id"]) or 0
        words = set(bk_norm(a["name"]).split())
        if (re.search(CK_ACCUM_DEP, a["name"]) or re.search(CK_NOT_DEPRECIATED, a["name"]) or not a["active"] or bal < 0.01
                or a["id"] in used or (a["code"] or a["id"]) in skip or not words or any(words <= c for c in covers)):
            continue
        out.append(ck_finding("CHK-141", a["code"] or a["id"], "Fixed asset account " + (a["code"] + " " if a["code"] else "")
                              + a["name"] + " has a balance of " + ck_money(bal) + " but no accumulated depreciation account of "
                              "its own, so it doesn't look depreciated. Set up depreciation for it, or check it's in the "
                              "fixed asset register.", amount=bal, sig="%.2f" % bal))
    return out


def ck_assets_fresh(cache, today):
    day = ck_day((cache or {}).get("refreshed"))
    return bool(day and (today - day).days <= CK_ASSETS_DAYS)


def ck_run(ledger, client, snap, today, secret, captured, register=None, intake_abns=None, assets=None, look_back_days=0):
    """Every check due on this run. Returns (findings, the check IDs evaluated). look_back_days widens the daily checks'
    35 days (a test company's seeded history, set on a manual run)."""
    # What Register lookups needs for the next night: the client's ABNs, and suppliers with GST but no ABN.
    spenders = {}
    by_id = {c["id"]: c for c in ledger.get("contacts") or []}
    for p in ck_purchases(ledger):
        c = by_id.get(p.get("contact_id"))
        if c and len(c.get("tax_number") or "") != 11:
            spenders[c["name"]] = spenders.get(c["name"], 0) + p["total"]
    snap["register"] = {"abns": sorted({c["tax_number"] for c in ledger.get("contacts") or [] if len(c.get("tax_number") or "") == 11}),
                        "no_abn": [n for n, _t in sorted(spenders.items(), key=lambda kv: -kv[1])][:20]}
    since = today - datetime.timedelta(days=max(CK_DAILY_DAYS, look_back_days or 0))
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
        # Register findings close when their data goes stale (Register lookups unpublished or failing for a
        # fortnight) rather than staying open for good; the checklist says the register checks are paused.
        snap["register_paused"] = bool(register) and not ck_register_fresh(register, today)
        snap["register_test"] = str((register or {}).get("test_register") or "")
        if ck_register_fresh(register, today):
            found += ck_register_rules(ledger, client, register, intake_abns, today)
        evaluated |= set(CK_REGISTER)
        # Fixed asset findings close the same way when Asset lookups stops (unpublished, or Xero Assets disconnected).
        fresh_assets = ck_assets_fresh(assets, today)
        asset_found = ck_asset_rules(ledger, assets, today) if fresh_assets else []
        found += asset_found
        evaluated |= set(CK_ASSETS)
        found += ck_depreciation_rules(ledger, set((assets or {}).get("type_accounts") or []) if fresh_assets else set(),
                                       {f["key"].split(":", 1)[1] for f in asset_found if f["check"] == "CHK-140"})
        # A list that couldn't be read leaves its check's findings as they were.
        evaluated -= {CK_SOURCE_CHECKS[s] for s in ledger.get("unread") or [] if s in CK_SOURCE_CHECKS}
    # Checks the ledger can't answer (the adapter's "na": check ID -> why, e.g. MYOB's API has no attachments) aren't
    # run at all: no findings, and not evaluated, so they never read as clear.
    na = ledger.get("na") or {}
    return [f for f in found if f["check"] not in na], evaluated - set(na)


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
    log = [r for r in (state.get("resolved") or [])
           if str(r.get("on") or "") >= str(today - datetime.timedelta(days=CK_RESOLVED_KEEP_DAYS))]
    for key in list(findings):
        if key not in current and findings[key]["check"] in evaluated:
            if findings[key].get("status") == "open":
                resolved.append(findings[key])
                # Only what a report needs: no finding text (names, amounts per contact) kept after it's fixed.
                log.append({"check": findings[key]["check"], "key": key, "amount": findings[key].get("amount"),
                            "first_seen": findings[key].get("first_seen"), "on": str(today)})
            findings.pop(key)
            dismissed.pop(key, None)
            snoozed.pop(key, None)
    for key in list(snoozed):
        if key in findings and findings[key]["status"] == "snoozed" and str(snoozed[key].get("until") or "") <= str(today):
            snoozed.pop(key)
            findings[key]["status"] = "open"
            new.append(findings[key])
    state["resolved"] = log
    return new, resolved


def ck_open(state):
    rows = [f for f in (state.get("findings") or {}).values() if f.get("status") == "open"]
    rows.sort(key=lambda f: (CK_CATEGORIES.index(f["category"]) if f["category"] in CK_CATEGORIES else 9,
                             CK_SEVERITY_RANK.get(f["severity"], 9), -(f.get("amount") or 0), f["key"]))
    return rows


def ck_line(f, where="Xero"):
    """One checklist line in the D7 format: severity, check, $ at risk, what to do, the link and its ref."""
    parts = ["**" + f["severity"] + "**", f["check"] + " " + f["name"]]
    if f.get("amount") is not None:
        parts.append(ck_money(f["amount"]))
    text = f["text"] + (" (a heuristic reading, to be confirmed)" if f.get("heuristic") else "")
    if f.get("link"):
        text += " [Open in " + where + "](" + f["link"] + ")"
    parts.append(text)
    return "- [ ] " + " — ".join(parts) + " · ref " + ck_ref(f["key"])


def ck_priority(rows):
    best = min((CK_SEVERITY_RANK.get(f["severity"], 9) for f in rows), default=9)
    return {0: "high", 1: "medium"}.get(best, "low")


def ck_look_back_days(state):
    """Days a manual run asked the checks to look back (0: the usual 35 days and this financial year)."""
    months = int((state or {}).get("look_back_months") or 0)
    return min(max(months, 0), CK_LOOK_BACK_MAX_MONTHS) * 31


def ck_description(client, state, truncated=None):
    rows = ck_open(state)
    where, _key, _file, name_key = bk_ledger_info(client.get("ledger"))
    out = ["Ledger checks for **" + str(client.get("name") or "") + "** (" + where + ": " + str(client.get(name_key) or "") + "). "
           "Fix each one in " + where + "; it drops off this list on the next check.", ""]
    if ck_look_back_days(state):
        out += ["**Looking back " + str(state.get("look_back_months")) + " months** (set on a manual run, for a test company): "
                "the daily checks cover that far back instead of 35 days, and the weekly ones read that much of the file. "
                "Run Ledger checks by hand for this business with 0 to go back to normal.", ""]
    test = (state.get("snapshot") or {}).get("register_test")
    if test:
        out += ["**Test register:** this business's ABN results come from `" + str(test) + "`, not the Australian Business "
                "Register. Only for a test company: delete the file to use the register again.", ""]
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
            out.append(ck_line(f, where))
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
    if (state.get("snapshot") or {}).get("register_paused"):
        out.append("")
        out.append("Register checks (cancelled ABNs, GST registration, DGR) are paused: Register lookups (ABR) hasn't "
                   "reached the register in the last fortnight.")
    if truncated:
        out.append("")
        out.append("Some data was cut short (" + ", ".join(truncated) + "): the checks covered the first 2,000 of each."
                   if where == "Xero" else "Some data couldn't all be read (" + ", ".join(truncated) + "): the checks covered what was.")
    if state.get("na"):
        out.append("")
        out.append("Not checked, as " + where + ("'" if where.endswith("s") else "'s") + " API doesn't give what they need: " + ", ".join(state["na"])
                   + ". The extension's README says why for each.")
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
