REQUEST_PROMPT = (
    "A small business has asked its bookkeeper to raise a sales invoice to one of its customers. From the request, "
    "extract the invoice to raise. Never guess: a quantity, price, date or email the request doesn't state is null. "
    "'items' lists the business's Xero items; when a line is one of them, give its code in item_code. A price the "
    "request states wins over the item's price. Dates as YYYY-MM-DD (Australian requests are day/month/year). If the "
    "request isn't actually asking for an invoice to be raised, set is_request false."
)
REQUEST_HINT = ('{"is_request": true, "customer_name": "", "customer_email": null, "reference": "", "invoice_date": null, '
                '"due_date": null, "lines": [{"description": "", "quantity": 1, "unit_amount": null, "item_code": null}], '
                '"notes": ""}')
SALES_CODE_PROMPT = (
    "You code sales invoice lines for an Australian bookkeeper: the client is invoicing its customer. For each line, "
    "pick the best revenue account code from 'accounts' and the tax type from 'tax_rates' (GST on income for taxable "
    "sales when the business is GST registered, GST-free income or BAS-excluded otherwise). Use the client's coding "
    "notes when they apply. Only use codes that appear in the lists. Give a one-sentence reason and a confidence of "
    "high, medium or low for each line."
)
CODE_HINT = '[{"index": 0, "account_code": "200", "tax_type": "OUTPUT", "reason": "", "confidence": "high"}]'

problem = params.get("problem") or ""
ctx = params.get("ctx") or {}
request = params.get("request") or {}
proposal = {}
warnings = []
blocking = []
bill_id = ""

if not problem:
    try:
        settings = ctx.get("settings") or {}
        client = ctx.get("client") or {}
        tenant = client["xero_tenant_id"]
        items = xero_items(tenant)
        asked = api.ai.extract(
            prompt=REQUEST_PROMPT,
            input=json.dumps({"business": client.get("name"), "today": str(bk_today(settings)),
                              "request": {"from": request.get("from"), "subject": request.get("subject"),
                                          "text": str(request.get("text") or "")[:8000]},
                              "items": [{"code": i["code"], "name": i["name"], "description": i["description"],
                                         "price": i["price"]} for i in items[:200]]})[:30000],
            schema_hint=REQUEST_HINT,
        )
        asked = asked if isinstance(asked, dict) else {}
        customer = str(asked.get("customer_name") or "").strip()
        if not asked:
            problem = "The AI couldn't read this request."
        elif asked.get("is_request") is False:
            problem = "This doesn't look like a request to raise an invoice, so nothing was drafted."
        elif not customer:
            problem = "The request doesn't say which customer to invoice."
        elif not (asked.get("lines") or []):
            problem = "The request doesn't say what to invoice."
    except Exception as exc:
        problem = "Couldn't read the request: " + str(exc)[:400]
        asked, customer, items, client, settings, tenant = {}, "", [], {}, {}, ""

if not problem:
    try:
        contact = xero_find_supplier(tenant, customer, "")
        email = str((contact or {}).get("EmailAddress") or asked.get("customer_email") or "").strip()
        if not contact:
            warnings.append("New customer: \"" + customer + "\" isn't in Xero yet. The contact is created when you approve"
                            + (" (with " + email + ")." if email else "."))
        if not email:
            warnings.append("There's no email address for " + customer + ", so Xero can't email the invoice. Add one to "
                            "the contact in Xero, or send the invoice yourself.")

        accounts, taxes = xero_chart(tenant, "ACCREC")
        codes = {a["code"] for a in accounts}
        tax_types = {t["type"] for t in taxes}
        rates = {t["type"]: bk_money(t.get("rate")) or 0 for t in taxes}
        by_code = {i["code"].lower(): i for i in items}
        rules = (ctx.get("rules") or {}).get("customers") or {}
        rule = (rules.get(contact.get("ContactID")) if contact else None) or rules.get("name:" + bk_norm(customer))
        hist = xero_history_coding(tenant, contact.get("ContactID"), "ACCREC") if contact else None

        lines = []
        for i, ln in enumerate(asked.get("lines") or []):
            ln = ln if isinstance(ln, dict) else {}
            item = by_code.get(str(ln.get("item_code") or "").lower())
            qty = bk_money(ln.get("quantity")) or 1
            unit = bk_money(ln.get("unit_amount"))
            line = {"description": str(ln.get("description") or (item or {}).get("name") or "")[:400], "quantity": qty,
                    "item_code": (item or {}).get("code") or "", "price_source": "request" if unit is not None else ""}
            if unit is None and item and item.get("price") is not None:
                unit = item["price"]
                line["price_source"] = "the Xero item " + item["code"]
            line["unit_amount"] = unit
            line["line_amount"] = round(qty * unit, 2) if unit is not None else None
            if item and item.get("account_code"):
                line.update(account_code=item["account_code"], tax_type=item.get("tax_type") or "", source="item",
                            reason="From the Xero item " + item["code"], confidence="high")
            elif rule and rule.get("account_code"):
                line.update(account_code=rule["account_code"], tax_type=rule.get("tax_type") or "", source="rule",
                            reason="Coding rule saved for this customer", confidence="high")
            elif hist:
                line.update(account_code=hist["account_code"], tax_type=hist["tax_type"], source="history",
                            reason="Same coding as this customer's recent invoices", confidence="high")
            lines.append(line)

        uncoded = [i for i, l in enumerate(lines) if not l.get("account_code")]
        if uncoded:
            coded = api.ai.extract(
                prompt=SALES_CODE_PROMPT,
                input=json.dumps({"customer": customer, "gst_registered": bool(client.get("gst_registered")),
                                  "client_notes": client.get("notes") or "",
                                  "lines": [{"index": i, "description": lines[i]["description"], "amount": lines[i]["line_amount"]}
                                            for i in uncoded],
                                  "accounts": accounts[:300], "tax_rates": taxes})[:30000],
                schema_hint=CODE_HINT,
            )
            for c in coded if isinstance(coded, list) else []:
                if isinstance(c, dict) and isinstance(c.get("index"), (int, float)) and int(c["index"]) in uncoded:
                    lines[int(c["index"])].update(account_code=str(c.get("account_code") or ""), tax_type=str(c.get("tax_type") or ""),
                                                  source="ai", reason=str(c.get("reason") or "Suggested by AI"),
                                                  confidence=str(c.get("confidence") or "low").lower())

        for i, l in enumerate(lines):
            if l.get("account_code") and l["account_code"] not in codes:
                warnings.append("Line " + str(i + 1) + ": account " + l["account_code"] + " isn't an active revenue account in Xero.")
                l["account_code"] = ""
            if l.get("tax_type") and l["tax_type"] not in tax_types:
                l["tax_type"] = ""
            if not l.get("account_code"):
                l["confidence"] = "low"
                blocking.append("Line " + str(i + 1) + " has no account code. Add one in your changes.")
            if l["line_amount"] is None:
                l["confidence"] = "low"
                blocking.append("Line " + str(i + 1) + " (" + l["description"][:60] + ") has no price. Add it in your "
                                "changes, e.g. \"line " + str(i + 1) + " unit price 180\".")
            elif l.get("price_source") and l["price_source"] != "request":
                l["reason"] = str(l.get("reason") or "") + ". Price from " + l["price_source"]

        priced = [l for l in lines if l["line_amount"] is not None]
        subtotal = round(sum(l["line_amount"] for l in priced), 2)
        tax = round(sum(l["line_amount"] * rates.get(l.get("tax_type") or "", 0) / 100 for l in priced), 2)
        date = str(asked.get("invoice_date") or bk_today(settings))[:10]
        due = str(asked.get("due_date") or "")[:10]
        if not due:
            due, came_from = xero_default_due(tenant, contact, date, "ACCREC")
            if due:
                warnings.append("Due " + due + ", from " + came_from + ".")
        proposal = {
            "doc_type": "ACCREC",
            "origin": "request",
            "contact": {"id": (contact or {}).get("ContactID") or "", "name": (contact or {}).get("Name") or customer,
                        "abn": "", "email": email, "is_new": not contact},
            "invoice_number": "",
            "date": date,
            "due_date": due,
            "reference": str(asked.get("reference") or "")[:255],
            "currency": "",
            "line_amount_types": "Exclusive",
            "lines": lines,
            "subtotal": subtotal,
            "tax": tax,
            "total": round(subtotal + tax, 2),
            "coding_source": ",".join(sorted({str(l.get("source") or "") for l in lines if l.get("source")})),
            "notes": str(asked.get("notes") or "")[:1000],
        }
        # An existing customer gets a draft now, so the reviewer can preview it (Xero gives it its number); a new
        # customer's contact and invoice wait for approval, like a new supplier's bill.
        if contact and not blocking:
            bill_id = xero_create_bill(tenant, proposal, "DRAFT")
    except Exception as exc:
        problem = "Couldn't draft this invoice in Xero. " + str(exc)[:500]
