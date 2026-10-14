CODE_PROMPT = (
    "You code supplier bill lines for an Australian bookkeeper. For each line, pick the best account code from "
    "'accounts' and the tax type from 'tax_rates' (GST on expenses for taxable purchases when the business is GST "
    "registered, GST-free or BAS-excluded otherwise). Use the client's coding notes when they apply. Only use codes "
    "that appear in the lists. Give a one-sentence reason and a confidence of high, medium or low for each line."
)
SALES_CODE_PROMPT = (
    "You code sales invoice lines for an Australian bookkeeper: the client issued this invoice to its customer. For "
    "each line, pick the best revenue account code from 'accounts' and the tax type from 'tax_rates' (GST on income "
    "for taxable sales when the business is GST registered, GST-free income or BAS-excluded otherwise). Use the "
    "client's coding notes when they apply. Only use codes that appear in the lists. Give a one-sentence reason and a "
    "confidence of high, medium or low for each line."
)
CODE_HINT = '[{"index": 0, "account_code": "400", "tax_type": "INPUT", "reason": "", "confidence": "high"}]'

problem = params.get("problem") or ""
ctx = params.get("ctx") or {}
inv = params.get("invoice") or {}
proposal = {}
warnings = []
blocking = []
confidence = "low"

if not problem:
    try:
        settings = ctx.get("settings") or {}
        client = ctx.get("client") or {}
        tenant = client["xero_tenant_id"]
        issuer = str(inv.get("supplier_name") or "").strip()
        issuer_abn = re.sub(r"\D", "", str(inv.get("supplier_abn") or ""))
        bill_to = str(inv.get("bill_to") or "").strip()
        bill_to_abn = re.sub(r"\D", "", str(inv.get("bill_to_abn") or ""))

        # ── Direction: a bill is addressed to the client; a sales invoice is issued by it ──
        ident = xero_org_identity(tenant)
        own_names = [n for n in (bk_norm(x) for x in [client.get("name"), client.get("xero_org_name")] + ident["names"]) if n]
        own_abn = ident["abn"]
        issued_by_client = bool(own_abn and issuer_abn == own_abn) or any(
            bk_norm(issuer) == n or (len(n) > 3 and bk_norm(issuer) and (n in bk_norm(issuer) or bk_norm(issuer) in n))
            for n in own_names)
        addressed_to_client = bool(own_abn and bill_to_abn == own_abn) or any(
            bk_norm(bill_to) == n or (len(n) > 3 and bk_norm(bill_to) and (n in bk_norm(bill_to) or bk_norm(bill_to) in n))
            for n in own_names)
        doc_type = "ACCREC" if issued_by_client and not addressed_to_client else "ACCPAY"
        sales = doc_type == "ACCREC"
        # Plenty of bills print no "Bill to"; only a named addressee that isn't the client is worth a warning.
        if bill_to and not issued_by_client and not addressed_to_client:
            warnings.append("This document is from " + (issuer or "an unknown business") + " to " + (bill_to or "an unknown "
                            "business") + ", and neither looks like " + str(client.get("name") or "this client")
                            + ". It was treated as a bill; reject it if it doesn't belong to this client.")
        # The counterparty: the supplier on a bill, the customer on a sales invoice.
        supplier = (bill_to if sales else issuer)
        abn = bill_to_abn if sales else issuer_abn
        party = "customer" if sales else "supplier"
        inclusive = bool(inv.get("amounts_include_tax"))
        subtotal = bk_money(inv.get("subtotal"))
        tax = bk_money(inv.get("tax_total"))
        total = bk_money(inv.get("total"))
        currency = str(inv.get("currency") or "").upper()[:3]

        lines = []
        for ln in inv.get("lines") or []:
            qty = bk_money(ln.get("quantity")) or 1
            unit = bk_money(ln.get("unit_amount"))
            amount = bk_money(ln.get("line_amount"))
            if amount is None and unit is not None:
                amount = round(qty * unit, 2)
            if amount is None:
                continue
            lines.append({"description": str(ln.get("description") or supplier)[:400], "quantity": qty,
                          "unit_amount": unit, "line_amount": amount})
        if not lines:
            base = total if inclusive else (subtotal if subtotal is not None else total)
            if base is not None:
                lines.append({"description": (supplier + " " + str(inv.get("invoice_number") or "")).strip(),
                              "quantity": 1, "unit_amount": base, "line_amount": base})
                warnings.append("No line items were found, so the bill has one line for the whole amount.")

        # ── Checks ──
        if total is None:
            blocking.append("No total was found on the invoice.")
        if not inv.get("issue_date"):
            blocking.append("No invoice date was found.")
        if not inv.get("invoice_number"):
            warnings.append("No invoice number was found.")
        line_sum = round(sum(l["line_amount"] for l in lines), 2)
        expected = total if inclusive else (subtotal if subtotal is not None else
                                            (total - (tax or 0) if total is not None else None))
        if expected is not None and lines and abs(line_sum - expected) > 0.05:
            warnings.append("The lines add up to " + bk_fmt(line_sum) + " but the invoice says " + bk_fmt(expected) + ".")
        if subtotal is not None and tax is not None and total is not None and abs(subtotal + tax - total) > 0.05:
            warnings.append("Subtotal plus GST doesn't equal the total.")
        if client.get("gst_registered") and tax and subtotal and abs(tax - subtotal / 10) > max(0.05, subtotal * 0.002):
            warnings.append("GST isn't 10% of the subtotal, so some lines may be GST-free. Check the tax codes.")
        if issuer_abn and not bk_abn_valid(issuer_abn):
            warnings.append("The ABN on the invoice (" + issuer_abn + ") fails the ABN check.")
        if not issuer_abn and total and total > BK_GST_INVOICE_LIMIT:
            warnings.append("There's no ABN on this invoice.")
        if inv.get("paid_mark") or inv.get("paid") or (bk_money(inv.get("amount_due")) == 0 and total
                                                       and inv.get("amount_due") is not None):
            warnings.append("This invoice looks paid already" + (" (the PDF says \"" + str(inv["paid_mark"])[:60] + "\")"
                                                                 if inv.get("paid_mark") else "")
                            + ". Match the payment in bank reconciliation, so it isn't recorded twice.")
        for key, level in (inv.get("confidence") or {}).items():
            if str(level).lower() == "low":
                warnings.append("The AI wasn't sure about the " + str(key).replace("_", " ") + ". Check it against the PDF.")
        if inv.get("read_from") == "scan":
            warnings.append("This was read by AI from a scan or a photo: check the supplier, invoice number, dates and "
                            "amounts against the PDF.")

        # ── Supplier and duplicates ──
        contact = xero_find_supplier(tenant, supplier, abn)
        dups = xero_duplicates(tenant, (contact or {}).get("ContactID"), inv.get("invoice_number"), doc_type)
        if dups and sales:
            problem = ("Duplicate: sales invoice " + str(inv.get("invoice_number")) + " is already in Xero ("
                       + str(dups[0].get("Status")) + ", to " + str((dups[0].get("Contact") or {}).get("Name") or "a customer")
                       + "). Nothing was posted.")
        elif dups:
            problem = ("Duplicate: bill " + str(inv.get("invoice_number")) + " from " + str((contact or {}).get("Name"))
                       + " is already in Xero (" + str(dups[0].get("Status")) + "). Nothing was posted.")
        if not contact:
            warnings.append("New " + party + ": \"" + supplier + "\" isn't in Xero yet. The contact is created when you approve.")

        # ── Intake checks from the checks catalogue: warnings only, never blocks (the AI can misread a PDF) ──
        intake = bk_read_json(BK_CHECKS + "/" + client["slug"] + "-intake.json") or {}
        file_hash = ""
        try:
            with open(api.files.get(file=params["path"]), "rb") as fh:
                file_hash = hashlib.sha256(fh.read()).hexdigest()
        except Exception:
            file_hash = ""
        seen = (intake.get("files") or {}).get(file_hash) if file_hash else None
        if seen:
            warnings.append("This exact file was processed before (" + str(seen.get("date") or "earlier") + ", "
                            + str(seen.get("number") or "no invoice number") + "). Check it isn't a duplicate. [CHK-130]")
        printed = {d for d in (re.sub(r"\D", "", str(a or "")) for a in list(inv.get("abns_printed") or []) + [issuer_abn])
                   if len(d) == 11}
        pdf_abns = sorted(printed - {own_abn, bill_to_abn})
        contact_abn = re.sub(r"\D", "", str((contact or {}).get("TaxNumber") or ""))
        contact_key = (contact or {}).get("ContactID") or ("name:" + bk_norm(supplier))
        if not sales:
            if len(pdf_abns) > 1:
                warnings.append("The PDF shows more than one ABN (" + ", ".join(pdf_abns) + "). Check which business issued "
                                "it and that the supplier is right. [CHK-091]")
            if contact and issuer_abn and contact_abn and issuer_abn != contact_abn:
                warnings.append("The ABN on the PDF (" + issuer_abn + ") isn't the ABN on " + str(contact.get("Name"))
                                + " in Xero (" + contact_abn + "). Check it's the same business before approving. [CHK-089]")
            earlier = [a for a in ((intake.get("abns") or {}).get(contact_key) or []) if a]
            if issuer_abn and earlier and issuer_abn not in earlier:
                warnings.append("Earlier bills from " + supplier + " showed ABN " + ", ".join(earlier[-2:]) + "; this one shows "
                                + issuer_abn + ". [CHK-090]")
            pay = re.sub(r"\D", "", str(inv.get("pay_bsb") or "")) + re.sub(r"\D", "", str(inv.get("pay_account") or ""))
            pay_acct = re.sub(r"\D", "", str(inv.get("pay_account") or ""))
            on_file = re.sub(r"\D", "", str((contact or {}).get("BankAccountDetails") or ""))
            if pay_acct and contact and on_file and pay != on_file and not on_file.endswith(pay_acct):
                # No digits in the warning: bank details are never stored outside Xero and the PDF.
                warnings.append("The bank details on the PDF aren't the ones on " + str(contact.get("Name")) + " in Xero. "
                                "Confirm them with the supplier on a phone number you already have before paying. [CHK-020]")
            if pay_acct and not contact:
                warnings.append("New supplier with bank details only on the invoice. "
                                "Confirm them with the supplier on a phone number from another source before the first "
                                "payment. [CHK-060]")

        # ── Coding: rule, then history, then AI ──
        if not problem:
            accounts, taxes = xero_chart(tenant, doc_type)
            codes = {a["code"] for a in accounts}
            tax_types = {t["type"] for t in taxes}
            rules = (ctx.get("rules") or {}).get("customers" if sales else "suppliers") or {}
            rule = (rules.get(contact.get("ContactID")) if contact else None) or rules.get("name:" + bk_norm(supplier))
            source = ""
            if rule and rule.get("account_code"):
                source = "rule"
                for l in lines:
                    l.update(account_code=rule["account_code"], tax_type=rule.get("tax_type") or "",
                             reason="Coding rule saved for this " + party, confidence="high")
            else:
                hist = xero_history_coding(tenant, contact.get("ContactID"), doc_type) if contact else None
                if hist:
                    source = "history"
                    for l in lines:
                        l.update(account_code=hist["account_code"], tax_type=hist["tax_type"],
                                 reason=("Same coding as this customer's recent invoices" if sales
                                         else "Same coding as this supplier's recent bills"), confidence="high")
                else:
                    source = "ai"
                    coded = api.ai.extract(
                        prompt=SALES_CODE_PROMPT if sales else CODE_PROMPT,
                        input=json.dumps({
                            ("customer" if sales else "supplier"): supplier,
                            "gst_registered": bool(client.get("gst_registered")),
                            "client_notes": client.get("notes") or "",
                            "lines": [{"index": i, "description": l["description"], "amount": l["line_amount"]}
                                      for i, l in enumerate(lines)],
                            "accounts": accounts[:300],
                            "tax_rates": taxes,
                        })[:30000],
                        schema_hint=CODE_HINT,
                    )
                    by_index = {}
                    for c in coded if isinstance(coded, list) else []:
                        if isinstance(c, dict) and isinstance(c.get("index"), (int, float)):
                            by_index[int(c["index"])] = c
                    for i, l in enumerate(lines):
                        c = by_index.get(i) or {}
                        l.update(account_code=str(c.get("account_code") or ""), tax_type=str(c.get("tax_type") or ""),
                                 reason=str(c.get("reason") or "Suggested by AI"),
                                 confidence=str(c.get("confidence") or "low").lower())
            for i, l in enumerate(lines):
                l["source"] = source
                if l.get("account_code") and l["account_code"] not in codes:
                    warnings.append("Line " + str(i + 1) + ": account " + l["account_code"] + " isn't an active "
                                    + ("revenue" if sales else "expense") + " account in Xero.")
                    l["account_code"] = ""
                if l.get("tax_type") and l["tax_type"] not in tax_types:
                    warnings.append("Line " + str(i + 1) + ": tax type " + l["tax_type"] + " isn't available in Xero.")
                    l["tax_type"] = ""
                if not l.get("account_code"):
                    l["confidence"] = "low"
                    blocking.append("Line " + str(i + 1) + " has no account code. Add one in your changes.")

            rate_of = {t["type"]: bk_money(t.get("rate")) or 0 for t in taxes}
            with_tax_type = [l for l in lines if l.get("tax_type")]
            if with_tax_type and tax and tax > 0.05 and not sales and client.get("gst_registered") and all(
                    rate_of.get(l["tax_type"], 0) == 0 for l in with_tax_type):
                warnings.append("The PDF shows " + bk_fmt(tax) + " GST, but every line is coded without GST, so it "
                                "wouldn't be claimed. [CHK-092]")
            if with_tax_type and not tax and any(rate_of.get(l["tax_type"], 0) > 0 for l in with_tax_type):
                warnings.append("The PDF shows no GST, but some lines are coded with GST. Check the tax codes. [CHK-124]")

            levels = [str(l.get("confidence") or "low") for l in lines]
            levels += [str(v).lower() for v in (inv.get("confidence") or {}).values()]
            confidence = "low" if "low" in levels else ("medium" if "medium" in levels else "high")
            proposal = {
                "doc_type": doc_type,
                "contact": {"id": (contact or {}).get("ContactID") or "", "name": (contact or {}).get("Name") or supplier,
                            "abn": abn, "is_new": not contact},
                "invoice_number": str(inv.get("invoice_number") or ""),
                "date": inv.get("issue_date") or "",
                "due_date": inv.get("due_date") or "",
                "reference": str(inv.get("reference") or "")[:255],
                "currency": currency,
                "line_amount_types": "Inclusive" if inclusive else "Exclusive",
                "lines": lines,
                "subtotal": subtotal,
                "tax": tax,
                "total": total,
                "coding_source": source,
                # What the intake checks need to remember once the bill is through (route_review saves it).
                "intake": {"file_hash": file_hash, "abn": issuer_abn if not sales else "", "contact_key": contact_key},
            }
            if not proposal["due_date"] and proposal["date"]:
                due, came_from = xero_default_due(tenant, contact, proposal["date"], doc_type)
                if due:
                    proposal["due_date"] = due
                    warnings.append("There's no due date on the invoice, so it's set to " + due + " from " + came_from
                                    + ". Change it in your review if that's wrong.")
    except Exception as exc:
        problem = "Couldn't check or code this bill in Xero: " + str(exc)[:400]
