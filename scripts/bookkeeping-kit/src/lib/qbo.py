# ── bookkeeping kit: QuickBooks Online ledger adapter (inlined into the Bookkeeping checks for QuickBooks nodes by gen-ext.js) ──
# Reads only. A QuickBooks connection reaches one company (the realm is fixed when it's connected), so every read is
# of the connected company and the client's checks run only while that is still the client's company. Ported from
# the Client Report Analytics QuickBooks live checks (scripts/client-report-analytics-kit/quickbooks/live-checks.inc.js):
# each line's GST is its share of the document's tax line for its tax code's rate; duplicate contacts are checked
# among suppliers (QuickBooks keeps customers and suppliers apart, so one business in both is normal).

QBO = "quickbooks-accounting"
QBO_PAGE = 1000
QBO_MAX_PAGES = 10
QBO_APP = "https://app.qbo.intuit.com/app/"
QBO_LINE_DETAILS = ("SalesItemLineDetail", "AccountBasedExpenseLineDetail", "ItemBasedExpenseLineDetail")
QBO_NO_ABN = "QuickBooks contacts carry no ABN field through its API"
# Checks the quickbooks-accounting connector can't answer: not run, and listed on the Checks item (never shown as clear).
QBO_NA = {
    "CHK-007": QBO_NO_ABN, "CHK-008": QBO_NO_ABN,
    "CHK-002": QBO_NO_ABN, "CHK-003": QBO_NO_ABN, "CHK-004": QBO_NO_ABN, "CHK-005": QBO_NO_ABN, "CHK-009": QBO_NO_ABN,
    "CHK-030": QBO_NO_ABN, "CHK-039": QBO_NO_ABN, "CHK-068": QBO_NO_ABN, "CHK-069": QBO_NO_ABN, "CHK-071": QBO_NO_ABN,
    "CHK-072": QBO_NO_ABN, "CHK-076": QBO_NO_ABN, "CHK-077": QBO_NO_ABN, "CHK-085": QBO_NO_ABN, "CHK-088": QBO_NO_ABN,
    "CHK-016": "QuickBooks' API has no batch payments",
    "CHK-017": "QuickBooks' API doesn't return supplier bank details",
    "CHK-018": "QuickBooks' API doesn't return supplier bank details",
    "CHK-057": "QuickBooks' API doesn't return supplier bank details",
    "CHK-022": "QuickBooks doesn't say through its API whether a transaction is reconciled",
    "CHK-033": "QuickBooks has no draft or awaiting-approval invoices",
    "CHK-078": "QuickBooks has no draft or awaiting-approval bills",
    "CHK-040": "QuickBooks has no draft estimates",
    "CHK-093": "QuickBooks has no draft or awaiting-approval purchase orders",
    "CHK-139": "the fixed asset checks read Xero Assets",
    "CHK-140": "the fixed asset checks read Xero Assets",
}


def qbo_call(tool, **args):
    # Bound first on purpose: the platform's Publish lint only counts plain assignments as a function's own names.
    exc = None
    try:
        return api.connectors.invoke(server=QBO, tool=tool, args=args)
    except Exception as exc:
        raise RuntimeError("QuickBooks: " + str(exc)[:600]) from None


def qbo_rows(result, entity):
    q = result.get("QueryResponse") if isinstance(result, dict) else None
    rows = (q or {}).get(entity) if isinstance(q, dict) else None
    return [r for r in rows or [] if isinstance(r, dict)]


def qbo_pages(tool, entity, where="", order_by="", stop=None):
    """Every page of a list tool (1,000 rows a page), up to QBO_MAX_PAGES. stop(rows of a page) ends early.
    Returns (rows, truncated)."""
    rows = []
    for page in range(QBO_MAX_PAGES):
        args = {"startPosition": page * QBO_PAGE + 1, "maxResults": QBO_PAGE}  # type: dict[str, object]
        if where:
            args["where"] = where
        if order_by:
            args["orderBy"] = order_by
        batch = qbo_rows(qbo_call(tool, **args), entity)
        rows.extend(batch)
        if len(batch) < QBO_PAGE or (stop and stop(batch)):
            return rows, False
    return rows, True


def qbo_company():
    """The connected company: {name, id}."""
    result = qbo_call("get_company_info")
    info = result.get("CompanyInfo") if isinstance(result, dict) and isinstance(result.get("CompanyInfo"), dict) else result
    info = info if isinstance(info, dict) else {}
    return {"name": str(info.get("CompanyName") or info.get("LegalName") or ""), "id": str(info.get("Id") or "")}


def bk_find_file(name):
    """The client's company by the name on its settings form: (the match or None, the names available). A connection
    reaches one company, so the only candidate is the connected one."""
    company = qbo_company()
    found = bool(company["name"]) and (bk_norm(company["name"]) == bk_norm(name)
                                       or bool(bk_norm(name)) and bk_norm(name) in bk_norm(company["name"]))
    return ({"id": company["name"], "name": company["name"]} if found else None), [n for n in [company["name"]] if n]


def qbo_ref(value):
    return str((value or {}).get("value") or "") if isinstance(value, dict) else ""


def qbo_report_rows(report):
    """Every row of a QuickBooks report, depth first, as (top-level group, row)."""
    out = []

    def walk(rows, group):
        for r in (rows.get("Row") if isinstance(rows, dict) else None) or []:
            if not isinstance(r, dict):
                continue
            g = group or str(r.get("group") or "")
            out.append((g, r))
            walk(r.get("Rows"), g)
    walk((report or {}).get("Rows") if isinstance(report, dict) else None, "")
    return out


def qbo_cells(row):
    return [c for c in (row.get("ColData") or []) if isinstance(c, dict)]


def qbo_balances(day):
    """Each account's balance on a day (debit positive), from the trial balance, by account Id."""
    out = {}
    for _g, r in qbo_report_rows(qbo_call("get_report_trial_balance", start_date=str(day), end_date=str(day),
                                          accounting_method="Accrual")):
        cells = qbo_cells(r)
        if r.get("type") == "Data" and len(cells) >= 3 and cells[0].get("id"):
            out[str(cells[0]["id"])] = round((bk_money(cells[1].get("value")) or 0.0) - (bk_money(cells[2].get("value")) or 0.0), 2)
    return out


def qbo_ledger(today, since, weekly):
    """The neutral ledger snapshot the checks read (shape in checks.py) from the connected QuickBooks company. Weekly adds
    the chart of accounts, attachments, journal entries, the closing date, two trial balances and a 12-month P&L."""
    truncated = []
    na = dict(QBO_NA)
    window = "TxnDate >= '" + str(since) + "'"

    def pages(tool, entity, where="", label=""):
        rows, cut = qbo_pages(tool, entity, where)
        if cut:
            truncated.append((label or entity) + " (first " + "{:,}".format(QBO_PAGE * QBO_MAX_PAGES) + ")")
        return rows

    # Tax codes: Id -> (name, sales rate ids, purchase rate ids); rates' percentages from the tax rate list.
    percent = {str(t.get("Id")): bk_money(t.get("RateValue")) or 0.0 for t in pages("list_tax_rate", "TaxRate")}
    codes = {}
    for tc in pages("list_tax_code", "TaxCode"):
        ids = {side: [qbo_ref(d.get("TaxRateRef")) for d in ((tc.get(key) or {}).get("TaxRateDetail") or []) if isinstance(d, dict)]
               for side, key in (("S", "SalesTaxRateList"), ("P", "PurchaseTaxRateList"))}
        codes[str(tc.get("Id"))] = {"name": str(tc.get("Name") or "Tax code " + str(tc.get("Id"))), "S": ids["S"], "P": ids["P"]}
    rates = {}
    for cd in codes.values():
        known = [percent[r] for r in cd["P"] + cd["S"] if r in percent]
        rates[cd["name"]] = known[0] if known else 0.0

    def lines(t, side):
        by_rate = {}
        for x in (t.get("TxnTaxDetail") or {}).get("TaxLine") or []:
            d = x.get("TaxLineDetail") if isinstance(x, dict) else None
            if d:
                b = by_rate.setdefault(qbo_ref(d.get("TaxRateRef")) or "?", [0.0, 0.0])
                b[0] += bk_money(d.get("NetAmountTaxable")) or 0.0
                b[1] += bk_money(x.get("Amount")) or 0.0
        out = []
        for ln in t.get("Line") or []:
            if not isinstance(ln, dict) or ln.get("DetailType") not in QBO_LINE_DETAILS:
                continue
            d = ln.get(ln["DetailType"]) or {}
            cd = codes.get(qbo_ref(d.get("TaxCodeRef")))
            amount = bk_money(ln.get("Amount")) or 0.0
            # The line's share of each tax line for its code's rates (QuickBooks keeps the GST per rate, not per line).
            tax = sum(by_rate[r][1] * amount / by_rate[r][0] for r in (cd or {}).get(side, []) if r in by_rate and by_rate[r][0])
            # Item lines carry the item's account, which the API doesn't give on the line: only account-coded lines are coded.
            out.append({"account": qbo_ref(d.get("AccountRef")), "tax_type": cd["name"] if cd else "",
                        "amount": round(amount, 2), "tax": round(tax, 2)})
        return out

    def sent_of(t):
        if t.get("EmailStatus") == "EmailSent" or t.get("PrintStatus") == "PrintComplete":
            return True
        return False if t.get("EmailStatus") in ("NotSet", "NeedToSend") else None

    def doc(t, kind):
        sale = kind == "invoice"
        who = t.get("CustomerRef" if sale else "VendorRef") or {}
        total = round(bk_money(t.get("TotalAmt")) or 0.0, 2)
        balance = round(bk_money(t.get("Balance")) or 0.0, 2)
        return {"id": kind + ":" + str(t.get("Id")), "kind": kind, "number": str(t.get("DocNumber") or ""),
                "contact_id": ("C:" if sale else "V:") + qbo_ref(who) if qbo_ref(who) else "", "contact": str(who.get("name") or ""),
                "date": str(t.get("TxnDate") or "")[:10], "due": str(t.get("DueDate") or "")[:10],
                "status": "void" if not total else "paid" if balance <= 0 else "authorised", "total": total,
                "tax": round(bk_money((t.get("TxnTaxDetail") or {}).get("TotalTax")) or 0.0, 2), "due_amount": balance,
                "paid_on": "", "attachments": None, "sent": sent_of(t) if sale else None, "lines": lines(t, "S" if sale else "P"),
                "link": QBO_APP + ("invoice" if sale else "bill") + "?txnId=" + str(t.get("Id"))}

    docs, seen = [], set()
    for kind, tool, entity in (("bill", "list_bill", "Bill"), ("invoice", "list_invoice", "Invoice")):
        rows = [(r, False) for r in pages(tool, entity, window, kind + "s")]
        # Open documents dated before the window: bills still to pay, and (weekly) sales still owed.
        if kind == "bill" or weekly:
            rows += [(r, kind == "invoice") for r in pages(tool, entity, "Balance > '0'", "open " + kind + "s")]
        for r, older in rows:
            d = doc(r, kind)
            if r.get("Id") is not None and d["id"] not in seen:
                seen.add(d["id"])
                d["older_open"] = older and d["date"] < str(since)
                docs.append(d)
    # When a bill was paid: the latest bill payment linked to it.
    paid = {}
    for p in pages("list_bill_payment", "BillPayment", window, "bill payments"):
        for ln in p.get("Line") or []:
            for link in (ln.get("LinkedTxn") or []) if isinstance(ln, dict) else []:
                if isinstance(link, dict) and link.get("TxnType") == "Bill":
                    key = "bill:" + str(link.get("TxnId"))
                    paid[key] = max(paid.get(key, ""), str(p.get("TxnDate") or "")[:10])
    for d in docs:
        if d["kind"] == "bill" and d["status"] == "paid":
            d["paid_on"] = paid.get(d["id"], "")

    bank = []
    for t in pages("list_purchase", "Purchase", window, "expenses"):
        e = t.get("EntityRef") or {}
        prefix = {"Vendor": "V:", "Customer": "C:", "Employee": "E:"}.get(str(e.get("type") or ""), "X:")
        bank.append({"id": "purchase:" + str(t.get("Id")), "kind": "other" if t.get("Credit") is True else "spend",
                     "contact_id": prefix + qbo_ref(e) if qbo_ref(e) else "", "contact": str(e.get("name") or ""),
                     "date": str(t.get("TxnDate") or "")[:10], "total": round(bk_money(t.get("TotalAmt")) or 0.0, 2),
                     "tax": round(bk_money((t.get("TxnTaxDetail") or {}).get("TotalTax")) or 0.0, 2), "attachments": None,
                     "reconciled": None, "lines": lines(t, "P"), "link": QBO_APP + "expense?txnId=" + str(t.get("Id"))})
    contacts = [{"id": "V:" + str(v.get("Id")), "name": str(v.get("DisplayName") or v.get("CompanyName") or ""), "tax_number": "",
                 "bank": "", "has_address": bool(str((v.get("BillAddr") or {}).get("Line1") or (v.get("BillAddr") or {}).get("City") or "").strip()),
                 "link": QBO_APP + "vendordetail?nameId=" + str(v.get("Id"))}
                for v in pages("list_vendor", "Vendor", "Active = true", "suppliers") if v.get("Id") is not None]
    ledger = {"ledger": "quickbooks", "weekly": bool(weekly), "truncated": truncated, "na": na, "unread": [],
              "contacts": contacts, "docs": docs, "bank": bank}
    if not weekly:
        return ledger

    # Attachments: newest first, back to a month before last month (the attachment checks read last month only). If
    # the list runs past the page limit first, "nothing attached" can't be told from "not listed": those checks read N/A.
    lm_start = (today.replace(day=1) - datetime.timedelta(days=1)).replace(day=1)
    cutoff = str(lm_start - datetime.timedelta(days=31))
    attached, cut = qbo_pages("list_attachable", "Attachable", order_by="MetaData.LastUpdatedTime DESC",
                              stop=lambda rows: str(((rows[-1].get("MetaData") or {}).get("LastUpdatedTime")) or "")[:10] < cutoff)
    if cut:
        for check in ("CHK-021", "CHK-086"):
            na[check] = "over " + "{:,}".format(QBO_PAGE * QBO_MAX_PAGES) + " recent attachments, so a missing one can't be told from one not listed"
    else:
        on = set()
        for a in attached:
            for ref in a.get("AttachableRef") or []:
                e = (ref.get("EntityRef") or {}) if isinstance(ref, dict) else {}
                if e.get("type") and e.get("value") is not None:
                    on.add(str(e["type"]) + ":" + str(e["value"]))
        for d in docs:
            d["attachments"] = (("Invoice" if d["kind"] == "invoice" else "Bill") + ":" + d["id"].split(":", 1)[1]) in on
        for s in bank:
            s["attachments"] = ("Purchase:" + s["id"].split(":", 1)[1]) in on

    accounts = pages("list_account", "Account", "Active = true", "accounts")
    ledger["accounts"] = [{"id": str(a.get("Id")), "code": str(a.get("Id")),
                           "label": ((str(a["AcctNum"]) + " ") if a.get("AcctNum") else "") + str(a.get("Name") or ""),
                           "name": str(a.get("Name") or ""),
                           "type": "DEPRECIATN" if a.get("AccountSubType") == "Depreciation" else str(a.get("AccountType") or ""),
                           "tax_type": (codes.get(qbo_ref(a.get("TaxCodeRef"))) or {}).get("name") or "",
                           "active": a.get("Active") is not False, "pl": a.get("Classification") in ("Revenue", "Expense")}
                          for a in accounts if a.get("Id") is not None]
    ledger["tax_rates"] = rates
    journal_since = (today.replace(day=1) - datetime.timedelta(days=100)).replace(day=1)
    ledger["journals"] = [{"id": str(j.get("Id")), "date": str(j.get("TxnDate") or "")[:10], "narration": str(j.get("PrivateNote") or ""),
                           "link": QBO_APP + "journal?txnId=" + str(j.get("Id"))}
                          for j in pages("list_journal_entry", "JournalEntry", "TxnDate >= '" + str(journal_since) + "'", "journal entries")]
    prefs = qbo_call("get_preferences")
    prefs = prefs.get("Preferences") if isinstance(prefs, dict) and isinstance(prefs.get("Preferences"), dict) else prefs
    closing = str((((prefs or {}) if isinstance(prefs, dict) else {}).get("AccountingInfoPrefs") or {}).get("BookCloseDate") or "")[:10]
    ledger["org"] = {"lock_date": closing, "eoy_lock_date": "", "settings_link": QBO_APP + "settings?panel=advanced"}
    ledger["balances"] = {"now": qbo_balances(today), "month_ago": qbo_balances(today - datetime.timedelta(days=30))}
    report = qbo_call("get_report_profit_and_loss", start_date=str(today - datetime.timedelta(days=364)), end_date=str(today),
                      accounting_method="Accrual", summarize_column_by="Total")
    moved = set()
    for _g, r in qbo_report_rows(report):
        cells = qbo_cells(r)
        if r.get("type") == "Data" and len(cells) >= 2 and cells[0].get("id") and (bk_money(cells[1].get("value")) or 0):
            moved.add(str(cells[0]["id"]))
    # Trading income: the top-level Income section's total (not Other Income), the closest the P&L gets to GST turnover.
    top = ((report.get("Rows") if isinstance(report, dict) else None) or {}).get("Row") or []
    section = next((r for r in top if isinstance(r, dict) and r.get("group") == "Income"), None)
    total = qbo_cells((section or {}).get("Summary") or {})
    ledger["pl_12m"] = {"income": round((bk_money(total[1].get("value")) if len(total) >= 2 else 0.0) or 0.0, 2),
                        "moved": sorted(moved)}
    return ledger


def bk_ledger(client, today, since, weekly):
    """The ledger checks' snapshot of a client's file. Each ledger adapter (xero, myob, qbo) has its own. A QuickBooks
    connection reaches one company, so the client's checks run only while it's the connected one."""
    company = qbo_company()
    if bk_norm(company["name"]) != bk_norm(client.get("qbo_company_name")):
        raise RuntimeError("the QuickBooks connection reaches " + (company["name"] or "no company") + ", not "
                           + str(client.get("qbo_company_name") or "this client's company") + ". A QuickBooks connection reaches "
                           "one company: the automation's owner needs to connect QuickBooks to this client's company.")
    return qbo_ledger(today, since, weekly)
