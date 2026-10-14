# ── bookkeeping kit: Xero ledger adapter (inlined into Xero nodes by gen-ext.js) ──
# Every write passes xero_tenant_id so it lands in the client's own Xero organisation
# (myhub-mcp-servers PR #558). Reads pass it too.
import base64
from collections import Counter

XERO = "xero-accounting"
XERO_EXPENSE_TYPES = {"EXPENSE", "DIRECTCOSTS", "OVERHEADS", "FIXED", "CURRENT", "INVENTORY", "PREPAYMENT", "NONCURRENT"}
XERO_REVENUE_TYPES = {"REVENUE", "SALES", "OTHERINCOME"}
XERO_DEAD = {"DELETED", "VOIDED"}


def xero_call(tool, tenant_id=None, **args):
    if tenant_id:
        args["xero_tenant_id"] = tenant_id
    # Bound first on purpose: the platform's Publish lint only counts plain assignments as a function's own names,
    # so an `except ... as exc` name alone reads as undefined inside a helper.
    exc = None
    try:
        return api.connectors.invoke(server=XERO, tool=tool, args=args)
    except Exception as exc:
        raise RuntimeError(xero_error_text(exc)) from None


def xero_error_text(exc):
    """Xero's own validation messages (the useful part, at the end of a long error), else the error text."""
    text = str(exc)
    at = text.find("ValidationErrors")
    messages = []
    for m in re.findall(r'"Message"\s*:\s*"((?:[^"\\]|\\.)*)"', text[at:] if at >= 0 else ""):
        if m not in messages:
            messages.append(m)
    return ("Xero says: " + "; ".join(messages)) if messages else text[:600]


def xero_q(value):
    return str(value).replace("\\", "\\\\").replace('"', '\\"')


def xero_rows(result, key):
    if isinstance(result, dict):
        return result.get(key) or []
    if isinstance(result, list):
        return result
    return []


def xero_connections():
    res = api.connectors.invoke(server=XERO, tool="list_connections", args={})
    if isinstance(res, dict):
        res = res.get("connections") or res.get("tenants") or []
    return [c for c in (res or []) if isinstance(c, dict)]


def xero_find_supplier(tenant_id, name, abn):
    """Existing contact by ABN (TaxNumber) first, then by normalised name. None when not found."""
    if not name:
        return None
    rows = xero_rows(xero_call("list_contacts", tenant_id, searchTerm=str(name)[:60]), "Contacts")
    abn_digits = "".join(ch for ch in str(abn or "") if ch.isdigit())
    if abn_digits:
        for c in rows:
            if "".join(ch for ch in str(c.get("TaxNumber") or "") if ch.isdigit()) == abn_digits:
                return c
    target = bk_norm(name)
    for c in rows:
        if bk_norm(c.get("Name")) == target:
            return c
    return None


def xero_duplicates(tenant_id, contact_id, invoice_number, doc_type="ACCPAY"):
    if not invoice_number:
        return []
    if doc_type == "ACCREC":
        # A sales invoice number is unique across the whole organisation, whoever the customer is.
        where = 'Type=="ACCREC" AND InvoiceNumber=="%s"' % xero_q(invoice_number)
    elif not contact_id:
        return []
    else:
        where = 'Type=="ACCPAY" AND Contact.ContactID==guid("%s") AND InvoiceNumber=="%s"' % (
            xero_q(contact_id), xero_q(invoice_number))
    rows = xero_rows(xero_call("list_invoices", tenant_id, where=where), "Invoices")
    return [r for r in rows if r.get("Status") not in XERO_DEAD]


def xero_history_coding(tenant_id, contact_id, doc_type="ACCPAY"):
    """Most common (AccountCode, TaxType) on the contact's recent bills (or sales invoices), or None."""
    if not contact_id:
        return None
    where = 'Type=="%s" AND Contact.ContactID==guid("%s")' % (doc_type, xero_q(contact_id))
    rows = xero_rows(xero_call("list_invoices", tenant_id, where=where, order="Date DESC", page=1), "Invoices")
    pairs = []
    for inv in rows[:5]:
        if inv.get("Status") in XERO_DEAD:
            continue
        for li in inv.get("LineItems") or []:
            if li.get("AccountCode"):
                pairs.append((li.get("AccountCode"), li.get("TaxType") or ""))
    if not pairs:
        return None
    (code, tax), _ = Counter(pairs).most_common(1)[0]
    return {"account_code": code, "tax_type": tax}


def xero_chart(tenant_id, doc_type="ACCPAY"):
    """Active accounts and tax rates a bill (expense side) or a sales invoice (revenue side) can use."""
    sales = doc_type == "ACCREC"
    accounts = xero_rows(xero_call("list_accounts", tenant_id, where='Status=="ACTIVE"'), "Accounts")
    taxes = xero_rows(xero_call("list_tax_rates", tenant_id), "TaxRates")
    kinds = XERO_REVENUE_TYPES if sales else XERO_EXPENSE_TYPES
    acc = [{"code": a.get("Code"), "name": a.get("Name"), "type": a.get("Type"),
            "description": (a.get("Description") or "")[:120]}
           for a in accounts if a.get("Code") and a.get("Type") in kinds]
    tax = [{"type": t.get("TaxType"), "name": t.get("Name"), "rate": t.get("EffectiveRate")}
           for t in taxes if t.get("Status", "ACTIVE") == "ACTIVE"
           and t.get("CanApplyToRevenue" if sales else "CanApplyToExpenses", True)]
    return acc, tax


def xero_org_identity(tenant_id):
    """The client's own names and ABN, from its Xero organisation: who issues its sales invoices."""
    try:
        org = xero_call("get_organisation", tenant_id)
    except Exception:
        return {"names": [], "abn": ""}
    if isinstance(org, dict) and isinstance(org.get("Organisations"), list):
        org = org["Organisations"][0] if org["Organisations"] else {}
    elif isinstance(org, list):
        org = org[0] if org else {}
    org = org if isinstance(org, dict) else {}
    names = [str(n) for n in (org.get("Name"), org.get("LegalName")) if n]
    abn = "".join(ch for ch in str(org.get("TaxNumber") or org.get("RegistrationNumber") or "") if ch.isdigit())
    return {"names": names, "abn": abn}


def xero_bill_body(proposal, status):
    lines = []
    for ln in proposal.get("lines") or []:
        qty = ln.get("quantity") or 1
        unit = ln.get("unit_amount")
        if unit is None:
            unit = round((ln.get("line_amount") or 0) / qty, 4) if qty else (ln.get("line_amount") or 0)
        item = {"Description": (ln.get("description") or "")[:4000], "Quantity": qty, "UnitAmount": unit}
        if ln.get("item_code"):
            item["ItemCode"] = ln["item_code"]
        if ln.get("account_code"):
            item["AccountCode"] = ln["account_code"]
        if ln.get("tax_type"):
            item["TaxType"] = ln["tax_type"]
        lines.append(item)
    body = {
        "Type": proposal.get("doc_type") or "ACCPAY",
        "Contact": {"ContactID": proposal["contact"]["id"]},
        "Date": proposal.get("date"),
        "LineAmountTypes": proposal.get("line_amount_types") or "Exclusive",
        "LineItems": lines,
        "Status": status,
    }
    for key, field in (("due_date", "DueDate"), ("invoice_number", "InvoiceNumber"),
                       ("reference", "Reference"), ("currency", "CurrencyCode")):
        if proposal.get(key):
            body[field] = proposal[key]
    return body


def xero_ensure_contact(tenant_id, proposal):
    contact = proposal.get("contact") or {}
    if contact.get("id"):
        return contact["id"]
    # An earlier attempt may have created the contact before Xero rejected the bill; reuse it.
    found = xero_find_supplier(tenant_id, contact.get("name"), contact.get("abn"))
    if found and found.get("ContactID"):
        proposal["contact"]["id"] = found["ContactID"]
        proposal["contact"]["is_new"] = False
        return found["ContactID"]
    body = {"Name": contact.get("name") or "Unknown supplier"}
    if contact.get("abn"):
        body["TaxNumber"] = contact["abn"]
    if contact.get("email"):
        body["EmailAddress"] = contact["email"]
    rows = xero_rows(xero_call("create_contact", tenant_id, contact=body), "Contacts")
    if not rows or not rows[0].get("ContactID"):
        raise RuntimeError("Xero did not return the new contact")
    proposal["contact"]["id"] = rows[0]["ContactID"]
    proposal["contact"]["is_new"] = False
    return rows[0]["ContactID"]


def xero_terms_due(terms, issue):
    """Due date from Xero payment terms ({"Day": n, "Type": ...}) for a bill dated `issue`, or None."""
    try:
        day = int(str((terms or {}).get("Day") or ""))
    except (TypeError, ValueError):
        return None
    kind = str((terms or {}).get("Type") or "")
    next_month = (issue.replace(day=1) + datetime.timedelta(days=32)).replace(day=1)
    if kind == "DAYSAFTERBILLDATE":
        return issue + datetime.timedelta(days=day)
    if kind == "DAYSAFTERBILLMONTH":
        return next_month - datetime.timedelta(days=1) + datetime.timedelta(days=day)
    if kind == "OFCURRENTMONTH":
        return issue.replace(day=min(max(day, 1), (next_month - datetime.timedelta(days=1)).day))
    if kind == "OFFOLLOWINGMONTH":
        after = (next_month + datetime.timedelta(days=32)).replace(day=1)
        return next_month.replace(day=min(max(day, 1), (after - datetime.timedelta(days=1)).day))
    return None


def xero_default_due(tenant_id, contact, issue_date, doc_type="ACCPAY"):
    """(due date, where it came from) for a bill or invoice with no due date: the contact's payment terms in Xero,
    then the organisation's default terms, then the document date. ("", "") when there's no usable date."""
    side = "Sales" if doc_type == "ACCREC" else "Bills"
    who = "customer" if doc_type == "ACCREC" else "supplier"
    try:
        issue = datetime.date.fromisoformat(str(issue_date or "")[:10])
    except ValueError:
        return "", ""
    due = xero_terms_due(((contact or {}).get("PaymentTerms") or {}).get(side), issue)
    if due:
        return str(due), "the " + who + "'s payment terms in Xero"
    try:
        org = xero_call("get_organisation", tenant_id)
        if isinstance(org, dict) and isinstance(org.get("Organisations"), list):
            org = org["Organisations"][0] if org["Organisations"] else {}
        elif isinstance(org, list):
            org = org[0] if org else {}
        due = xero_terms_due(((org or {}).get("PaymentTerms") or {}).get(side), issue)
    except Exception:
        due = None
    if due:
        return str(due), "the organisation's default " + ("invoice" if side == "Sales" else "bill") + " terms in Xero"
    return str(issue), "the invoice date, because no payment terms are set in Xero"


def xero_create_bill(tenant_id, proposal, status="DRAFT"):
    xero_ensure_contact(tenant_id, proposal)
    rows = xero_rows(xero_call("create_invoice", tenant_id, invoice=xero_bill_body(proposal, status)), "Invoices")
    if not rows or not rows[0].get("InvoiceID"):
        raise RuntimeError("Xero did not return the new bill")
    if not proposal.get("invoice_number") and rows[0].get("InvoiceNumber"):
        # A raised invoice takes the organisation's next number.
        proposal["invoice_number"] = rows[0]["InvoiceNumber"]
    return rows[0]["InvoiceID"]


def xero_items(tenant_id):
    """The organisation's sold items: [{code, name, description, price, account_code, tax_type}]."""
    out = []
    for it in xero_rows(xero_call("list_items", tenant_id), "Items"):
        if it.get("IsSold") is False or not it.get("Code"):
            continue
        sd = it.get("SalesDetails") or {}
        out.append({"code": str(it["Code"]), "name": str(it.get("Name") or ""), "description": str(it.get("Description") or "")[:200],
                    "price": bk_money(sd.get("UnitPrice")), "account_code": str(sd.get("AccountCode") or ""),
                    "tax_type": str(sd.get("TaxType") or "")})
    return out


def xero_update_bill_lines(tenant_id, bill_id, proposal):
    body = xero_bill_body(proposal, "DRAFT")
    patch = {k: v for k, v in body.items() if k not in ("Type", "Status")}
    xero_call("update_invoice", tenant_id, invoiceId=bill_id, patch=patch)


def xero_set_status(tenant_id, bill_id, status):
    xero_call("update_invoice", tenant_id, invoiceId=bill_id, patch={"Status": status})


def xero_attach_pdf(tenant_id, bill_id, knowledge_path):
    """Attach the knowledge file to the bill. Returns '' on success or the error text."""
    return xero_attach_file(tenant_id, "Invoices", bill_id, knowledge_path, knowledge_path.split("/")[-1])


def xero_attach_file(tenant_id, host_type, host_id, knowledge_path, file_name):
    """Attach a Knowledge PDF to a Xero record (Invoices, Accounts, Contacts, ...). Returns '' or the error text."""
    exc = None  # see xero_call
    try:
        local = api.files.get(file=knowledge_path)
        with open(local, "rb") as fh:
            content = base64.b64encode(fh.read()).decode("ascii")
        xero_call("upload_attachment", tenant_id, hostType=host_type, hostId=host_id,
                  fileName=file_name, base64Content=content, mimeType="application/pdf")
        return ""
    except Exception as exc:
        return str(exc)[:300]


def xero_match_bank(accounts, statement):
    """The Xero bank account a bank or card statement belongs to: by account or card number, then by name. None when
    no account or more than one fits."""
    digits = "".join(ch for ch in str(statement.get("bsb") or "") + str(statement.get("account_number") or "") if ch.isdigit())
    number = "".join(ch for ch in str(statement.get("account_number") or "") if ch.isdigit())
    card = "".join(ch for ch in str(statement.get("card_last4") or "") if ch.isdigit())[-4:]
    hits = []
    for a in accounts:
        theirs = "".join(ch for ch in str(a.get("BankAccountNumber") or "") if ch.isdigit())
        if not theirs:
            continue
        # Statements often print only part of the number, so the last four digits decide (two hits = unsure).
        if ((len(number) >= 4 and len(theirs) >= 4 and theirs[-4:] == number[-4:]) or (digits and digits == theirs)
                or (len(card) == 4 and theirs.endswith(card))):
            hits.append(a)
    if len(hits) == 1:
        return hits[0]
    if hits:
        return None
    names = [bk_norm(statement.get(k)) for k in ("account_name", "institution") if bk_norm(statement.get(k))]
    by_name = [a for a in accounts if any(n and (n in bk_norm(a.get("Name")) or bk_norm(a.get("Name")) in n) for n in names)]
    return by_name[0] if len(by_name) == 1 else None


def xero_bank_balance(tenant_id, account, start, end):
    """The account's closing balance in Xero over the statement period (Bank Summary report), or None."""
    report = xero_call("get_bank_summary", tenant_id, fromDate=str(start or end), toDate=str(end))
    reports = report.get("Reports") if isinstance(report, dict) else None
    rows = (reports[0] if reports else (report if isinstance(report, dict) else {})).get("Rows") or []
    stack = list(rows)
    while stack:
        row = stack.pop(0)
        stack.extend(row.get("Rows") or [])
        cells = row.get("Cells") or []
        if not cells:
            continue
        ids = [att.get("Value") for c in cells for att in (c.get("Attributes") or []) if isinstance(att, dict)]
        if account.get("AccountID") in ids or bk_norm(cells[0].get("Value")) == bk_norm(account.get("Name")):
            return bk_money(cells[-1].get("Value"))
    return None


def xero_open_balance(tenant_id, contact_id, doc_type):
    """What's still owing on the contact's approved bills (ACCPAY) or invoices (ACCREC), and their invoice numbers."""
    owing, numbers = 0.0, set()
    for status_name in ("SUBMITTED", "AUTHORISED"):
        where = 'Type=="%s" AND Status=="%s" AND Contact.ContactID==guid("%s")' % (doc_type, status_name, xero_q(contact_id))
        for inv in xero_rows(xero_call("list_invoices", tenant_id, where=where), "Invoices"):
            owing += bk_money(inv.get("AmountDue")) or 0
    where = 'Type=="%s" AND Contact.ContactID==guid("%s")' % (doc_type, xero_q(contact_id))
    for inv in xero_rows(xero_call("list_invoices", tenant_id, where=where), "Invoices"):
        if inv.get("Status") not in XERO_DEAD and inv.get("InvoiceNumber"):
            numbers.add(bk_norm(inv["InvoiceNumber"]))
    return round(owing, 2), numbers


def xero_bill_link(bill_id, doc_type="ACCPAY"):
    area = "AccountsReceivable" if doc_type == "ACCREC" else "AccountsPayable"
    return "https://go.xero.com/" + area + "/Edit.aspx?InvoiceID=" + str(bill_id)


def xero_bill_markdown(proposal, warnings=None, blocking=None, bill_id="", file_path="", client_name=""):
    """The review item's description: what the AI read, how it coded it, and what to check."""
    p = proposal or {}
    c = p.get("contact") or {}
    cur = p.get("currency") or ""
    sales = p.get("doc_type") == "ACCREC"
    raising = p.get("origin") == "request"
    doc = "invoice" if sales else "bill"
    out = []
    if raising:
        out.append("**Invoice to raise** from " + (client_name or "the client") + " to **" + (c.get("name") or "Unknown customer")
                   + "**" + (" (new customer)" if c.get("is_new") else "") + (" · " + c["email"] if c.get("email") else ""))
    elif sales:
        out.append("**Sales invoice** from " + (client_name or "the client") + " to **" + (c.get("name") or "Unknown customer")
                   + "**" + (" (new customer)" if c.get("is_new") else ""))
    else:
        out.append("**" + (c.get("name") or "Unknown supplier") + "**" + (" (new supplier)" if c.get("is_new") else "")
                   + (" for " + client_name if client_name else ""))
    out.append("")
    out.append("- Invoice " + (p.get("invoice_number") or ("numbered by Xero" if raising else "—")) + ", dated " + (p.get("date") or "—")
               + ", due " + (p.get("due_date") or "—"))
    out.append("- Total " + bk_fmt(p.get("total"), cur) + " (GST " + bk_fmt(p.get("tax"), cur) + ", amounts "
               + ("include" if p.get("line_amount_types") == "Inclusive" else "exclude") + " GST)")
    if bill_id:
        out.append("- Draft " + doc + " in Xero: [open in Xero](" + xero_bill_link(bill_id, p.get("doc_type") or "ACCPAY") + ")")
    else:
        out.append("- Not in Xero yet: the " + doc + " is created when you approve")
    if file_path:
        out.append("- PDF: `" + file_path + "` in Knowledge")
    out.append("")
    out.append("**Lines**")
    out.append("")
    # A list, not a table: WorkQ descriptions don't render markdown tables.
    for i, ln in enumerate(p.get("lines") or []):
        desc = str(ln.get("description") or "").replace("\n", " ")[:120]
        out.append("- Line " + str(i + 1) + ": " + desc + ", " + bk_fmt(ln.get("line_amount"), cur) + ". Account **"
                   + (ln.get("account_code") or "missing") + "**, tax " + (ln.get("tax_type") or "—") + ". "
                   + str(ln.get("reason") or "")[:160] + " (" + str(ln.get("confidence") or "low") + " confidence)")
    if blocking:
        out.append("")
        out.append("**Must fix before approving**")
        out.extend("- " + b for b in blocking)
    if warnings:
        out.append("")
        out.append("**Check**")
        out.extend("- " + w for w in warnings)
    out.append("")
    if raising:
        out.append("Fill in the **Invoice to send** form on this item: approve it (and choose whether Xero emails it to the "
                   "customer), change it, reject it or ask the client.")
    else:
        out.append("Fill in the **" + ("Invoice" if sales else "Bill") + " review** form on this item to approve, change, "
                   "reject or ask the client." + (" Approving records it in Xero as awaiting payment; nothing is emailed "
                                                  "to the customer." if sales else ""))
    return "\n".join(out)
