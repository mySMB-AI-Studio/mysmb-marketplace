# ── bookkeeping kit: payroll adapter (inlined into payroll nodes by gen-ext.js) ──
# Xero Payroll AU through xero-payroll-au (reads take xero_tenant_id, so each call lands in the client's own
# organisation) and Deputy through deputy. Read-only: the checks list corrections, the payroll officer makes them.
import csv
import io

from openpyxl import Workbook, load_workbook

BK_PAYROLL = "Bookkeeping/Payroll"
BK_PAYRUNS = "Bookkeeping/PayRuns"
BK_PAYROLL_FILES = "Bookkeeping Payroll"
PAYROLL = "xero-payroll-au"
DEPUTY = "deputy"
PAY_WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
PAY_BANDS = ["ordinary", "early", "late", "saturday", "sunday", "public_holiday", "ot_first", "ot_after"]
PAY_BAND_NAMES = {"ordinary": "ordinary", "early": "early (before start of day)", "late": "late (after end of day)",
                  "saturday": "Saturday", "sunday": "Sunday", "public_holiday": "public holiday",
                  "ot_first": "overtime (first hours)", "ot_after": "overtime (after that)"}


def pay_call(tool, tenant_id=None, **args):
    if tenant_id:
        args["xero_tenant_id"] = tenant_id
    exc = None  # bound first for the platform lint (see xero_call)
    try:
        return api.connectors.invoke(server=PAYROLL, tool=tool, args=args)
    except Exception as exc:
        raise RuntimeError("Xero Payroll: " + str(exc)[:500]) from None


def pay_rows(result, key):
    if isinstance(result, dict):
        rows = result.get(key)
        return rows if isinstance(rows, list) else []
    return result if isinstance(result, list) else []


def pay_date(value):
    """Xero Payroll dates arrive as '/Date(1759276800000+0000)/' or ISO; Deputy's as ISO or epoch seconds."""
    s = str(value or "")
    m = re.match(r"/Date\((-?\d+)", s)
    if m:
        return datetime.datetime.fromtimestamp(int(m.group(1)) / 1000, datetime.timezone.utc).date()
    try:
        return datetime.date.fromisoformat(s[:10])
    except ValueError:
        return None


def pay_xero_dt(d):
    return "DateTime(%d,%d,%d)" % (d.year, d.month, d.day)


def pay_period_end(start, kind):
    kind = str(kind or "").upper()
    if kind == "WEEKLY":
        return start + datetime.timedelta(days=6)
    if kind == "FOURWEEKLY":
        return start + datetime.timedelta(days=27)
    if kind in ("MONTHLY", "QUARTERLY"):
        months = 3 if kind == "QUARTERLY" else 1
        y, mo = start.year + (start.month - 1 + months) // 12, (start.month - 1 + months) % 12 + 1
        return datetime.date(y, mo, min(start.day, 28)) - datetime.timedelta(days=1)
    if kind == "TWICEMONTHLY":
        return start + datetime.timedelta(days=14)
    return start + datetime.timedelta(days=13)  # FORTNIGHTLY


def pay_calendar(tenant_id, name):
    """The client's pay calendar by its Xero name: {id, name, type, start, end, payment}, or None."""
    for c in pay_rows(pay_call("list_payroll_calendars", tenant_id), "PayrollCalendars"):
        if bk_norm(c.get("Name")) == bk_norm(name):
            start = pay_date(c.get("StartDate"))
            if not start:
                return None
            return {"id": c.get("PayrollCalendarID"), "name": c.get("Name"), "type": c.get("CalendarType"),
                    "start": str(start), "end": str(pay_period_end(start, c.get("CalendarType"))),
                    "payment": str(pay_date(c.get("PaymentDate")) or "")}
    return None


def pay_prep_date(payment, weekday):
    """The preparation weekday on or before the pay day."""
    target = PAY_WEEKDAYS.index(weekday) if weekday in PAY_WEEKDAYS else 0
    return payment - datetime.timedelta(days=(payment.weekday() - target) % 7)


def pay_name(e):
    return re.sub(r"\s+", " ", (str(e.get("FirstName") or "") + " " + str(e.get("LastName") or "")).strip())


def pay_employees(tenant_id, calendar_id=""):
    """Active employees (full records, one get_employee each), optionally only those on the pay calendar."""
    out = []
    for page in range(1, 11):
        rows = pay_rows(pay_call("list_employees", tenant_id, where='Status=="ACTIVE"', page=page), "Employees")
        for r in rows:
            if calendar_id and r.get("PayrollCalendarID") and r.get("PayrollCalendarID") != calendar_id:
                continue
            full = pay_rows(pay_call("get_employee", tenant_id, employeeId=r["EmployeeID"]), "Employees")
            out.append(full[0] if full else r)
        if len(rows) < 100:
            break
    return out


def pay_basis(e):
    basis = str(((e.get("TaxDeclaration") or {}).get("EmploymentBasis")) or e.get("EmploymentBasis") or "").upper()
    return {"FULLTIME": "full-time", "PARTTIME": "part-time", "CASUAL": "casual"}.get(basis, basis.lower() or "unknown")


def pay_items(tenant_id):
    items = (pay_call("list_pay_items", tenant_id) or {})
    items = items.get("PayItems", items) if isinstance(items, dict) else {}
    earnings = {r.get("EarningsRateID"): r for r in (items.get("EarningsRates") or []) if isinstance(r, dict)}
    return {"earnings": earnings}


def pay_timesheets(tenant_id, start, end):
    where = "StartDate>=%s AND EndDate<=%s" % (pay_xero_dt(start), pay_xero_dt(end))
    return pay_rows(pay_call("list_timesheets", tenant_id, where=where), "Timesheets")


def pay_draft_run(tenant_id, calendar_id, start):
    """The draft pay run for the period with its payslip summaries, or None."""
    where = 'PayrollCalendarID==Guid("%s") AND PayRunStatus=="DRAFT"' % calendar_id
    for r in pay_rows(pay_call("list_pay_runs", tenant_id, where=where), "PayRuns"):
        if pay_date(r.get("PayRunPeriodStartDate")) == start:
            full = pay_rows(pay_call("get_pay_run", tenant_id, payRunId=r["PayRunID"]), "PayRuns")
            return full[0] if full else r
    return None


def deputy_rows(tool, **args):
    out = []
    for page in range(20):
        rows = api.connectors.invoke(server=DEPUTY, tool=tool, args=dict(args, max=500, start=page * 500))
        rows = rows if isinstance(rows, list) else (rows or {}).get("data") or []
        out.extend(r for r in rows if isinstance(r, dict))
        if len(rows) < 500:
            break
    return out


def pay_band_of(name, mapping):
    """Which band a Xero earnings rate pays, from the pay guide's pay_items sheet or its name."""
    n = bk_norm(name)
    if n in mapping:
        return mapping[n]
    if "public holiday" in n or re.search(r"\bph\b", n):
        return "public_holiday"
    if "saturday" in n or re.search(r"\bsat\b", n):
        return "saturday"
    if "sunday" in n or re.search(r"\bsun\b", n):
        return "sunday"
    if "overtime" in n or re.search(r"\bot\b", n):
        return "ot_after" if ("after" in n or "thereafter" in n) else "ot_first"
    if "before 7" in n or "early" in n:
        return "early"
    if "after 6" in n or "late" in n or "evening" in n:
        return "late"
    return "ordinary"


def pay_guide(path):
    """The client's pay guide workbook as plain data, or None when there's no file. Sheets (any order, headers in row 1):
    rates (award, classification, basis, age_from, age_to, band, rate, effective_from); employees (employee, award,
    classification, state, special_rate, special_until, notes); rules (award, day_start, day_end, ot_after_hours,
    ot_first_hours); holidays (date, state, name); pay_items (pay_item, band)."""
    try:
        local = api.files.get(file=path)
    except Exception:
        return None
    book = load_workbook(local, read_only=True, data_only=True)
    guide = {"rates": [], "employees": {}, "rules": {}, "holidays": {}, "pay_items": {}}
    for ws in book.worksheets:
        rows = [list(r) for r in ws.iter_rows(values_only=True)]
        if not rows:
            continue
        head = [bk_norm(h).replace(" ", "_") for h in rows[0]]
        recs = [dict(zip(head, r)) for r in rows[1:] if any(v not in (None, "") for v in r)]
        title = bk_norm(ws.title).replace(" ", "_")
        if title == "rates":
            for r in recs:
                band = str(r.get("band") or "ordinary").strip().lower().replace(" ", "_")
                guide["rates"].append({"award": bk_norm(r.get("award")), "classification": bk_norm(r.get("classification")),
                                       "basis": bk_norm(r.get("basis")) or "casual", "age_from": bk_money(r.get("age_from")),
                                       "age_to": bk_money(r.get("age_to")), "band": band, "rate": bk_money(r.get("rate")),
                                       "effective_from": str(pay_date(r.get("effective_from")) or "")})
        elif title == "employees":
            for r in recs:
                guide["employees"][bk_norm(r.get("employee"))] = {
                    "award": bk_norm(r.get("award")), "classification": bk_norm(r.get("classification")),
                    "state": str(r.get("state") or "").strip().upper(), "special_rate": bk_money(r.get("special_rate")),
                    "special_until": str(pay_date(r.get("special_until")) or ""), "notes": str(r.get("notes") or "")}
        elif title == "rules":
            for r in recs:
                guide["rules"][bk_norm(r.get("award"))] = {
                    "day_start": str(r.get("day_start") or "07:00")[:5], "day_end": str(r.get("day_end") or "18:00")[:5],
                    "ot_after_hours": bk_money(r.get("ot_after_hours")), "ot_first_hours": bk_money(r.get("ot_first_hours")) or 0}
        elif title == "holidays":
            for r in recs:
                d = pay_date(r.get("date"))
                for st in [s.strip().upper() for s in str(r.get("state") or "ALL").split(",") if s.strip()]:
                    if d:
                        guide["holidays"].setdefault(st, []).append(str(d))
        elif title == "pay_items":
            for r in recs:
                guide["pay_items"][bk_norm(r.get("pay_item"))] = str(r.get("band") or "ordinary").strip().lower().replace(" ", "_")
    return guide


def pay_rate(guide, award, classification, basis, age, band, on_date):
    """The pay guide's rate for this employee and band on a date, or None."""
    best = None
    for r in (guide or {}).get("rates") or []:
        if r["award"] != award or r["classification"] != classification or r["band"] != band or r["rate"] is None:
            continue
        if r["basis"] not in (basis, "any"):
            continue
        if age is not None and ((r["age_from"] is not None and age < r["age_from"]) or (r["age_to"] is not None and age > r["age_to"])):
            continue
        if r["effective_from"] and r["effective_from"] > str(on_date):
            continue
        if best is None or r["effective_from"] > best["effective_from"]:
            best = r
    return best["rate"] if best else None


def pay_hm(text, default):
    m = re.match(r"(\d{1,2}):(\d{2})", str(text or ""))
    return (int(m.group(1)), int(m.group(2))) if m else default


def pay_split(start_dt, end_dt, worked_hours, rule, holidays):
    """A shift's worked hours by band: public holiday, Saturday, Sunday, else early / ordinary / late by the award's
    day start and end; then daily overtime past the award's threshold. Breaks are spread pro rata."""
    span = (end_dt - start_dt).total_seconds() / 3600
    hours = worked_hours if worked_hours is not None else span
    bands = {b: 0.0 for b in PAY_BANDS}
    if span <= 0 or hours <= 0:
        return bands
    day = start_dt.date()
    if str(day) in holidays:
        bands["public_holiday"] = hours
    elif day.weekday() == 5:
        bands["saturday"] = hours
    elif day.weekday() == 6:
        bands["sunday"] = hours
    else:
        sh, sm = pay_hm(rule.get("day_start"), (7, 0))
        eh, em = pay_hm(rule.get("day_end"), (18, 0))
        day_start = start_dt.replace(hour=sh, minute=sm, second=0, microsecond=0)
        day_end = start_dt.replace(hour=eh, minute=em, second=0, microsecond=0)
        early = max(0.0, (min(end_dt, day_start) - start_dt).total_seconds() / 3600)
        late = max(0.0, (end_dt - max(start_dt, day_end)).total_seconds() / 3600)
        scale = hours / span
        bands["early"] = round(early * scale, 4)
        bands["late"] = round(late * scale, 4)
        bands["ordinary"] = round(hours - bands["early"] - bands["late"], 4)
        limit = rule.get("ot_after_hours")
        if limit and hours > limit:
            ot = hours - limit
            first = min(ot, rule.get("ot_first_hours") or 0)
            bands["ot_first"], bands["ot_after"] = round(first, 4), round(ot - first, 4)
            for b in ("ordinary", "late", "early"):
                take = min(bands[b], ot)
                bands[b] = round(bands[b] - take, 4)
                ot -= take
    return bands


def pay_table(path):
    """Rows of a spreadsheet or CSV in Knowledge as dicts keyed by normalised header (first row that has one)."""
    local = api.files.get(file=path)
    if path.lower().endswith(".csv"):
        with open(local, encoding="utf-8-sig", errors="replace") as fh:
            rows = list(csv.reader(io.StringIO(fh.read())))
    else:
        book = load_workbook(local, read_only=True, data_only=True)
        rows = [list(r) for r in book.worksheets[0].iter_rows(values_only=True)]
    for i, r in enumerate(rows[:20]):
        head = [bk_norm(h) for h in r]
        if any(h in ("employee", "name", "employee name", "staff") for h in head) and any(
                ("amount" in h or "total" in h) for h in head):
            return [dict(zip(head, x)) for x in rows[i + 1:] if any(v not in (None, "") for v in x)]
    return []


def pay_guide_template(dest, client_name):
    """Save a pay guide workbook with the sheets the checks read, and one EXAMPLE row each, to Knowledge."""
    book = Workbook()
    sheets = {
        "rates": (["award", "classification", "basis", "age_from", "age_to", "band", "rate", "effective_from"],
                  [["EXAMPLE GRIA", "Retail Employee Level 1", "casual", 21, "", "ordinary", 33.19, "2026-07-01"],
                   ["EXAMPLE GRIA", "Retail Employee Level 1", "casual", 21, "", "saturday", 39.83, "2026-07-01"],
                   ["EXAMPLE GRIA", "Retail Employee Level 1", "casual", 16, 16, "ordinary", 16.60, "2026-07-01"]]),
        "employees": (["employee", "award", "classification", "state", "special_rate", "special_until", "notes"],
                      [["EXAMPLE Jane Citizen", "EXAMPLE GRIA", "Retail Employee Level 1", "NSW", "", "", "Driver"]]),
        "rules": (["award", "day_start", "day_end", "ot_after_hours", "ot_first_hours"],
                  [["EXAMPLE GRIA", "07:00", "18:00", 9, 3]]),
        "holidays": (["date", "state", "name"], [["2026-12-25", "ALL", "Christmas Day"]]),
        "pay_items": (["pay_item", "band"], [["EXAMPLE Casual Sat", "saturday"]]),
    }
    blank = book.active
    for title, (head, rows) in sheets.items():
        ws = book.create_sheet(title=title)
        ws.append(head)
        for r in rows:
            ws.append(r)
    if blank is not None:
        book.remove(blank)
    local = api.files.scratch_path(dest.split("/")[-1])
    book.save(local)
    api.files.put(file=dest, scratch_file=local)
    return dest


def pay_run_load(todo_id="", client_name=""):
    """(path, run) for a pay run's WorkQ item (or its review / approval item), or a client's newest open pay run."""
    if todo_id:
        link = bk_read_json(BK_PAYRUNS + "/" + todo_id + ".json") or {}
        if link.get("link"):
            path = BK_PAYRUNS + "/" + link["link"] + ".json"
            return path, bk_read_json(path) or {}
        return "", {}
    if client_name:
        slug = bk_slug(client_name)
        runs = [f for f in api.files.list(path=BK_PAYRUNS)
                if str(f.get("name") or "").startswith(slug + "-") and str(f.get("name") or "").endswith(".json")]
        for f in sorted(runs, key=lambda f: str(f.get("name")), reverse=True):
            run = bk_read_json(f["path"]) or {}
            if run.get("period_start") and run.get("status") not in ("done", "cancelled"):
                return f["path"], run
    return "", {}


def pay_link(todo_id, run):
    """Point a WorkQ item at its pay run record, so its form submissions find the pay run."""
    bk_write_json(BK_PAYRUNS + "/" + todo_id + ".json", {"link": run["slug"] + "-" + run["period_start"]})
