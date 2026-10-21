provider = params["provider"]
problem = params.get("problem") or ""
ctx = params.get("ctx") or {}
findings = {}

if not problem:
    try:
        settings = ctx.get("settings") or {}
        client = ctx.get("client") or {}
        ps = ctx.get("payroll") or {}
        run = ctx.get("run") or {}
        tenant = client["xero_tenant_id"]
        start = datetime.date.fromisoformat(run["period_start"])
        end = datetime.date.fromisoformat(run["period_end"])
        tz = bk_tz(settings)
        notes = []

        guide = pay_guide(BK_PAYROLL_FILES + "/" + run["slug"] + "/pay-guide.xlsx")
        if not guide:
            notes.append("There's no pay guide in `" + BK_PAYROLL_FILES + "/" + run["slug"] + "/pay-guide.xlsx`, so rates and "
                         "penalty bands weren't checked.")
        mapping = (guide or {}).get("pay_items") or {}
        pay_types = pay_items(tenant)
        items = pay_types["earnings"]
        calendar_id = (run.get("calendar") or {}).get("id") or ""

        # ── Who is on this pay calendar ──
        people = {}
        roster = pay_employees(tenant, calendar_id)
        for e in roster:
            name = pay_name(e)
            key = bk_norm(name)
            dob = pay_date(e.get("DateOfBirth"))
            age = (end.year - dob.year - ((end.month, end.day) < (dob.month, dob.day))) if dob else None
            g = ((guide or {}).get("employees") or {}).get(key) or {}
            template = {}
            for line in ((e.get("PayTemplate") or {}).get("EarningsLines") or []):
                if line.get("EarningsRateID") and bk_money(line.get("RatePerUnit")) is not None:
                    template[line["EarningsRateID"]] = bk_money(line.get("RatePerUnit"))
            people[key] = {"id": e.get("EmployeeID"), "name": name, "basis": pay_basis(e), "dob": dob, "age": age,
                           "ordinary_id": e.get("OrdinaryEarningsRateID") or "",
                           "state": g.get("state") or str(((e.get("HomeAddress") or {}).get("Region")) or "").upper(),
                           "award": g.get("award") or "", "classification": g.get("classification") or "",
                           "special_rate": g.get("special_rate"), "special_until": g.get("special_until") or "",
                           "in_guide": bool(g), "template": template, "xero_days": {}, "xero_bands": {}, "xero_rates": {},
                           "deputy_days": {}, "deputy_bands": {}, "shifts": 0}
        by_id = {p["id"]: p for p in people.values()}

        # ── Hours in Xero Payroll, by day and by band ──
        for t in pay_timesheets(tenant, start, end):
            p = by_id.get(t.get("EmployeeID"))
            if not p:
                continue
            t_start = pay_date(t.get("StartDate")) or start
            for line in t.get("TimesheetLines") or []:
                er = items.get(line.get("EarningsRateID")) or {}
                band = pay_band_of(er.get("Name"), mapping)
                rate = p["template"].get(line.get("EarningsRateID"))
                if rate is None:
                    rate = bk_money(er.get("RatePerUnit"))
                for i, units in enumerate(line.get("NumberOfUnits") or []):
                    u = bk_money(units) or 0
                    if not u:
                        continue
                    d = str(t_start + datetime.timedelta(days=i))
                    p["xero_days"][d] = round(p["xero_days"].get(d, 0) + u, 4)
                    p["xero_bands"][band] = round(p["xero_bands"].get(band, 0) + u, 4)
                    if rate is not None:
                        p["xero_rates"][band] = rate

        # ── Hours in Deputy ──
        deputy_on = provider == "deputy" and ps.get("timesheets") == "deputy"
        missing_starters = []
        if ps.get("timesheets") == "deputy" and provider != "deputy":
            notes.append("This client's hours come from Deputy, but this is the version of the check without Deputy. "
                         "Publish *Check pay run (Xero Payroll + Deputy)* to compare Deputy with Xero.")
        if deputy_on:
            staff = {r.get("Id"): r for r in deputy_rows("list_employees")}
            for ts in deputy_rows("list_timesheets", date_from=str(start), date_to=str(end)):
                de = staff.get(ts.get("Employee")) or {}
                dname = str(de.get("DisplayName") or (str(de.get("FirstName") or "") + " " + str(de.get("LastName") or ""))).strip()
                hours = bk_money(ts.get("TotalTime")) or 0
                p = people.get(bk_norm(dname))
                if not p:
                    if hours and dname not in missing_starters:
                        missing_starters.append(dname)
                    continue
                st, en = ts.get("StartTime"), ts.get("EndTime")
                sdt = datetime.datetime.fromtimestamp(int(st), tz) if isinstance(st, (int, float)) else None
                edt = datetime.datetime.fromtimestamp(int(en), tz) if isinstance(en, (int, float)) else None
                d = str(sdt.date()) if sdt else str(pay_date(ts.get("Date")) or "")
                p["deputy_days"][d] = round(p["deputy_days"].get(d, 0) + hours, 4)
                if sdt and edt and guide:
                    rule = guide["rules"].get(p["award"]) or {}
                    holidays = set((guide["holidays"].get(p["state"]) or []) + (guide["holidays"].get("ALL") or []))
                    for band, v in pay_split(sdt, edt, hours, rule, holidays).items():
                        if v:
                            p["deputy_bands"][band] = round(p["deputy_bands"].get(band, 0) + v, 4)
                    p["shifts"] += 1

        hours_diff, salaried, bands_diff, rates_diff, unclassified, changes = [], [], [], [], [], []
        for p in sorted(people.values(), key=lambda x: x["name"]):
            worked = sum(p["xero_days"].values()) + sum(p["deputy_days"].values())
            if p["basis"] == "full-time" and p["xero_days"]:
                salaried.append({"name": p["name"], "hours": round(sum(p["xero_days"].values()), 2)})
            if deputy_on and p["basis"] != "full-time":
                for d in sorted(set(p["xero_days"]) | set(p["deputy_days"])):
                    a, b = p["deputy_days"].get(d, 0), p["xero_days"].get(d, 0)
                    if abs(a - b) > 0.02:
                        hours_diff.append({"name": p["name"], "date": d, "deputy": round(a, 2), "xero": round(b, 2)})
            if p["basis"] in ("casual", "part-time") and worked and guide and not p["in_guide"]:
                unclassified.append(p["name"])
            # A special arrangement in effect for any part of the period still sets the rate; the change note covers the switch.
            special = p["special_rate"] is not None and (not p["special_until"] or p["special_until"] >= str(start))
            if guide and p["in_guide"] and p["basis"] in ("casual", "part-time"):
                if p["shifts"]:
                    for band in PAY_BANDS:
                        a, b = p["deputy_bands"].get(band, 0), p["xero_bands"].get(band, 0)
                        if abs(a - b) > 0.05:
                            bands_diff.append({"name": p["name"], "band": band, "expected": round(a, 2), "xero": round(b, 2)})
                for band in PAY_BANDS:
                    if not (p["xero_bands"].get(band) or p["deputy_bands"].get(band)):
                        continue
                    want = p["special_rate"] if special else pay_rate(guide, p["award"], p["classification"], p["basis"],
                                                                     p["age"], band, end)
                    have = p["xero_rates"].get(band)
                    if have is None and band == "ordinary":
                        have = p["template"].get(p["ordinary_id"])
                    if want is None:
                        rates_diff.append({"name": p["name"], "band": band, "expected": None, "xero": have,
                                           "note": "no rate in the pay guide for " + p["award"] + " / " + p["classification"]})
                    elif have is not None and abs(want - have) > 0.005:
                        rates_diff.append({"name": p["name"], "band": band, "expected": want, "xero": have,
                                           "note": "special arrangement" if special else ""})
            # Upcoming changes in this period
            if p["dob"] and p["age"] is not None and p["age"] <= 21:
                for year in (start.year, end.year):
                    try:
                        bday = p["dob"].replace(year=year)
                    except ValueError:
                        bday = datetime.date(year, 3, 1)
                    if start <= bday <= end:
                        # CHK-163. The birthday itself isn't shown (it's their date of birth); Xero Payroll has it.
                        changes.append({"name": p["name"], "check": "CHK-163", "text": "turns " + str(year - p["dob"].year)
                                        + " during this pay period: check the junior rate from their birthday"})
                        break
            if p["special_until"] and str(start) <= p["special_until"] <= str(end):
                changes.append({"name": p["name"], "text": "special arrangement ends " + p["special_until"]
                                + ": move them to the award rate and penalties from that day"})
            elif p["special_until"] and p["special_until"] < str(start) and p["special_rate"] is not None and \
                    p["special_rate"] in p["xero_rates"].values():
                changes.append({"name": p["name"], "text": "special arrangement ended " + p["special_until"]
                                + " but Xero still pays the special rate"})
        for year in (start.year, end.year):
            july = datetime.date(year, 7, 1)
            if start <= july <= end:
                changes.append({"name": "Everyone on an award", "text": "award rates rise from 1 July: check the new pay "
                                "items are in Xero, the old ones archived, and the pay guide has the new rates"})
                break

        # ── Draft pay run and reimbursements ──
        draft = pay_draft_run(tenant, calendar_id, start)
        totals = {}
        slips = {}
        if draft:
            totals = {k: bk_money(draft.get(k)) for k in ("Wages", "Tax", "Super", "Deductions", "Reimbursement", "NetPay")}
            for s in draft.get("Payslips") or []:
                slips[bk_norm(pay_name(s))] = s
        else:
            notes.append("There's no draft pay run in Xero Payroll for " + run["period_start"] + " yet, so pay run totals and "
                         "reimbursements weren't compared.")
        reimburse = []
        files = [f for f in api.files.list(path=BK_PAYROLL_FILES + "/" + run["slug"])
                 if re.search(r"expense|reimburs", str(f.get("name") or ""), re.I)
                 and str(f.get("name") or "").lower().endswith((".xlsx", ".csv"))]
        if files:
            newest = sorted(files, key=lambda f: str(f.get("modifiedAt") or ""))[-1]
            owed = {}
            for row in pay_table(newest["path"]):
                who = next((row[k] for k in ("employee", "employee name", "name", "staff") if row.get(k)), None)
                amount_key = next((k for k in row if "total" in k), None) or next((k for k in row if "amount" in k), None)
                amount = bk_money(row.get(amount_key)) if amount_key else None
                if who and amount is not None and bk_norm(who) not in ("total", "grand total"):
                    owed[bk_norm(who)] = (str(who), round(owed.get(bk_norm(who), ("", 0))[1] + amount, 2))
            for key, (who, amount) in sorted(owed.items()):
                paid = bk_money((slips.get(key) or {}).get("Reimbursements")) if draft else None
                if draft and abs((paid or 0) - amount) > 0.01:
                    reimburse.append({"name": who, "file": amount, "pay_run": paid or 0})
            notes.append("Reimbursements checked against `" + newest["path"] + "` (" + str(len(owed)) + " employees).")

        # ── The checks catalogue's payroll checks: employee records, this pay run's payslips and the pay items ──
        today = bk_today(settings)
        payslips = {}
        for s in (draft or {}).get("Payslips") or []:
            if s.get("PayslipID") and s.get("EmployeeID"):
                payslips[str(s["EmployeeID"])] = pay_payslip(tenant, s["PayslipID"])
        catalogue = pay_catalogue_checks(roster, pay_terminated(tenant, calendar_id, today), items, pay_types["leave"], draft,
                                         payslips, start, end, today)
        # CHK-157 (covers CHK-158): super owed on the payroll's super liability account past its due date. The balance is
        # the ledger's, so it reads the Xero accounting connection; without it, a note says super owed wasn't checked.
        exc = None
        try:
            accounts = ((pay_call("get_payroll_settings", tenant) or {}).get("Settings") or {}).get("Accounts") or []
            liability = next((a for a in accounts if str(a.get("Type") or "") == "SUPERANNUATIONLIABILITY" and a.get("AccountID")), None)
            if liability:
                owed = -(xero_balances(tenant, today).get(str(liability["AccountID"])) or 0.0)
                posted = pay_rows(pay_call("list_pay_runs", tenant, where='PayRunStatus=="POSTED"'), "PayRuns")
                overdue, pending = pay_super_overdue(owed, posted, today)
                if overdue > 1:
                    label = (str(liability.get("Code") or "") + " " + str(liability.get("Name") or "")).strip()
                    catalogue.insert(0, pay_finding("CHK-157", "", pay_money(overdue) + " of super on " + label + " is past its due "
                                                    "date (from 1 July 2026 super has to reach the fund within 7 business days of "
                                                    "pay day; before that, 28 days after the quarter)"
                                                    + (", besides " + pay_money(pending) + " from recent pay runs not due yet" if pending else "")
                                                    + ". Pay it, or record the payment in Xero if it's been paid.", amount=overdue))
            else:
                notes.append("Super owed wasn't checked: Xero Payroll's settings name no super liability account.")
        except Exception as exc:
            notes.append("Super owed wasn't checked (" + str(exc)[:200] + ").")

        findings = {
            "period": run["period_start"] + " to " + run["period_end"], "employees": len(people), "deputy": deputy_on,
            "missing_starters": missing_starters, "salaried_timesheets": salaried, "hours": hours_diff,
            "bands": bands_diff, "rates": rates_diff, "unclassified": unclassified, "changes": changes,
            "reimbursements": reimburse, "totals": totals, "draft_pay_run": bool(draft), "notes": notes,
            "catalogue": catalogue,
        }
    except Exception as exc:
        problem = "The checks couldn't finish: " + str(exc)[:500]
