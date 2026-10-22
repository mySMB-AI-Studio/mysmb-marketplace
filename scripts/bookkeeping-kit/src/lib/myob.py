# ── bookkeeping kit: MYOB ledger adapter (inlined into the Bookkeeping checks for MYOB nodes by gen-ext.js) ──
# Reads only. Every call passes myob_company_file_id, so it reads the client's own company file whichever file the
# connection defaults to (the connector's per-call override, as the reports' client picker uses). Ported from the
# Client Report Analytics MYOB live checks (scripts/client-report-analytics-kit/myob/live-checks.inc.js): documents
# come from the line lists, open headers add balances and delivery status, GST per line is its tax code's share,
# ABNs come from the supplier cards and reconciliation from the bank lines of the journal transactions.

MYOB = "myob-accounting"
MYOB_PAGE = 1000
MYOB_MAX_PAGES = 20
MYOB_MAX_LINES = 5000
MYOB_STATUS = {"Open": "authorised", "Closed": "paid", "Credit": "authorised"}
MYOB_PL = ("Income", "CostOfSales", "Expense", "OtherIncome", "OtherExpense")
# Checks the myob-accounting connector can't answer: not run, and listed on the Checks item (never shown as clear).
MYOB_NA = {
    "CHK-002": "it reads the ABN on bill PDFs, which only Bookkeeping for Xero's bill intake reads",
    "CHK-016": "MYOB's API has no batch payment text",
    "CHK-017": "the MYOB connector doesn't return supplier bank details",
    "CHK-018": "the MYOB connector doesn't return supplier bank details",
    "CHK-057": "the MYOB connector doesn't return supplier bank details",
    "CHK-021": "MYOB's API doesn't say whether a spend money transaction has an attachment",
    "CHK-086": "MYOB's API doesn't say whether a bill has an attachment",
    "CHK-033": "MYOB has no draft or awaiting-approval sales invoices (unfinished sales are quotes or orders)",
    "CHK-078": "MYOB has no draft or awaiting-approval bills (unfinished purchases are quotes or orders)",
    "CHK-040": "the MYOB connector doesn't list quotes",
    "CHK-093": "the MYOB connector doesn't list purchase orders",
    "CHK-134": "MYOB's API doesn't return the company file's lock period",
    "CHK-135": "MYOB's API doesn't return the company file's lock period",
    "CHK-139": "the fixed asset checks read Xero Assets",
    "CHK-140": "the fixed asset checks read Xero Assets",
}


def myob_call(tool, file_id=None, **args):
    if file_id:
        args["myob_company_file_id"] = file_id
    # Bound first on purpose: the platform's Publish lint only counts plain assignments as a function's own names.
    exc = None
    try:
        result = api.connectors.invoke(server=MYOB, tool=tool, args=args)
    except Exception as exc:
        raise RuntimeError("MYOB: " + str(exc)[:600]) from None
    # The connector returns a failed MYOB call as data, {"__error": "<message>"}, not as an error.
    if isinstance(result, dict) and result.get("__error") is not None:
        raise RuntimeError("MYOB says: " + str(result["__error"])[:600])
    return result


def myob_items(result):
    """A list tool's rows: MYOB's {Items, Count} or a bare list."""
    if isinstance(result, list):
        return result
    if isinstance(result, dict) and isinstance(result.get("Items"), list):
        return result["Items"]
    return []


def myob_date(value):
    """A MYOB date (ISO 'YYYY-MM-DDThh:mm:ss' or '/Date(ms)/') as YYYY-MM-DD, or ''."""
    s = str(value or "")
    m = re.match(r"/Date\((-?\d+)", s)
    if m:
        return str(datetime.datetime.fromtimestamp(int(m.group(1)) / 1000, datetime.timezone.utc).date())
    m = re.match(r"(\d{4}-\d{2}-\d{2})", s)
    return m.group(1) if m else ""


def myob_ref(value, key="UID"):
    """A reference's field ('' for MYOB's "*None" placeholder)."""
    v = str((value or {}).get(key) or "") if isinstance(value, dict) else ""
    return "" if v == "*None" else v


def myob_company_files():
    """The company files the connection can open, as [{id, name}]."""
    out = []
    for f in myob_items(myob_call("list_company_files")):
        if isinstance(f, dict):
            fid = str(f.get("Id") or f.get("id") or f.get("UID") or "")
            name = str(f.get("Name") or f.get("name") or f.get("CompanyName") or "")
            if fid:
                out.append({"id": fid, "name": name})
    return out


def bk_find_file(name):
    """The client's company file by the name on its settings form: (the match or None, every name available)."""
    files = myob_company_files()
    match = next((f for f in files if bk_norm(f["name"]) == bk_norm(name)), None)
    if not match and bk_norm(name):
        match = next((f for f in files if bk_norm(name) in bk_norm(f["name"])), None)
    return match, sorted(f["name"] for f in files)


def myob_pages(tool, file_id, **args):
    """Every page of a list tool that pages by page_index (list_contacts, list_supplier_payments). Returns (rows, cut)."""
    rows = []
    for page in range(MYOB_MAX_PAGES):
        batch = myob_items(myob_call(tool, file_id, page_size=MYOB_PAGE, page_index=page, **args))
        rows.extend(batch)
        if len(batch) < MYOB_PAGE:
            return rows, False
    return rows, True


def myob_breakdown(result):
    """A report's AccountsBreakdown as {account UID: total}."""
    out = {}
    rows = result.get("AccountsBreakdown") if isinstance(result, dict) else None
    for row in rows or []:
        uid = myob_ref(row.get("Account")) if isinstance(row, dict) else ""
        if uid:
            out[uid] = round(out.get(uid, 0.0) + (bk_money(row.get("AccountTotal")) or 0.0), 2)
    return out


def myob_line(line, inclusive, field, rates):
    """A line as {account (its code), tax_type, amount (ex GST), tax}: GST is the tax code's share of the line."""
    code = myob_ref(line.get("TaxCode"), "Code")
    rate = rates.get(code) or 0.0
    total = bk_money(line.get(field)) or 0.0
    tax = total * rate / (100 + rate) if inclusive else total * rate / 100
    account = line.get("Account") or {}
    return {"account": myob_ref(account, "DisplayID") or myob_ref(account), "tax_type": code,
            "amount": round(total - (tax if inclusive else 0.0), 2), "tax": round(tax, 2)}


def myob_header_tax(lines, total):
    """Where the document's own TotalTax isn't the lines' share (rounding, a changed rate), spread it over the taxed
    lines pro rata, so the GST checks see what MYOB recorded."""
    share = sum(x["tax"] for x in lines)
    if total is None or share <= 0 or abs(total - share) <= max(0.05, share * 0.02):
        return
    for x in lines:
        x["tax"] = round(x["tax"] * total / share, 2)


def myob_head(x, kind):
    """An open invoice or bill header (list_invoices / list_bills): what the line lists don't carry."""
    status = str(x.get("Status") or "")
    delivery = str(x.get("InvoiceDeliveryStatus") or "")
    # "To be printed" or "to be emailed" means it hasn't gone yet; Nothing means nothing is waiting.
    sent = True if delivery == "Nothing" else False if delivery in ("Print", "Email", "PrintAndEmail") else None
    who = x.get("Customer") or x.get("Supplier") or {}
    return {"id": str(x.get("UID") or ""), "kind": kind + "_credit" if status == "Credit" else kind,
            "number": str(x.get("Number") or ""), "contact_id": myob_ref(who), "contact": myob_ref(who, "Name"),
            "date": myob_date(x.get("Date")), "due": myob_date((x.get("Terms") or {}).get("DueDate")),
            "status": MYOB_STATUS.get(status, "authorised"), "total": round(bk_money(x.get("TotalAmount")) or 0.0, 2),
            "tax": round(bk_money(x.get("TotalTax")) or 0.0, 2), "due_amount": round(bk_money(x.get("BalanceDueAmount")) or 0.0, 2),
            "paid_on": "", "attachments": None, "sent": sent if kind == "invoice" else None, "lines": [], "link": ""}


def myob_ledger(file_id, today, since, weekly):
    """The neutral ledger snapshot the checks read (shape in checks.py) from a MYOB company file. Weekly adds the chart
    of accounts, journals (bank reconciliation and general journals), two balance sheets and a 12-month profit and loss."""
    truncated = []
    na = dict(MYOB_NA)
    rates = {str(t.get("Code") or ""): bk_money(t.get("Rate")) or 0.0
             for t in myob_items(myob_call("list_tax_codes", file_id)) if t.get("Code")}
    # Cards: customers and suppliers. MYOB needs a card per role, so a customer card named like a supplier card is the
    # same business and stays out of the duplicate-contact check. ABNs are on the supplier cards only.
    cards, cut = myob_pages("list_contacts", file_id, type="All")
    if cut:
        truncated.append("contact cards (first " + "{:,}".format(MYOB_PAGE * MYOB_MAX_PAGES) + ")")
    # Bank details (CHK-017, CHK-018, CHK-057): the connector's keyed fingerprint of each supplier's account, never the
    # details. A connector without it returns no BankFingerprint, and those checks stay not checked.
    supplier_rows = myob_items(myob_call("list_suppliers", file_id, bank_fingerprint_key=ck_secret()))
    abn = {myob_ref(s): re.sub(r"\D", "", str(s.get("ABN") or "")) for s in supplier_rows}
    fingerprints = {myob_ref(s): str(s.get("BankFingerprint") or "") for s in supplier_rows if "BankFingerprint" in s}
    if fingerprints:
        for check in ("CHK-017", "CHK-018", "CHK-057"):
            na.pop(check, None)
    people = []
    for x in cards:
        if x.get("Type") not in ("Customer", "Supplier") or x.get("IsActive") is False or not x.get("UID"):
            continue
        name = str(x.get("CompanyName") or " ".join(str(p) for p in (x.get("FirstName"), x.get("LastName")) if p))
        people.append({"id": str(x["UID"]), "type": x["Type"], "name": name, "tax_number": abn.get(str(x["UID"]), ""),
                       "bank": "", "bank_h": fingerprints.get(str(x["UID"]), ""), "has_address": any(str(a.get("Street") or a.get("City") or "").strip()
                                                      for a in x.get("Addresses") or [] if isinstance(a, dict)), "link": ""})
    suppliers = {bk_norm(p["name"]) for p in people if p["type"] == "Supplier"}
    contacts = [dict((k, v) for k, v in p.items() if k != "type") for p in people
                if p["type"] == "Supplier" or bk_norm(p["name"]) not in suppliers]

    # Documents dated in the window, from their lines; open headers (any date) add the balance, due date and sending.
    # Open bills every run (what a payment would be matched to); open sales invoices weekly, as only weekly checks read them.
    heads = {}
    for kind, tool in (("bill", "list_bills"), ("invoice", "list_invoices"))[:2 if weekly else 1]:
        for x in myob_items(myob_call(tool, file_id, status="Open")):
            if x.get("UID"):
                heads[str(x["UID"])] = myob_head(x, kind)
    if weekly and not any(h["sent"] is not None for h in heads.values() if h["kind"] == "invoice"):
        na["CHK-024"] = "MYOB didn't return the open invoices' delivery status, so an unsent invoice can't be told apart"
    by_doc, order = {}, []
    for kind, tool, who in (("bill", "list_bill_lines", "Supplier"), ("invoice", "list_invoice_lines", "Customer")):
        result = myob_call(tool, file_id, from_date=str(since), to_date=str(today), status="All", max_lines=MYOB_MAX_LINES)
        if isinstance(result, dict) and result.get("Truncated"):
            truncated.append(kind + " lines (first " + "{:,}".format(MYOB_MAX_LINES) + ")")
        if isinstance(result, dict) and result.get("Errors"):
            truncated.append(kind + " layouts " + ", ".join(sorted(result["Errors"])))
        for ln in myob_items(result):
            doc_id = str(ln.get("DocumentUID") or "")
            if not doc_id:
                continue
            d = by_doc.get(doc_id)
            if d is None:
                c = ln.get(who) or {}
                status = str(ln.get("Status") or "")
                d = {"id": doc_id, "kind": kind + "_credit" if status == "Credit" else kind, "number": str(ln.get("Number") or ""),
                     "contact_id": myob_ref(c), "contact": myob_ref(c, "Name"), "date": myob_date(ln.get("Date")), "due": "",
                     "status": MYOB_STATUS.get(status, "authorised"), "total": 0.0, "tax": 0.0, "due_amount": 0.0, "paid_on": "",
                     "attachments": None, "sent": None, "lines": [], "link": "", "_inc": bool(ln.get("IsTaxInclusive"))}
                by_doc[doc_id] = d
                order.append(doc_id)
            d["lines"].append(myob_line(ln, d["_inc"], "Total", rates))
    # When a bill was paid: the latest supplier payment applied to it (MYOB's bill has no paid date of its own).
    paid = {}
    payments, _cut = myob_pages("list_supplier_payments", file_id, from_date=str(since), to_date=str(today))
    for p in payments:
        when = myob_date(p.get("Date"))
        for ln in p.get("Lines") or []:
            uid = myob_ref(ln.get("Purchase")) if isinstance(ln, dict) else ""
            if uid and when > paid.get(uid, ""):
                paid[uid] = when
    # When a sales invoice was paid (weekly, for the overdue behaviour checks): the latest customer payment applied to it.
    # A customer payment lists its invoices under "Invoices" (each with the invoice's UID); "Lines" with a Sale is accepted
    # too. Not yet seen on a real file: confirm on QA.
    if weekly:
        receipts, _cut = myob_pages("list_payments", file_id, from_date=str(since), to_date=str(today))
        for p in receipts:
            when = myob_date(p.get("Date"))
            for ln in p.get("Invoices") or p.get("Lines") or []:
                uid = (myob_ref(ln.get("Sale")) or myob_ref(ln.get("Invoice")) or str(ln.get("UID") or "")) if isinstance(ln, dict) else ""
                if uid and when > paid.get(uid, ""):
                    paid[uid] = when
    docs = []
    for doc_id in order:
        d = by_doc[doc_id]
        d.pop("_inc", None)
        h = heads.get(doc_id)
        if h:
            myob_header_tax(d["lines"], h["tax"])
            d.update(total=h["total"], due=h["due"], due_amount=h["due_amount"], sent=h["sent"])
        d["tax"] = round(sum(x["tax"] for x in d["lines"]), 2)
        if not h:
            d["total"] = round(sum(x["amount"] + x["tax"] for x in d["lines"]), 2)
        if d["kind"] in ("bill", "invoice") and d["status"] == "paid":
            d["paid_on"] = paid.get(doc_id, "")
        docs.append(d)
    for doc_id, h in heads.items():
        if doc_id in by_doc:
            continue
        # Open documents dated before the window: bills still to pay (what a payment would be matched to) and, weekly,
        # sales still owed (for the register checks only, as for Xero).
        if h["kind"] == "bill" or (weekly and h["kind"] == "invoice"):
            h["older_open"] = h["kind"] == "invoice"
            docs.append(h)

    bank = []
    for t in myob_items(myob_call("list_spend_money", file_id, from_date=str(since), to_date=str(today))):
        if not t.get("UID"):
            continue
        c = t.get("Contact") or {}
        lines = [myob_line(ln, bool(t.get("IsTaxInclusive")), "Amount", rates) for ln in t.get("Lines") or [] if isinstance(ln, dict)]
        myob_header_tax(lines, bk_money(t.get("TotalTax")))
        bank.append({"id": str(t["UID"]), "kind": "spend", "contact_id": myob_ref(c), "contact": myob_ref(c, "Name"),
                     "date": myob_date(t.get("Date")), "total": round(bk_money(t.get("AmountPaid")) or 0.0, 2),
                     "tax": round(bk_money(t.get("TotalTax")) or 0.0, 2), "attachments": None,
                     # Set from the journals on a weekly run (only CHK-022 reads it).
                     "reconciled": True, "lines": lines, "link": ""})
    ledger = {"ledger": "myob", "weekly": bool(weekly), "truncated": truncated, "na": na, "unread": [],
              "contacts": contacts, "docs": docs, "bank": bank}
    if not weekly:
        return ledger

    accounts = [a for a in myob_items(myob_call("list_accounts", file_id)) if isinstance(a, dict) and not a.get("IsHeader") and a.get("UID")]
    ledger["accounts"] = [{"id": str(a["UID"]), "code": str(a.get("DisplayID") or ""), "name": str(a.get("Name") or ""),
                           "type": str(a.get("Type") or ""), "tax_type": myob_ref(a.get("TaxCode"), "Code"),
                           "active": a.get("IsActive") is not False, "pl": a.get("Classification") in MYOB_PL}
                          for a in accounts]
    ledger["tax_rates"] = rates
    # Journals: reconciliation (the bank and credit card lines' ReconciledDate, as MYOB's bank reconciliation reads it)
    # and the general journals the month-end check compares.
    journal_since = min(since, (today.replace(day=1) - datetime.timedelta(days=100)).replace(day=1))
    cash = {str(a["UID"]) for a in accounts if a.get("Type") in ("Bank", "CreditCard")}
    spend = {s["id"]: s for s in bank}
    journals, moves = [], []
    for j in myob_items(myob_call("list_journal_transactions", file_id, from_date=str(journal_since), to_date=str(today))):
        if not isinstance(j, dict):
            continue
        when = myob_date(j.get("DateOccurred") or j.get("DatePosted"))
        source = j.get("SourceTransaction") or {}
        general = j.get("JournalType") == "General" or source.get("TransactionType") == "GeneralJournal"
        if general:
            journals.append({"id": str(j.get("UID") or ""), "date": when, "narration": str(j.get("Description") or ""), "link": ""})
        hits = [ln for ln in j.get("Lines") or [] if isinstance(ln, dict) and myob_ref(ln.get("Account")) in cash]
        if not hits or when < str(since):
            continue
        # What CHK-023 compares with the statement lines: each payment, receipt, spend or receive money and transfer, per
        # bank or card account it moved (a general journal straight to a bank account needn't have a line).
        if not general:
            who = spend[myob_ref(source)]["contact"] if myob_ref(source) in spend else str(j.get("Description") or "")
            for ln in hits:
                moves.append({"id": myob_ref(source) or "j-" + str(j.get("UID") or ""), "account": myob_ref(ln.get("Account")),
                              "date": when, "amount": round((-1 if ln.get("IsCredit") else 1) * abs(bk_money(ln.get("Amount")) or 0.0), 2),
                              "text": who})
        reconciled = all(ln.get("ReconciledDate") for ln in hits)
        if myob_ref(source) in spend:
            spend[myob_ref(source)]["reconciled"] = reconciled
        else:
            bank.append({"id": "j-" + str(j.get("UID") or ""), "kind": "other", "contact_id": "", "contact": "", "date": when,
                         "total": round(sum((-1 if ln.get("IsCredit") else 1) * abs(bk_money(ln.get("Amount")) or 0.0) for ln in hits), 2),
                         "tax": 0.0, "attachments": None, "reconciled": reconciled, "lines": [], "link": ""})
    ledger["journals"] = journals
    # Bank feed and imported statement lines (CHK-023): IsCredit is money in; SourceTransactions are the recorded
    # transactions a line is matched to. No lines at all (no feeds, nothing imported) leaves CHK-023 not checked; a
    # connector that can't list them leaves its findings as they were. Not yet seen on a real file: confirm on QA.
    exc = None
    try:
        statement = []
        for s in myob_items(myob_call("list_bank_statement_lines", file_id, from_date=str(since), to_date=str(today), status="All")):
            if not isinstance(s, dict) or not s.get("UID"):
                continue
            status = str(s.get("Status") or "").lower()
            statement.append({"id": str(s["UID"]), "account": myob_ref(s.get("Account")), "date": myob_date(s.get("Date")),
                              "amount": round((1 if s.get("IsCredit") else -1) * abs(bk_money(s.get("Amount")) or 0.0), 2),
                              "text": str(s.get("Description") or s.get("Reference") or "").strip(),
                              "status": status if status in ("uncoded", "coded", "hidden") else "coded",
                              "matched": [myob_ref(t) for t in s.get("SourceTransactions") or [] if isinstance(t, dict) and myob_ref(t)]})
        ledger["statement"], ledger["bank_moves"] = statement, moves
        if not statement:
            na["CHK-023"] = "this company file has no bank feed or imported statement lines in the weeks checked"
    except Exception as exc:
        ledger["unread"].append("statement")
    # The lock period (CHK-134, CHK-135): MYOB locks entries dated before LockPeriodPriorTo, so the last locked day is
    # the day before. Quotes and purchase orders (CHK-040, CHK-093): MYOB has no drafts, so the open ones are the nearest
    # match (an accepted quote becomes an invoice, an order a bill). A connector without these tools leaves them not checked.
    lock = ""
    try:
        prior = ck_day(myob_date((myob_call("get_lock_period", file_id) or {}).get("LockPeriodPriorTo")))
        lock = str(prior - datetime.timedelta(days=1)) if prior else ""
        for check in ("CHK-134", "CHK-135"):
            na.pop(check, None)
    except Exception as exc:
        lock = ""
    ledger["org"] = {"lock_date": lock, "eoy_lock_date": "", "settings_link": ""}
    try:
        ledger["quotes"] = [myob_open_doc(q, "Customer") for q in myob_items(myob_call("list_quotes", file_id, from_date=str(since),
                                                                                        to_date=str(today)))]
        ledger["quote_state"] = "are still open, not turned into an invoice"
        na.pop("CHK-040", None)
    except Exception as exc:
        ledger.pop("quotes", None)
    try:
        ledger["purchase_orders"] = [myob_open_doc(o, "Supplier") for o in myob_items(myob_call("list_purchase_orders", file_id,
                                                                                                status="Open"))]
        ledger["order_state"] = "are still open, not turned into a bill"
        na.pop("CHK-093", None)
    except Exception as exc:
        ledger.pop("purchase_orders", None)
    ledger["balances"] = {"now": myob_breakdown(myob_call("get_balance_sheet", file_id, date=str(today))),
                          "month_ago": myob_breakdown(myob_call("get_balance_sheet", file_id, date=str(today - datetime.timedelta(days=30))))}
    pl = myob_breakdown(myob_call("get_profit_and_loss_3m", file_id, from_date=str(today - datetime.timedelta(days=364)),
                                  to_date=str(today), reporting_basis="Accrual"))
    income = {str(a["UID"]) for a in accounts if a.get("Classification") == "Income"}
    ledger["pl_12m"] = {"income": round(sum(v for k, v in pl.items() if k in income), 2),
                        "moved": sorted(k for k, v in pl.items() if v)}
    return ledger


def myob_open_doc(x, who):
    """An open quote or purchase order, as the CHK-040 / CHK-093 rows."""
    return {"id": str(x.get("UID") or ""), "number": str(x.get("Number") or ""), "date": myob_date(x.get("Date")),
            "contact": myob_ref(x.get(who), "Name"), "total": round(bk_money(x.get("TotalAmount")) or 0.0, 2), "link": ""}


def bk_ledger(client, today, since, weekly):
    """The ledger checks' snapshot of a client's file. Each ledger adapter (xero, myob, qbo) has its own."""
    return myob_ledger(client["myob_company_file_id"], today, since, weekly)
