BK_STATEMENTS = "Bookkeeping/Statements"  # one log per client of every statement filed
XERO_CSV_HEADER = "*Date,*Amount,Payee,Description,Reference,Check Number"  # Xero's bank statement CSV template


def bank_summary(tenant_id, account, start, end):
    """The account's opening and closing balance in Xero over the period (Bank Summary report): (opening, closing),
    either None when Xero doesn't say."""
    report = xero_call("get_bank_summary", tenant_id, fromDate=str(start or end), toDate=str(end))
    reports = report.get("Reports") if isinstance(report, dict) else None
    rows = (reports[0] if reports else (report if isinstance(report, dict) else {})).get("Rows") or []
    stack = list(rows)
    while stack:
        row = stack.pop(0)
        stack.extend(row.get("Rows") or [])
        cells = row.get("Cells") or []
        if len(cells) < 2:
            continue
        ids = [att.get("Value") for c in cells for att in (c.get("Attributes") or []) if isinstance(att, dict)]
        if account.get("AccountID") in ids or bk_norm(cells[0].get("Value")) == bk_norm(account.get("Name")):
            return bk_money(cells[1].get("Value")), bk_money(cells[-1].get("Value"))
    return None, None


def csv_cell(value):
    text = re.sub(r"\s+", " ", str(value if value is not None else "")).strip()
    return '"' + text.replace('"', '""') + '"' if ("," in text or '"' in text) else text


def statement_lines(rows):
    """The statement's transactions as [(date, amount, description, reference)], or None if any line is unreadable."""
    out = []
    for r in rows or []:
        when = str(r.get("date") or "")
        amount = bk_money(r.get("amount"))
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", when) or amount is None:
            return None
        out.append((when, round(amount, 2), str(r.get("description") or "").strip(), str(r.get("reference") or "").strip()))
    return out

ctx = params.get("ctx") or {}
st = params.get("statement") or {}
path = params["path"]
settings = ctx.get("settings") or {}
client = ctx.get("client") or {}
slug = client.get("slug") or ctx.get("folder") or path.split("/")[1]
tenant = client.get("xero_tenant_id")
today = bk_today(settings)
kind = str(st.get("kind") or "").lower()
period = (str(st.get("period_start") or "") + " to " if st.get("period_start") else "") + str(st.get("period_end") or "")
closing = bk_money(st.get("closing_balance"))
problem = ""
issues = []
filed_to = ""
label = ""
outcome = ""
todo_id = ""
csv_path = ""
import_rows = []
import_notes = []

try:
    host_type, host_id = "", ""
    if kind in ("bank", "credit card", "credit_card", "card"):
        accounts = xero_rows(xero_call("list_accounts", tenant, where='Type=="BANK"'), "Accounts")
        acct = xero_match_bank(accounts, st)
        if not acct:
            problem = ("Couldn't tell which bank account in Xero this statement is for (" + " ".join(
                str(st.get(k)) for k in ("institution", "account_name", "account_number", "card_last4") if st.get(k))
                + "). Bank accounts in Xero: " + (", ".join(str(a.get("Name")) + " (" + str(a.get("BankAccountNumber") or "no number") + ")"
                                                         for a in accounts) or "none") + ".")
        else:
            host_type, host_id, label = "Accounts", acct["AccountID"], str(acct.get("Name"))
            filed_to = "bank account **" + label + "**"
            # Xero keeps a card balance owing as a negative number; the statement prints it as a positive one.
            sign = -1 if str(acct.get("BankAccountType") or "").upper() == "CREDITCARD" or kind != "bank" else 1
            opening = bk_money(st.get("opening_balance"))
            st_open = opening * sign if opening is not None else None
            st_close = closing * sign if closing is not None else None
            x_open, x_close = (bank_summary(tenant, acct, st.get("period_start"), st.get("period_end"))
                               if st.get("period_end") else (None, None))
            if x_close is None or st_close is None or abs(x_close - st_close) > 0.01:
                # Not in Xero yet (no bank feed, or not imported): turn the statement into a CSV for Xero's import.
                lines = statement_lines(st.get("lines"))
                moved = round(sum(t[1] for t in lines), 2) if lines else 0.0
                if lines and st_open is not None and st_close is not None and abs(st_open + moved - st_close) <= 0.01:
                    import_rows = lines
                    done = [e for e in (bk_read_json(BK_STATEMENTS + "/" + slug + ".json") or {}).get("statements") or []
                            if isinstance(e, dict) and e.get("import_file") and e.get("period") == period
                            and e.get("filed_to") == filed_to.replace("**", "")]
                    if done:
                        import_notes.append("**This statement already became an import file on " + str(done[-1].get("at"))[:10]
                                            + "** (`" + str(done[-1]["import_file"]) + "`). If that one was imported, don't "
                                            "import this one: just complete this item.")
                    if st.get("read_from") == "scan":
                        import_notes.append("This statement is a scan, so its transactions were read by AI from the "
                                            "image. They add up to the closing balance, but check a few dates and "
                                            "descriptions against the PDF before importing.")
                    if x_open is not None and abs(x_open - st_open) > 0.01:
                        # Bank Summary counts transactions in Xero, not imported statement lines waiting to be reconciled.
                        import_notes.append("Xero shows " + bk_fmt(x_open * sign) + " in " + label + " at the start of the period, "
                                            "but the statement opens at " + bk_fmt(opening) + ". That's expected if the previous "
                                            "statement is imported but not reconciled yet; otherwise an earlier statement may be "
                                            "missing, or some of these lines are already in Xero. Check before importing so "
                                            "nothing is doubled up.")
                else:
                    issues.append("The statement closes at " + bk_fmt(closing) + " on " + str(st.get("period_end"))
                                  + (", but " + label + " in Xero shows " + bk_fmt(x_close * sign) + " for that date"
                                     if x_close is not None else "")
                                  + ". Its transactions couldn't all be read ("
                                  + (str(len(lines)) + " lines moving " + bk_fmt(moved * sign) + ", the statement moves "
                                     + bk_fmt(round((st_close - st_open) * sign, 2))
                                     if lines and st_open is not None and st_close is not None else "no usable transaction lines")
                                  + "), so no import file was made. Import the bank's CSV or OFX export into Xero, or key "
                                  "the lines by hand.")
    elif kind in ("supplier", "customer"):
        doc_type = "ACCPAY" if kind == "supplier" else "ACCREC"
        party = str(st.get("party_name") or "").strip()
        contact = xero_find_supplier(tenant, party, st.get("party_abn")) if party else None
        if not contact:
            problem = ("This is a statement of account from " + (party or "an unnamed business") + ", but there's no matching "
                       + ("supplier" if kind == "supplier" else "customer") + " in Xero.")
        else:
            host_type, host_id, label = "Contacts", contact["ContactID"], str(contact.get("Name"))
            filed_to = "contact **" + label + "**"
            owing, known = xero_open_balance(tenant, contact["ContactID"], doc_type)
            if closing is not None and abs(owing - closing) > 0.01:
                issues.append("The statement says " + bk_fmt(closing) + " is owing, but Xero shows " + bk_fmt(owing)
                              + " open on " + ("bills from " if kind == "supplier" else "invoices to ") + label + ".")
            missing = [i for i in (st.get("invoices") or []) if isinstance(i, dict) and i.get("number")
                       and bk_norm(i["number"]) not in known]
            if missing:
                issues.append("On the statement but not in Xero: " + ", ".join(
                    str(i["number"]) + (" (" + bk_fmt(bk_money(i.get("amount"))) + ")" if i.get("amount") is not None else "")
                    for i in missing[:20]) + ("…" if len(missing) > 20 else "") + ".")
    else:
        problem = "This looks like a statement, but it isn't clear whether it's a bank statement or a statement of account."
    if host_id:
        name = re.sub(r"[^A-Za-z0-9 .()-]+", "", label + " statement " + str(st.get("period_end") or today)).strip()[:90] + ".pdf"
        err = xero_attach_file(tenant, host_type, host_id, path, name)
        if err:
            problem = "Couldn't attach the statement to " + filed_to.replace("**", "") + " in Xero: " + err
except Exception as exc:
    problem = "Couldn't file this statement in Xero: " + str(exc)[:400]

dest = (BK_FAILED if problem else BK_PROCESSED) + "/" + slug + "/" + path.split("/")[-1]
try:
    dest = bk_move(path, dest)
except Exception:
    dest = path
if import_rows and not problem:
    csv_text = XERO_CSV_HEADER + "\r\n" + "".join(
        ",".join([when[8:10] + "/" + when[5:7] + "/" + when[0:4], "%.2f" % amount, csv_cell(desc[:100]), csv_cell(desc),
                  csv_cell(ref), ""]) + "\r\n" for when, amount, desc, ref in import_rows)
    csv_name = re.sub(r"[^A-Za-z0-9 .()-]+", "", label + " " + str(st.get("period_end") or today) + " for Xero import").strip()[:90] + ".csv"
    csv_path = BK_PROCESSED + "/" + slug + "/" + csv_name
    try:
        api.files.put(file=csv_path, content=csv_text)
    except Exception:
        csv_path = ""
    if csv_path:
        try:
            xero_call("upload_attachment", tenant, hostType="Accounts", hostId=host_id, fileName=csv_name,
                      base64Content=base64.b64encode(csv_text.encode("utf-8")).decode("ascii"), mimeType="text/csv")
        except Exception:
            import_notes.append("The CSV couldn't be attached in Xero too; use the copy in Knowledge.")
    else:
        issues.append("The statement's " + str(len(import_rows)) + " transactions were read, but the import file couldn't be "
                      "saved in Knowledge. Import the bank's CSV or OFX export into Xero instead.")
log_path = BK_STATEMENTS + "/" + slug + ".json"
log = bk_read_json(log_path) or {"statements": []}
log["statements"] = (log.get("statements") or [])[-499:] + [{
    "at": bk_now_iso(settings), "file": dest, "kind": kind, "filed_to": filed_to.replace("**", ""), "period": period,
    "closing_balance": closing, "issues": issues, "problem": problem, "import_file": csv_path,
    "lines": len(import_rows)}]
bk_write_json(log_path, log)

if csv_path and not problem and not issues:
    reviewer = bk_reviewer(settings, client)
    item = api.workq.create(
        title=("Import statement into Xero: " + label + (", " + period if period else "") + " (" + str(client.get("name") or slug) + ")")[:200],
        scope="org",
        description=("**" + str(len(import_rows)) + " transactions** read from the statement, and they add up: it opens at "
                     + bk_fmt(bk_money(st.get("opening_balance"))) + " and closes at " + bk_fmt(closing) + ". The PDF is attached "
                     "to " + filed_to + " in Xero.\n\n"
                     + "".join("- " + n + "\n" for n in import_notes) + ("\n" if import_notes else "")
                     + "To get the lines into Xero:\n\n"
                     "1. Download `" + csv_path + "` from Knowledge (it's also in Xero Documents, attached to " + label + ").\n"
                     "2. In Xero go to Accounting, Bank accounts, " + label + ", the ⋮ menu, Import a Statement.\n"
                     "3. Upload the CSV. In Import settings choose the date format **dd/mm/yyyy**, then review and import.\n"
                     "4. Complete this item.\n\n"
                     "Xero only lets bank feeds add statement lines directly, so this upload stays a manual step."),
        priority="medium",
        due_date=str(bk_add_business_days(today, 2)),
        assignee_ids=[reviewer] if reviewer else None,
        labels=["bookkeeping", "statement-import", slug],
    )
    todo_id = item["id"]
    outcome = "ready_to_import"
elif problem or issues:
    owner = bk_exceptions_owner(settings, client) if problem else bk_reviewer(settings, client)
    item = api.workq.create(
        title=("Statement needs attention: " + (label or str(st.get("party_name") or st.get("account_name") or path.split("/")[-1]))
               + (", " + period if period else "") + " (" + str(client.get("name") or slug) + ")")[:200],
        scope="org",
        description=((problem + "\n\n" if problem else "Filed to " + filed_to + " in Xero.\n\n")
                     + "".join("- " + i + "\n" for i in issues)
                     + "\n- File: `" + dest + "` in Knowledge\n\n"
                     + ("Fix it in Xero (or file the statement by hand), then complete this item." if problem
                        else "Reconcile the differences in Xero, then complete this item.")),
        priority="high" if problem else "medium",
        due_date=str(bk_add_business_days(today, 2)),
        assignee_ids=[owner] if owner else None,
        labels=["bookkeeping", "bill-exception" if problem else "statement-check", slug],
    )
    todo_id = item["id"]
    outcome = "exception" if problem else "filed_with_issues"
else:
    outcome = "filed"
