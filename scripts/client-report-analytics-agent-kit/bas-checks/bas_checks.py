# BAS readiness checks for ONE BAS period, read through the Xero API connector (xero-api).
# Line-for-line port of myhub-mcp-servers src/integrations/xero-accounting/api/bas-readiness-checks.ts (origin/dev,
# 27 Nov 2026), which ran on the retiring xero-accounting MCP server. Same reads, same rules, same result shape, so the
# Client Reporting Agent's BAS review reads it exactly as before. Read-only: nothing in Xero is changed.
# JavaScript arithmetic is reproduced on purpose (Math.round, toFixed, month overflow) so figures match to the cent.
import math
import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

GST_INVOICE_LIMIT = 82.5
GST_TURNOVER = 75000
DUPLICATE_WINDOW_DAYS = 7
LOCK_MONTHS = 6
MAX_ITEMS = 10
DELIBERATE_NO_GST = {"EXEMPTEXPORT", "INPUTTAXED"}
BULK_CHANGE_DAY = 20
MAX_PAGES = 20
MAX_PERIOD_DAYS = 366
MAX_ABNS_TO_CHECK = 100
XERO = "xero-api"

NON_CLAIMABLE = re.compile(r"\b(wages?|salar(y|ies)|superannuation|super|payg|bank (fees?|charges?)|interest|depreciation|amortis\w*|asic|stamp duty|fines?|penalt\w*|donations?|land tax|income tax|fbt|drawings|dividends?)\b", re.I | re.A)
SUSPENSE = re.compile(r"\b(suspense|uncoded|unallocated|holding|uncategori[sz]ed|ask my accountant)\b|^(?!.*\b(payroll|wages?|payg)\b).*\bclearing\b", re.I | re.A)

GROUPS = [
    "gstChargedWhileUnregistered", "gstOnNonClaimableItems", "gstAmountMismatch", "gstWithoutAbn",
    "gstFromUnregisteredSuppliers", "gstRegistrationRequired", "unreconciledBank", "suspenseBalance", "cancelledAbn",
    "duplicateBills", "gstStatusMismatch", "gstAccountWithoutGst", "missingReceipts", "draftSalesInvoices", "lockDate",
    "taxCodeMismatch", "priorPeriodAdjustments",
]
NEEDS_ABR = ["gstFromUnregisteredSuppliers", "cancelledAbn", "gstStatusMismatch"]


# ---- JavaScript-compatible helpers -------------------------------------------------------------------------------
def js_round(x: float) -> float:
    return math.floor(x + 0.5)


def round2(n: float) -> float:
    return js_round(n * 100) / 100


def fixed2(x: float) -> str:
    """Number.prototype.toFixed(2): the exact binary value, ties away from zero."""
    return str(Decimal(x).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)) if x == x else "NaN"


def js_str(x: Any) -> str:
    """String(number) for the values used in messages (integers print without a decimal point)."""
    if isinstance(x, bool):
        return "true" if x else "false"
    if isinstance(x, (int, float)):
        if isinstance(x, float) and x.is_integer():
            return str(int(x))
        return repr(x) if isinstance(x, float) else str(x)
    return str(x)


def num(v: Any) -> float:
    if isinstance(v, bool):
        return 1.0 if v else 0.0
    if isinstance(v, (int, float)):
        return float(v) if v == v else 0.0
    if v is None:
        return 0.0
    try:
        s = str(v).strip()
        if s == "":
            return 0.0
        f = float(s)
        return f if f == f and not math.isinf(f) else 0.0
    except ValueError:
        return 0.0


def s_(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float):
        return js_str(v)
    return str(v)


def parse_ms(day: str) -> int:
    d = datetime.strptime(day, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return int(d.timestamp() * 1000)


def iso_from_ms(ms: int) -> str:
    return (datetime(1970, 1, 1, tzinfo=timezone.utc) + timedelta(milliseconds=ms)).strftime("%Y-%m-%d")


def is_real_day(s: str) -> bool:
    if not isinstance(s, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        return False
    try:
        return datetime.strptime(s, "%Y-%m-%d").strftime("%Y-%m-%d") == s
    except ValueError:
        return False


def iso_day(raw: Any) -> str:
    st = s_(raw)
    m = re.match(r"^(\d{4}-\d{2}-\d{2})", st)
    if m:
        return m.group(1)
    m = re.search(r"/Date\((\d+)", st) if isinstance(raw, str) else None
    return iso_from_ms(int(m.group(1))) if m else ""


def day_gap(a: str, b: str):
    if not a or not b:
        return None
    return abs(parse_ms(a) - parse_ms(b)) / 86400000


def js_add_months(day: str, months: int) -> str:
    """new Date(day).setUTCMonth(month + months): overflowing days roll into the next month, as JavaScript does."""
    y, m, d = (int(p) for p in day.split("-"))
    total = (y * 12 + (m - 1)) + months
    ny, nm = divmod(total, 12)
    first = datetime(ny, nm + 1, 1)
    return (first + timedelta(days=d - 1)).strftime("%Y-%m-%d")


def js_add_years_plus_day(day: str, years: int) -> str:
    """setUTCFullYear(y + years) then setUTCDate(d + 1), with JavaScript's day overflow (29 Feb rolls to 1 Mar)."""
    y, m, d = (int(p) for p in day.split("-"))
    first = datetime(y + years, m, 1)
    return (first + timedelta(days=d - 1) + timedelta(days=1)).strftime("%Y-%m-%d")


def norm_number(n: str) -> str:
    return re.sub(r"[^a-z0-9]", "", n.lower())


def is_valid_abn(raw: Any) -> bool:
    digits = re.sub(r"\s", "", raw or "")
    if not re.fullmatch(r"\d{11}", digits):
        return False
    w = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
    return sum((int(digits[i]) - (1 if i == 0 else 0)) * w[i] for i in range(11)) % 89 == 0


def locale_key(s: str):
    # String.prototype.localeCompare (ICU root collation), close enough for contact names: case-insensitive first,
    # lowercase before uppercase on a tie.
    return (s.lower(), s.swapcase())


def cmp(a, b) -> int:
    return (a > b) - (a < b)


# ---- neutral shapes (dicts with the TypeScript field names) ------------------------------------------------------
def lines_of(raw: dict) -> list:
    inclusive = raw.get("LineAmountTypes") == "Inclusive"
    out = []
    for li in raw.get("LineItems") or []:
        amount = num(li.get("LineAmount"))
        tax = num(li.get("TaxAmount"))
        out.append({"account": s_(li.get("AccountCode")), "taxType": s_(li.get("TaxType")),
                    "amount": round2(amount - tax if inclusive else amount), "tax": round2(tax)})
    return out


DOC_KIND = {"ACCPAY": "bill", "ACCREC": "invoice", "ACCPAYCREDIT": "bill_credit", "ACCRECCREDIT": "invoice_credit"}


def first_def(*vals):
    for v in vals:
        if v is not None:
            return v
    return None


def to_doc(raw: dict, credit: bool = False) -> dict:
    kind = DOC_KIND.get(s_(raw.get("Type")), "bill")
    id_ = s_(raw.get("CreditNoteID") if credit else raw.get("InvoiceID"))
    contact = raw.get("Contact") or {}
    area = "AccountsReceivable" if kind in ("invoice", "invoice_credit") else "AccountsPayable"
    return {
        "id": id_, "kind": kind,
        "number": s_(raw.get("CreditNoteNumber") if credit else raw.get("InvoiceNumber")),
        "contactId": s_(contact.get("ContactID")), "contact": s_(contact.get("Name")),
        "date": iso_day(first_def(raw.get("DateString"), raw.get("Date"))),
        "status": s_(raw.get("Status")).upper(),
        "total": round2(num(raw.get("Total"))), "tax": round2(num(raw.get("TotalTax"))),
        "attachments": raw.get("HasAttachments") is True, "reconciled": False, "lines": lines_of(raw),
        "link": (f"https://go.xero.com/{area}/ViewCreditNote.aspx?creditNoteID={id_}" if credit
                 else f"https://go.xero.com/{area}/View.aspx?InvoiceID={id_}"),
    }


def to_bank_doc(raw: dict) -> dict:
    contact = raw.get("Contact") or {}
    id_ = s_(raw.get("BankTransactionID"))
    t = s_(raw.get("Type"))
    kind = "spend" if t in ("SPEND", "SPEND-PREPAYMENT") else "receive" if t in ("RECEIVE", "RECEIVE-PREPAYMENT") else "other_bank"
    return {
        "id": id_, "kind": kind, "number": s_(raw.get("Reference")),
        "contactId": s_(contact.get("ContactID")), "contact": s_(contact.get("Name")),
        "date": iso_day(first_def(raw.get("DateString"), raw.get("Date"))),
        "status": s_(raw.get("Status")).upper(),
        "total": round2(num(raw.get("Total"))), "tax": round2(num(raw.get("TotalTax"))),
        "attachments": raw.get("HasAttachments") is True, "reconciled": raw.get("IsReconciled") is True,
        "lines": lines_of(raw), "link": f"https://go.xero.com/Bank/ViewTransaction.aspx?bankTransactionID={id_}",
    }


def to_payment_doc(raw: dict) -> dict:
    inv = raw.get("Invoice") or {}
    contact = inv.get("Contact") or {}
    t = s_(raw.get("PaymentType"))
    receivable = t.startswith("ACCREC") or t in ("ARCREDITPAYMENT", "AROVERPAYMENTPAYMENT", "ARPREPAYMENTPAYMENT")
    area = "AccountsReceivable" if receivable else "AccountsPayable"
    return {
        "id": "pay:" + s_(raw.get("PaymentID")), "kind": "receive" if receivable else "spend",
        "number": s_(first_def(inv.get("InvoiceNumber"), raw.get("Reference"))),
        "contactId": s_(contact.get("ContactID")), "contact": s_(contact.get("Name")),
        "date": iso_day(raw.get("Date")), "status": s_(raw.get("Status")).upper(),
        "total": round2(num(raw.get("Amount"))), "tax": 0, "attachments": False,
        "reconciled": raw.get("IsReconciled") is True, "lines": [],
        "link": f"https://go.xero.com/{area}/View.aspx?InvoiceID={s_(inv.get('InvoiceID'))}" if inv.get("InvoiceID") else "",
    }


def live(d: dict) -> bool:
    return d["status"] in ("AUTHORISED", "PAID")


def not_void(d: dict) -> bool:
    return d["status"] not in ("VOIDED", "DELETED")


def item(d: dict, detail: str = "", amount=None) -> dict:
    return {"date": d["date"], "contact": d["contact"], "reference": d["number"],
            "amount": round2(d["total"] if amount is None else amount), "detail": detail, "link": d["link"]}


def finding(group, checks, title, items, amount, count=None) -> dict:
    return {"group": group, "checks": checks, "title": title, "count": len(items) if count is None else count,
            "amount": None if amount is None else round2(amount), "items": items[:MAX_ITEMS],
            "more": max(0, len(items) - MAX_ITEMS)}


def total_of(xs, f) -> float:
    s = 0.0
    for x in xs:
        s += f(x)
    return s


# ---- rules ---------------------------------------------------------------------------------------------------------
def run_bas_checks(l: dict, today_iso: str) -> dict:
    findings, also_seen = [], []
    not_run = [{"group": g, "reason": "Needs the Australian Business Register (ABN status and GST registration), which Xero doesn't hold: "
                "look up abnsToCheck with ABR Lookup (abr_lookup_abns) to run it."} for g in NEEDS_ABR]
    ran = set()
    accounts = {}
    for a in l["accounts"]:
        if a["code"]:
            accounts[a["code"]] = a
    tax_rates = l["taxRates"]

    def rate(t):
        return tax_rates.get(t, 0)

    def label(code):
        return f"{code} {accounts[code]['name']}" if code in accounts else (code or "no account")

    docs = [d for d in l["docs"] if not_void(d)]
    bank = [d for d in l["bank"] if not_void(d)]
    bills = [d for d in docs if d["kind"] == "bill"]
    purchases = [d for d in bills if live(d)] + [b for b in bank if b["kind"] == "spend"]
    sales = [d for d in docs if d["kind"] == "invoice"]

    # CHK-031
    ran.add("gstChargedWhileUnregistered")
    if not l["gstRegistered"]:
        taxed = [d for d in docs if d["kind"] in ("invoice", "invoice_credit") and live(d) and d["tax"] > 0]
        if taxed:
            findings.append(finding("gstChargedWhileUnregistered", "CHK-031", "GST charged on sales or credit notes while not registered for GST",
                                    [item(d, f"GST ${fixed2(d['tax'])}", d["tax"]) for d in taxed], total_of(taxed, lambda d: d["tax"])))

    # CHK-058
    ran.add("gstOnNonClaimableItems")
    rows = []
    for p in purchases:
        for ln in p["lines"]:
            a = accounts.get(ln["account"])
            if a and ln["tax"] > 0 and (NON_CLAIMABLE.search(a["name"]) or a["type"] == "DEPRECIATN"):
                rows.append(item(p, f"GST ${fixed2(ln['tax'])} on {label(ln['account'])}", ln["tax"]))
    if rows:
        findings.append(finding("gstOnNonClaimableItems", "CHK-058", "GST claimed on accounts that normally carry none", rows, total_of(rows, lambda r: r["amount"])))

    # CHK-059
    ran.add("gstAmountMismatch")
    rows = []
    mixes = {}
    for p in purchases:
        bad = None
        for ln in p["lines"]:
            r = rate(ln["taxType"])
            if r > 0 and ln["amount"] != 0 and abs(ln["tax"] - (ln["amount"] * r) / 100) > max(0.05, abs((ln["amount"] * r) / 100) * 0.02):
                bad = ln
                break
        if bad:
            rows.append(item(p, f"GST ${fixed2(bad['tax'])} on a ${fixed2(bad['amount'])} line at {js_str(rate(bad['taxType']))}% ({label(bad['account'])})", p["tax"]))
        for ln in p["lines"]:
            if not ln["taxType"] or not ln["account"] or not p["contactId"] or ln["taxType"] not in tax_rates:
                continue
            key = f"{p['contactId']}|{ln['account']}"
            m = mixes.get(key) or {"doc": p, "types": []}
            m["types"].append(ln["taxType"])
            mixes[key] = m
    for key, m in mixes.items():
        with_gst = list(dict.fromkeys(t for t in m["types"] if rate(t) > 0))
        without = list(dict.fromkeys(t for t in m["types"] if rate(t) == 0))
        if len(m["types"]) >= 3 and with_gst and without:
            rows.append(item(m["doc"], f"{m['doc']['contact']} coded to {label(key.split('|')[1])} both with GST ({', '.join(with_gst)}) and without ({', '.join(without)})", 0))
    if rows:
        findings.append(finding("gstAmountMismatch", "CHK-059", "GST amounts or GST coding that don't add up", rows, None))

    # CHK-008
    abn_by = l["abnByContactId"]
    if l.get("contactsError") or (l["contactsAsked"] > 0 and len(abn_by) == 0):
        not_run.append({"group": "gstWithoutAbn", "reason": (
            f"The period's contacts couldn't be read from Xero ({l['contactsError']}), so their ABNs couldn't be checked."
            if l.get("contactsError") else "Xero returned none of the period's contacts, so their ABNs couldn't be read.")})
    else:
        ran.add("gstWithoutAbn")
        no_abn = [p for p in purchases if p["tax"] > 0 and p["total"] > GST_INVOICE_LIMIT and p["contactId"]
                  and not is_valid_abn((abn_by.get(p["contactId"]) or "")[:11])]
        rows = [item(p, f"GST ${fixed2(p['tax'])} claimed; no ABN on the contact and nothing attached", p["tax"]) for p in no_abn if not p["attachments"]]
        if rows:
            findings.append(finding("gstWithoutAbn", "CHK-008", f"GST claimed on purchases over ${js_str(GST_INVOICE_LIMIT)} from suppliers with no ABN and no document attached",
                                    rows, total_of(rows, lambda r: r["amount"])))
        attached = [item(p, f"GST ${fixed2(p['tax'])} claimed; no ABN on the contact, a document is attached", p["tax"]) for p in no_abn if p["attachments"]]
        if attached:
            also_seen.append({"checks": "CHK-008", "title": "GST claimed from suppliers with no ABN in Xero, with a document attached: check the attached tax invoice shows the ABN",
                              "count": len(attached), "amount": round2(total_of(attached, lambda r: r["amount"])), "items": attached[:MAX_ITEMS], "more": max(0, len(attached) - MAX_ITEMS)})

    # CHK-136
    if l["income12m"] is None and not l["gstRegistered"]:
        not_run.append({"group": "gstRegistrationRequired", "reason": "The 12 months' profit and loss couldn't be read from Xero."})
    else:
        ran.add("gstRegistrationRequired")
    if not l["gstRegistered"] and l["income12m"] is not None and l["income12m"] >= GST_TURNOVER:
        findings.append(finding("gstRegistrationRequired", "CHK-136", f"Income for the 12 months to {l['periodEnd']} is at or over $75,000 without GST registration", [], l["income12m"], 1))

    # CHK-022
    ran.add("unreconciledBank")
    loose = [b for b in bank + [p for p in l["unreconciledPayments"] if not_void(p)] if not b["reconciled"] and b["date"] <= today_iso]
    if loose:
        def sum_kind(k):
            return round2(total_of([b for b in loose if b["kind"] == k], lambda b: abs(b["total"])))
        other = sum_kind("other_bank")

        def what(b):
            if b["id"].startswith("pay:"):
                return "customer payment" if b["kind"] == "receive" else "supplier payment"
            return "receive money" if b["kind"] == "receive" else "spend money" if b["kind"] == "spend" else "transfer or other bank transaction"
        findings.append(finding("unreconciledBank", "CHK-022",
                                f"Bank transactions and payments in the period not reconciled (spend ${fixed2(sum_kind('spend'))}, receive ${fixed2(sum_kind('receive'))}"
                                + (f", transfers and other ${fixed2(other)}" if other else "") + ")",
                                [item(b, what(b)) for b in loose], total_of(loose, lambda b: abs(b["total"]))))

    # CHK-125
    if not l["balancesRead"]:
        not_run.append({"group": "suspenseBalance", "reason": "The trial balance couldn't be read from Xero, or its year-to-date columns couldn't be found."})
    else:
        ran.add("suspenseBalance")
        rows = []
        for a in l["accounts"]:
            if not SUSPENSE.search(a["name"]):
                continue
            bal = l["balances"].get(a["id"], 0)
            if abs(bal) >= 0.01:
                coded = [d for d in docs + bank if any(ln["account"] == a["code"] for ln in d["lines"])]

                def line_sum(d, f, code=a["code"]):
                    return round2(total_of([ln for ln in d["lines"] if ln["account"] == code], f))
                in_period = round2(total_of(coded, lambda d: abs(line_sum(d, lambda ln: ln["amount"] + ln["tax"]))))
                gst = round2(total_of(coded, lambda d: abs(line_sum(d, lambda ln: ln["tax"]))))
                listed = [f"{d['contact'] or d['number']} ${fixed2(abs(line_sum(d, lambda ln: ln['amount'] + ln['tax'])))} ({d['date']}, GST ${fixed2(abs(line_sum(d, lambda ln: ln['tax'])))})" for d in coded[:5]]
                detail = (f"{'debit' if bal > 0 else 'credit'} balance at {l['periodEnd']}; {len(coded)} document(s) dated in the period coded to it, ${fixed2(in_period)} with GST ${fixed2(gst)}"
                          + ((": " + ", ".join(listed) + (f" and {len(coded) - 5} more" if len(coded) > 5 else "")) if listed else "")
                          + ("; any difference from the balance comes from before the period or from journals" if coded else "; none of it comes from documents dated in the period"))
                rows.append({"date": l["periodEnd"], "contact": "", "reference": label(a["code"]), "amount": round2(abs(bal)), "detail": detail, "link": ""})
        if rows:
            findings.append(finding("suspenseBalance", "CHK-125", "Suspense or clearing account with a balance at the period end", rows, total_of(rows, lambda r: r["amount"])))

    # CHK-055/079/080
    ran.add("duplicateBills")
    rows = []
    by_contact = {}
    for b in [x for x in bills if x["total"] > 0]:
        k = b["contactId"] or b["contact"].lower()
        by_contact.setdefault(k, []).append(b)
    amount = 0.0
    flagged = set()
    for group in by_contact.values():
        group.sort(key=lambda d: (d["date"], d["id"]))
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                a, b = group[i], group[j]
                if b["id"] in flagged:
                    continue
                na, nb = norm_number(a["number"]), norm_number(b["number"])
                same_number = na != "" and na == nb
                gap = day_gap(a["date"], b["date"])
                close = gap is not None and gap <= DUPLICATE_WINDOW_DAYS and abs(a["total"] - b["total"]) < 0.01 and not (na and nb and na != nb)
                if not same_number and not close:
                    continue
                flagged.add(b["id"])
                both_paid = a["status"] == "PAID" and b["status"] == "PAID"
                check = "CHK-080" if both_paid else "CHK-079" if same_number else "CHK-055"
                why = "same invoice number" if same_number else f"same amount {js_str(gap)} day(s) apart"
                rows.append(item(b, f"{check}: {a['number'] or '(no number)'} {a['date']} {a['status'].lower()} ${fixed2(a['total'])} and "
                                    f"{b['number'] or '(no number)'} {b['date']} {b['status'].lower()} ${fixed2(b['total'])}: {why}"))
                amount += b["total"]
    if rows:
        findings.append(finding("duplicateBills", "CHK-055/079/080", "Possible duplicate bills (same supplier)", rows, amount))

    # CHK-129
    ran.add("gstAccountWithoutGst")
    usage = {}
    for d in purchases + [x for x in sales if live(x)]:
        for ln in d["lines"]:
            usage.setdefault(ln["account"], []).append(rate(ln["taxType"]))
    rows = []
    for code, used in usage.items():
        a = accounts.get(code)
        zero = len([r for r in used if not r])
        if a and rate(a["taxType"]) > 0 and len(used) >= 5 and zero >= 0.8 * len(used):
            rows.append({"date": "", "contact": "", "reference": label(code), "amount": 0, "detail": f"defaults to GST but {zero} of its {len(used)} lines in the period have none", "link": ""})
    if rows:
        findings.append(finding("gstAccountWithoutGst", "CHK-129", "GST accounts mostly used without GST (heuristic)", rows, None))

    # CHK-021/086
    ran.add("missingReceipts")
    unattached = [d for d in [b for b in bank if b["kind"] == "spend"] + [x for x in bills if live(x)] if not d["attachments"] and abs(d["total"]) > GST_INVOICE_LIMIT]
    bare = [d for d in unattached if d["tax"] > 0]
    no_gst = [d for d in unattached if d["tax"] <= 0]
    if no_gst:
        no_gst.sort(key=lambda d: -abs(d["total"]))
        its = [item(d, ("spend money" if d["kind"] == "spend" else "bill") + ", no GST claimed") for d in no_gst]
        also_seen.append({"checks": "CHK-021/086", "title": "Spend money and bills over $82.5 with nothing attached and no GST claimed: record-keeping only, no GST at stake",
                          "count": len(its), "amount": round2(total_of(no_gst, lambda d: abs(d["total"]))), "items": its[:MAX_ITEMS], "more": max(0, len(its) - MAX_ITEMS)})
    if bare:
        spend = len([d for d in bare if d["kind"] == "spend"])
        bare.sort(key=lambda d: -abs(d["total"]))
        findings.append(finding("missingReceipts", "CHK-021/086", f"Spend money ({spend}) and bills ({len(bare) - spend}) over $82.5 with nothing attached",
                                [item(d, "spend money" if d["kind"] == "spend" else "bill") for d in bare], total_of(bare, lambda d: abs(d["total"]))))

    # CHK-033
    ran.add("draftSalesInvoices")
    waiting = [d for d in sales if d["status"] in ("DRAFT", "SUBMITTED")]
    if waiting:
        findings.append(finding("draftSalesInvoices", "CHK-033", "Sales invoices still in draft or awaiting approval",
                                [item(d, d["status"].lower()) for d in waiting], total_of(waiting, lambda d: d["total"])))

    # CHK-134
    ran.add("lockDate")
    limit = js_add_months(l["periodEnd"], -LOCK_MONTHS)
    if not l["lockDate"]:
        findings.append(finding("lockDate", "CHK-134", "No lock date is set, so past periods can still be changed", [], None, 1))
    elif l["lockDate"] < limit:
        findings.append(finding("lockDate", "CHK-134", f"The lock date is {l['lockDate']}, more than {LOCK_MONTHS} months before the period end", [], None, 1))

    # TAX-CODE
    ran.add("taxCodeMismatch")
    approved = purchases + [x for x in sales if live(x)] + [b for b in bank if b["kind"] == "receive"]
    taxed_by = {}
    for d in approved:
        for ln in d["lines"]:
            if d["contactId"] and ln["account"] and rate(ln["taxType"]) > 0:
                k = f"{d['contactId']}|{ln['account']}"
                taxed_by[k] = taxed_by.get(k, 0) + 1
    rows = []
    for d in approved:
        hit = None
        for x in d["lines"]:
            if not x["account"] or x["amount"] == 0 or x["taxType"] not in tax_rates or rate(x["taxType"]) > 0:
                continue
            if x["taxType"].upper() in DELIBERATE_NO_GST:
                continue
            a = accounts.get(x["account"])
            if not a or NON_CLAIMABLE.search(a["name"]) or a["type"] == "DEPRECIATN" or SUSPENSE.search(a["name"]):
                continue
            if rate(a["taxType"]) > 0 or taxed_by.get(f"{d['contactId']}|{x['account']}", 0) >= 2:
                hit = x
                break
        if not hit:
            continue
        a = accounts[hit["account"]]
        why = (f"{label(hit['account'])} normally carries {a['taxType']}" if rate(a["taxType"]) > 0
               else f"{js_str(taxed_by.get(d['contactId'] + '|' + hit['account']))} other line(s) from {d['contact']} to {label(hit['account'])} carry GST")
        rows.append(item(d, f"coded {hit['taxType']} (no GST) on a ${fixed2(abs(hit['amount']))} line; {why}"))
    if rows:
        findings.append(finding("taxCodeMismatch", "TAX-CODE", "Lines coded with no GST where the account or supplier normally carries GST (heuristic)", rows,
                                total_of(rows, lambda r: abs(r["amount"]))))

    # PRIOR-PERIOD
    if l["priorChanged"] is None:
        not_run.append({"group": "priorPeriodAdjustments", "reason": "Documents and journals dated before the period couldn't be read from Xero."})
    else:
        ran.add("priorPeriodAdjustments")
        unapproved = [p for p in l["priorChanged"] if p["doc"]["status"] in ("DRAFT", "SUBMITTED")]
        unapproved_ids = set(id(p) for p in unapproved)
        changed = [p for p in l["priorChanged"] if id(p) not in unapproved_ids]
        by_day = {}
        for p in changed:
            by_day.setdefault(p["updated"], []).append(p)
        rows = []
        for day, lst in sorted(by_day.items(), key=lambda kv: kv[0], reverse=True):
            if len(lst) < BULK_CHANGE_DAY:
                continue
            tot = round2(total_of(lst, lambda p: abs(p["doc"]["total"])))
            dates = sorted(p["doc"]["date"] for p in lst)
            rows.append({"date": day, "contact": "", "reference": f"{len(lst)} documents", "amount": tot,
                         "detail": f"{len(lst)} documents dated {dates[0]} to {dates[-1]} all changed on {day}: likely an import or a batch edit. Check whether it changed figures in an earlier BAS",
                         "link": ""})
        scattered = [p for p in changed if len(by_day.get(p["updated"], [])) < BULK_CHANGE_DAY]
        for p in scattered:
            kind_txt = "manual journal" if p["kind"] == "journal" else p["doc"]["kind"].replace("_", " ", 1)
            rows.append(item(p["doc"], f"{kind_txt} dated {p['doc']['date']}, {p['doc']['status'].lower()}, changed {p['updated']}" + (f"; {p['note']}" if p["note"] else "")))
        if rows:
            findings.append(finding("priorPeriodAdjustments", "PRIOR-PERIOD",
                                    f"Documents dated before the period that changed on or after {l['changedSince']}: possible prior-period adjustments ({len(scattered)} changed individually"
                                    + (f", {len(changed) - len(scattered)} in bulk changes" if len(rows) > len(scattered) else "") + ")",
                                    rows, total_of(changed, lambda p: abs(p["doc"]["total"])), len(changed)))
        if unapproved:
            its = [item(p["doc"], f"{p['doc']['kind'].replace('_', ' ', 1)} dated {p['doc']['date']}, {p['doc']['status'].lower()}, changed {p['updated']}") for p in unapproved]
            also_seen.append({"checks": "PRIOR-PERIOD", "title": f"Drafts dated before the period that changed on or after {l['changedSince']}: never in an earlier BAS; if approved they'd need to be reported",
                              "count": len(its), "amount": round2(total_of(unapproved, lambda p: abs(p["doc"]["total"]))), "items": its[:MAX_ITEMS], "more": max(0, len(its) - MAX_ITEMS)})

    held = [d for d in bills if d["status"] in ("DRAFT", "SUBMITTED")]
    if held:
        rws = [item(d, d["status"].lower()) for d in held]
        also_seen.append({"checks": "CHK-078", "title": "Bills in draft or awaiting approval: not in the BAS figures until approved", "count": len(rws),
                          "amount": round2(total_of(held, lambda d: d["total"])), "items": rws[:MAX_ITEMS], "more": max(0, len(rws) - MAX_ITEMS)})

    found = set(f["group"] for f in findings)
    clear = [g for g in GROUPS if g in ran and g not in found]
    return {"findings": findings, "clear": clear, "notRun": not_run, "alsoSeen": also_seen}


def abns_to_check(l: dict) -> dict:
    by_abn = {}

    def add(d, side):
        abn = (l["abnByContactId"].get(d["contactId"]) or "")[:11]
        if not d["contactId"] or not is_valid_abn(abn):
            return
        row = by_abn.get(abn) or {"abn": abn, "contact": d["contact"], "gstClaimed": 0, "purchases": 0, "sales": 0}
        row[side] += 1
        if side == "purchases":
            row["gstClaimed"] = round2(row["gstClaimed"] + max(0, d["tax"]))
        by_abn[abn] = row
    docs = [d for d in l["docs"] if not_void(d)]
    bank = [d for d in l["bank"] if not_void(d)]
    for d in [x for x in docs if x["kind"] == "bill" and live(x)] + [b for b in bank if b["kind"] == "spend"]:
        add(d, "purchases")
    for d in [x for x in docs if x["kind"] == "invoice" and live(x)] + [b for b in bank if b["kind"] == "receive"]:
        add(d, "sales")
    import functools

    def order(a, b):
        return (cmp(b["gstClaimed"], a["gstClaimed"]) or cmp(b["purchases"] + b["sales"], a["purchases"] + a["sales"])
                or cmp(locale_key(a["contact"]), locale_key(b["contact"])))
    allrows = sorted(by_abn.values(), key=functools.cmp_to_key(order))
    return {"abns": allrows[:MAX_ABNS_TO_CHECK], "more": max(0, len(allrows) - MAX_ABNS_TO_CHECK)}


# ---- reports -------------------------------------------------------------------------------------------------------
def report_rows(report) -> list:
    reps = (report or {}).get("Reports") if isinstance(report, dict) else None
    r = reps[0] if isinstance(reps, list) and reps else None
    out = []
    for section in (r or {}).get("Rows") or []:
        for row in section.get("Rows") or []:
            if row.get("RowType") == "Row":
                out.append({"title": s_(section.get("Title")), "cells": row.get("Cells") or []})
    return out


def cell_account(c) -> str:
    for a in (c or {}).get("Attributes") or []:
        if a.get("Id") == "account":
            return s_(a.get("Value"))
    return ""


def trial_balances(report) -> dict:
    reps = (report or {}).get("Reports") if isinstance(report, dict) else None
    top = ((reps[0] if isinstance(reps, list) and reps else {}) or {}).get("Rows") or []
    header_row = next((r for r in top if r.get("RowType") == "Header"), None)
    header = [s_(c.get("Value")) for c in (header_row or {}).get("Cells") or []] if header_row else []
    debit = next((i for i, h in enumerate(header) if re.search(r"ytd\s*debit", h, re.I)), -1)
    credit = next((i for i, h in enumerate(header) if re.search(r"ytd\s*credit", h, re.I)), -1)
    if debit < 0 or credit < 0:
        if header:
            return {"balances": {}, "read": False}
        debit, credit = 3, 4
    balances, rows = {}, 0
    for r in report_rows(report):
        cells = r["cells"]
        aid = cell_account(cells[0] if cells else None)
        if aid and len(cells) > max(debit, credit):
            balances[aid] = round2(num((cells[debit] or {}).get("Value")) - num((cells[credit] or {}).get("Value")))
            rows += 1
    return {"balances": balances, "read": rows > 0}


def trading_income(report) -> float:
    return round2(total_of([r for r in report_rows(report) if len(r["cells"]) > 1 and re.search("income", r["title"], re.I) and not re.search("other", r["title"], re.I)],
                           lambda r: num((r["cells"][1] or {}).get("Value"))))


def prior_document_changes(rows, credit, since) -> list:
    out = []
    for r in rows:
        doc = to_doc(r, credit)
        updated = iso_day(r.get("UpdatedDateUTC"))
        if not updated or updated < since:
            continue
        dates = [iso_day(r.get("FullyPaidOnDate"))] + [iso_day(p.get("Date")) for p in r.get("Payments") or []] + [iso_day(a.get("Date")) for a in r.get("Allocations") or []]
        settled = any(d and d >= since for d in dates)
        if settled and doc["status"] != "VOIDED":
            continue
        out.append({"kind": "document", "doc": doc, "updated": updated, "note": "voided after the earlier BAS" if doc["status"] == "VOIDED" else ""})
    return out


def prior_journal_changes(rows, since) -> list:
    out = []
    for j in rows:
        updated = iso_day(j.get("UpdatedDateUTC"))
        if not updated or updated < since:
            continue
        id_ = s_(j.get("ManualJournalID"))
        lines = j.get("JournalLines") or []
        gst_lines = [ln for ln in lines if num(ln.get("TaxAmount")) != 0]
        out.append({"kind": "journal", "updated": updated, "note": f"{len(gst_lines)} line(s) carry GST" if gst_lines else "",
                    "doc": {"id": id_, "kind": "other_bank", "number": s_(j.get("Narration"))[:80], "contactId": "", "contact": "",
                            "date": iso_day(first_def(j.get("DateString"), j.get("Date"))), "status": s_(j.get("Status")).upper(),
                            "total": round2(total_of(lines, lambda ln: max(0, num(ln.get("LineAmount"))))),
                            "tax": round2(total_of(lines, lambda ln: num(ln.get("TaxAmount")))),
                            "attachments": False, "reconciled": False, "lines": [], "link": f"https://go.xero.com/Journal/View.aspx?invoiceID={id_}"}})
    return out


# ---- Xero reads through the Xero API connector -----------------------------------------------------------------------
def date_time(iso: str) -> str:
    y, m, d = (int(p) for p in iso.split("-"))
    return f"DateTime({y},{m},{d})"


def run_checks(invoke, tenant_id: str, period_start: str, period_end: str, gst_registered=None, changed_since=None, today_iso=None) -> dict:
    """invoke(tool, args) calls one xero-api operation (the automation passes api.connectors.invoke)."""
    if not is_real_day(period_start) or not is_real_day(period_end):
        raise ValueError("periodStart and periodEnd must be real dates, YYYY-MM-DD")
    if period_end < period_start:
        raise ValueError("periodEnd is before periodStart")
    if (parse_ms(period_end) - parse_ms(period_start)) / 86400000 >= MAX_PERIOD_DAYS:
        raise ValueError(f"The period is longer than {MAX_PERIOD_DAYS} days: run one BAS period at a time")
    if today_iso is None:
        today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    in_period = f"Date>={date_time(period_start)}&&Date<={date_time(period_end)}"
    not_deleted = f'{in_period}&&Status!="DELETED"'
    year_ago = js_add_years_plus_day(period_end, -1)
    changed_since = changed_since or period_start
    if not is_real_day(changed_since):
        raise ValueError("changedSince must be a real date, YYYY-MM-DD")
    prior_where = f'Date<{date_time(period_start)}&&UpdatedDateUTC>={date_time(changed_since)}&&Status!="DELETED"'

    def call(tool, args=None):
        a = {"xero_tenant_id": tenant_id}
        a.update(args or {})
        res = invoke(tool, a)
        return res if isinstance(res, dict) else {}

    def pages(tool, key, params):
        # xero-api has no pageSize input, so pages are Xero's default 100 rows (the server asked for 500).
        rows = []
        for page in range(1, MAX_PAGES + 1):
            p = dict(params)
            p["page"] = page
            res = call(tool, p)
            batch = res.get(key) or []
            rows.extend(batch)
            pc = (res.get("pagination") or {}).get("pageCount")
            last = page >= pc if isinstance(pc, (int, float)) and not isinstance(pc, bool) else len(batch) < 100
            if last or len(batch) == 0:
                return {"rows": rows, "truncated": False}
        return {"rows": rows, "truncated": True}

    unread = []
    no_rows = {"rows": [], "truncated": False}

    def optional(what, read, fallback):
        try:
            return read()
        except Exception as err:  # noqa: BLE001 - every read failure is reported, as the server did
            unread.append(f"{what}: {str(err)[:200]}")
            return fallback

    org_res = call("get_organisation")
    accounts_res = call("list_accounts")
    rates_res = call("list_tax_rates")
    invoices = pages("list_invoices", "Invoices", {"where": not_deleted})
    credits = pages("list_credit_notes", "CreditNotes", {"where": not_deleted})
    bank_res = pages("list_bank_transactions", "BankTransactions", {"where": not_deleted})
    payments = optional("unreconciled payments", lambda: pages("list_payments", "Payments", {"where": f"{in_period}&&IsReconciled==false"}), no_rows)
    tb = optional("trial balance", lambda: call("get_trial_balance", {"date": period_end}), None)
    pl = optional("profit and loss", lambda: call("get_profit_and_loss", {"fromDate": year_ago, "toDate": period_end}), None)

    org = (org_res.get("Organisations") or [{}])[0] or {}
    basis = s_(org.get("SalesTaxBasis"))
    gst_reg = gst_registered if gst_registered is not None else (basis != "" and basis.upper() != "NONE")
    docs = [to_doc(r) for r in invoices["rows"]] + [to_doc(r, True) for r in credits["rows"]]
    bank = [to_bank_doc(r) for r in bank_res["rows"]]

    contact_ids = list(dict.fromkeys(d["contactId"] for d in docs + bank if d["contactId"]))
    wanted = set(contact_ids)
    abn_by = {}
    contacts_error = ""
    if wanted:
        try:
            allc = pages("list_contacts", "Contacts", {"includeArchived": True})
            for c in allc["rows"]:
                cid = s_(c.get("ContactID"))
                if cid in wanted:
                    abn_by[cid] = re.sub(r"\D", "", s_(c.get("TaxNumber")))
            if allc["truncated"]:
                unread.append(f"contacts: more than {MAX_PAGES} pages, so some suppliers' ABNs may be missing")
        except Exception as err:  # noqa: BLE001
            contacts_error = str(err)[:200]
            unread.append(f"contacts: {contacts_error}")
    trial = {"balances": {}, "read": False} if tb is None else trial_balances(tb)

    prior_changed = None
    try:
        old_inv = pages("list_invoices", "Invoices", {"where": prior_where})
        old_cr = pages("list_credit_notes", "CreditNotes", {"where": prior_where})
        old_mj = pages("list_manual_journals", "ManualJournals", {"where": prior_where})
        prior_changed = (prior_document_changes(old_inv["rows"], False, changed_since) + prior_document_changes(old_cr["rows"], True, changed_since)
                         + prior_journal_changes(old_mj["rows"], changed_since))
        prior_changed.sort(key=lambda p: p["updated"], reverse=True)
        if old_inv["truncated"] or old_cr["truncated"] or old_mj["truncated"]:
            unread.append("earlier documents: more than 20 pages changed, so the prior-period list may be incomplete")
    except Exception as err:  # noqa: BLE001
        unread.append(f"earlier documents: {str(err)[:200]}")

    lock_dates = sorted([iso_day(org.get("PeriodLockDate")), iso_day(org.get("EndOfYearLockDate"))])
    ledger = {
        "periodStart": period_start, "periodEnd": period_end, "gstRegistered": gst_reg,
        "lockDate": lock_dates[-1] if lock_dates else "", "docs": docs, "bank": bank,
        "accounts": [{"id": s_(a.get("AccountID")), "code": s_(a.get("Code")), "name": s_(a.get("Name")), "type": s_(a.get("Type")), "taxType": s_(a.get("TaxType"))}
                     for a in accounts_res.get("Accounts") or []],
        "taxRates": {s_(t.get("TaxType")): num(t.get("EffectiveRate")) for t in rates_res.get("TaxRates") or []},
        "abnByContactId": abn_by, "contactsAsked": len(contact_ids), "contactsError": contacts_error,
        "balances": trial["balances"], "balancesRead": trial["read"],
        "income12m": None if pl is None else trading_income(pl),
        "unreconciledPayments": [to_payment_doc(r) for r in payments["rows"]],
        "priorChanged": prior_changed, "changedSince": changed_since,
    }
    result = run_bas_checks(ledger, today_iso)
    truncated = [w for w, t in (("invoices and bills", invoices["truncated"]), ("credit notes", credits["truncated"]),
                                ("bank transactions", bank_res["truncated"]), ("payments", payments["truncated"])) if t]
    limitations = [
        "Bank statement lines with no match at all can't be read through Xero's API, so CHK-022 covers coded transactions and payments only.",
        "Only documents dated in the period are compared, so a duplicate whose twin is in another period isn't found.",
        "Prior-period adjustments cover invoices, bills, credit notes and manual journals dated before the period; bank transactions aren't included, and a change Xero records without updating the document isn't seen.",
    ]
    if basis.upper() in ("CASH", "PAYMENTS"):
        limitations.append("The business reports GST on a cash basis: the BAS follows payment dates, but these checks pick documents by their own date.")
    if len(payments["rows"]) == 0 and any(u.startswith("unreconciled payments") for u in unread):
        limitations.append("Unreconciled invoice and bill payments couldn't be read, so CHK-022 covers bank transactions only.")
    out = {
        "organisation": {"name": s_(org.get("Name")), "gstRegistered": gst_reg,
                         "gstRegisteredFrom": f"inferred from the GST basis ({basis or 'none set'})" if gst_registered is None else "given",
                         "gstBasis": basis, "gstPeriod": s_(org.get("SalesTaxPeriod")), "lockDate": ledger["lockDate"] or None},
        "period": {"start": period_start, "end": period_end, "changedSince": changed_since},
        "read": {"salesInvoices": len([d for d in docs if d["kind"] == "invoice"]), "bills": len([d for d in docs if d["kind"] == "bill"]),
                 "creditNotes": len(credits["rows"]), "bankTransactions": len(bank), "unreconciledPayments": len(payments["rows"]),
                 "contacts": len(abn_by), "truncated": truncated, "unread": unread},
    }
    out.update(result)
    out["abnsToCheck"] = abns_to_check(ledger)
    out["limitations"] = limitations
    out["note"] = (f"Counts and amounts cover every row; items lists at most {MAX_ITEMS} per finding (more = how many weren't listed). "
                   "Read-only: nothing in Xero was changed." + (f" Not every row was read ({', '.join(truncated)}): results may be incomplete." if truncated else ""))
    return out
