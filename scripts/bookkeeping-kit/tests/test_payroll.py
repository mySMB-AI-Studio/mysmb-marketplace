"""Payroll phase 1: open the pay run, check it (Deputy vs Xero Payroll, rates, penalties, changes, reimbursements),
build the review pack, internal review, client approval. Nothing is ever written to Xero Payroll."""
import datetime
import io
import json
import unittest
from zoneinfo import ZoneInfo

from openpyxl import Workbook, load_workbook

from harness import run_flow, xero_ms_date
from test_flows import AUTOS, BOOKKEEPER, T_ACME, Base, source_id

try:
    SYD = ZoneInfo("Australia/Sydney")
except Exception:  # no tz database here: the kit falls back to UTC+10 the same way (bk_tz)
    SYD = datetime.timezone(datetime.timedelta(hours=10))


def at(day, hh, mm):
    """A run time on the client's clock, as the scheduler would pass it."""
    return datetime.datetime(day.year, day.month, day.day, hh, mm, tzinfo=SYD).isoformat()


PREP = datetime.date(2026, 10, 5)
START, END, PAY = datetime.date(2026, 9, 21), datetime.date(2026, 10, 4), datetime.date(2026, 10, 6)
CHECK = "Bookkeeping: Check pay run (Xero Payroll + Deputy)"
CHECK_XERO = "Bookkeeping: Check pay run (Xero Payroll)"
PACK = "Bookkeeping: Build payroll review pack (Xero Payroll)"
REVIEW = "Bookkeeping: Apply payroll review"
STARTRUNS = "Bookkeeping: Start pay runs (Xero Payroll)"
OFFICER = {"id": "user-officer", "label": "Pat Officer"}
SAM = {"id": "user-sam", "label": "Sam Reviewer"}


def epoch(day, hh, mm):
    return int(datetime.datetime(day.year, day.month, day.day, hh, mm, tzinfo=SYD).timestamp())


def workbook_bytes(sheets):
    book = Workbook()
    blank = book.active
    for title, rows in sheets.items():
        ws = book.create_sheet(title=title)
        for r in rows:
            ws.append(r)
    book.remove(blank)
    buf = io.BytesIO()
    book.save(buf)
    return buf.getvalue()


PAY_GUIDE = {
    "rates": [["award", "classification", "basis", "age_from", "age_to", "band", "rate", "effective_from"],
              ["GRIA", "Level 1", "casual", 18, None, "ordinary", 30.00, "2026-07-01"],
              ["GRIA", "Level 1", "casual", 18, None, "saturday", 36.00, "2026-07-01"],
              ["GRIA", "Level 1", "casual", 18, None, "early", 33.00, "2026-07-01"],
              ["GRIA", "Level 1", "casual", 16, 17, "ordinary", 24.00, "2026-07-01"]],
    "employees": [["employee", "award", "classification", "state", "special_rate", "special_until", "notes"],
                  ["Casey Casual", "GRIA", "Level 1", "NSW", None, None, ""],
                  ["Sam Special", "GRIA", "Level 1", "NSW", 35.00, "2026-09-28", "Flat rate until 28 Sep"]],
    "rules": [["award", "day_start", "day_end", "ot_after_hours", "ot_first_hours"], ["GRIA", "07:00", "18:00", 9, 3]],
    "holidays": [["date", "state", "name"]],
    "pay_items": [["pay_item", "band"], ["Casual Ordinary Hours", "ordinary"], ["Casual Saturday", "saturday"],
                  ["Casual before 7am", "early"]],
}


class PayrollTests(Base):
    def setUp(self):
        super().setUp()
        self.setup_practice()
        run_flow(self.w, AUTOS["Bookkeeping: Start payroll setup"], {"kind": "manual", "actor_user_id": BOOKKEEPER},
                 {"payroll_names": "Acme Plumbing"})
        item = next(i for i in self.w.items.values() if i["title"] == "Payroll settings for Acme Plumbing")
        self.settings_item = item
        self.submit("Bookkeeping: Apply payroll settings", "Client payroll settings", item["id"], {
            "q_client_name": "Acme Plumbing", "q_calendar": "Fortnightly", "q_prep_day": "Monday", "q_prep_time": "09:00",
            "q_states": "NSW", "q_timesheets": "Deputy (the client exports them to Xero)", "q_ts_owner": "Robin",
            "q_ts_email": "robin@acme.example", "q_chase_after": "60", "q_officer": OFFICER, "q_reviewer": SAM,
            "q_approvers": "Robin and Jordan (owners@acme.example)", "q_who_posts": "The client"})
        self.seed_payroll()

    def seed_payroll(self, with_timesheets=True):
        o = self.w.payroll.org(T_ACME)
        o["calendars"] = [{"PayrollCalendarID": "CAL1", "Name": "Fortnightly", "CalendarType": "FORTNIGHTLY",
                           "StartDate": xero_ms_date(START), "PaymentDate": xero_ms_date(PAY)}]
        o["earnings"] = [{"EarningsRateID": "ORD", "Name": "Casual Ordinary Hours", "RatePerUnit": 30.0},
                         {"EarningsRateID": "SAT", "Name": "Casual Saturday", "RatePerUnit": 36.0},
                         {"EarningsRateID": "EARLY", "Name": "Casual before 7am", "RatePerUnit": 33.0}]

        def emp(eid, first, last, basis, dob, rate=None):
            e = {"EmployeeID": eid, "FirstName": first, "LastName": last, "Status": "ACTIVE", "PayrollCalendarID": "CAL1",
                 "DateOfBirth": xero_ms_date(dob), "TaxDeclaration": {"EmploymentBasis": basis},
                 "OrdinaryEarningsRateID": "ORD", "HomeAddress": {"Region": "NSW"}}
            if rate is not None:
                e["PayTemplate"] = {"EarningsLines": [{"EarningsRateID": "ORD", "RatePerUnit": rate}]}
            return e
        o["employees"] = [emp("E1", "Casey", "Casual", "CASUAL", datetime.date(2008, 9, 25), 30.0),
                          emp("E2", "Fran", "Fulltime", "FULLTIME", datetime.date(1985, 1, 1)),
                          emp("E3", "Sam", "Special", "CASUAL", datetime.date(1990, 5, 5), 35.0)]

        def sheet(eid, units):
            return {"TimesheetID": "T" + eid, "EmployeeID": eid, "StartDate": xero_ms_date(START), "EndDate": xero_ms_date(END),
                    "Status": "DRAFT", "TimesheetLines": [{"EarningsRateID": "ORD", "NumberOfUnits": units}]}
        days = [0.0] * 14
        casey = list(days); casey[0] = 8.0; casey[5] = 5.0            # Mon 21 and Sat 26, both as ordinary hours
        fran = [7.6 if i % 7 < 5 else 0.0 for i in range(14)]        # salaried: shouldn't have a timesheet
        sam = list(days); sam[1] = 6.0                               # Tue 22
        o["timesheets"] = [sheet("E1", casey), sheet("E2", fran), sheet("E3", sam)] if with_timesheets else []
        o["pay_runs"] = [{"PayRunID": "PR1", "PayrollCalendarID": "CAL1", "PayRunStatus": "DRAFT",
                          "PayRunPeriodStartDate": xero_ms_date(START), "PayRunPeriodEndDate": xero_ms_date(END),
                          "Wages": 2950.0, "Tax": 410.0, "Super": 354.0, "Deductions": 0, "Reimbursement": 20.0, "NetPay": 2560.0,
                          "Payslips": [{"EmployeeID": "E1", "FirstName": "Casey", "LastName": "Casual", "Wages": 390, "Tax": 20,
                                        "Super": 46.8, "Reimbursements": 0, "NetPay": 370},
                                       {"EmployeeID": "E2", "FirstName": "Fran", "LastName": "Fulltime", "Wages": 2350, "Tax": 380,
                                        "Super": 282, "Reimbursements": 0, "NetPay": 1970},
                                       {"EmployeeID": "E3", "FirstName": "Sam", "LastName": "Special", "Wages": 210, "Tax": 10,
                                        "Super": 25.2, "Reimbursements": 20, "NetPay": 220}]}]
        d = self.w.deputy
        d.employees = [{"Id": 1, "DisplayName": "Casey Casual"}, {"Id": 3, "DisplayName": "Sam Special"},
                       {"Id": 9, "DisplayName": "New Person"}]

        def shift(emp_id, day, sh, sm, eh, em, total):
            return {"Id": len(d.timesheets) + 1, "Employee": emp_id, "Date": str(day) + "T00:00:00+10:00",
                    "StartTime": epoch(day, sh, sm), "EndTime": epoch(day, eh, em), "TotalTime": total}
        d.timesheets = [shift(1, datetime.date(2026, 9, 21), 6, 0, 14, 30, 8.0),
                        shift(1, datetime.date(2026, 9, 23), 9, 0, 13, 0, 4.0),
                        shift(1, datetime.date(2026, 9, 26), 9, 0, 14, 0, 5.0),
                        shift(3, datetime.date(2026, 9, 22), 9, 0, 15, 0, 6.0),
                        shift(9, datetime.date(2026, 9, 24), 10, 0, 14, 0, 4.0)]
        self.w.files["Bookkeeping Payroll/acme-plumbing/pay-guide.xlsx"] = workbook_bytes(PAY_GUIDE)
        self.w.files["Bookkeeping Payroll/acme-plumbing/Pop expense September.xlsx"] = workbook_bytes(
            {"Sheet1": [["Pop expense claims", None, None], ["Employee", "Type", "Amount"], ["Casey Casual", "Mileage", 45.50],
                        ["Sam Special", "Other", 20.00]]})

    # ── helpers ──
    def start_runs(self, now, client=None):
        return run_flow(self.w, AUTOS[STARTRUNS], {"kind": "schedule", "actor_user_id": BOOKKEEPER, "now": now},
                        {"client_name": client} if client else None)

    def open_run(self):
        self.start_runs(at(PREP, 9, 30))
        return next(i for i in self.w.items.values() if i["title"].startswith("Pay run: Acme Plumbing"))

    def run_record(self):
        return json.loads(self.w.files["Bookkeeping/PayRuns/acme-plumbing-2026-09-21.json"])

    def check(self, item, auto=CHECK):
        return self.submit(auto, "Pay run", item["id"], {"q_action": "Run the checks"}, actor=OFFICER["id"])

    # ── settings ──
    def test_payroll_settings_are_saved_with_a_pay_guide_template(self):
        ps = json.loads(self.w.files["Bookkeeping/Payroll/acme-plumbing.json"])
        self.assertEqual((ps["calendar"], ps["prep_day"], ps["timesheets"], ps["who_posts"]), ("Fortnightly", "Monday", "deputy", "client"))
        self.assertEqual((ps["officer_id"], ps["reviewer_id"], ps["states"]), ("user-officer", "user-sam", ["NSW"]))
        self.assertEqual(self.w.items[self.settings_item["id"]]["status"], "done")
        self.assertIn("pay-guide.xlsx", self.w.items[self.settings_item["id"]]["comments"][-1])

    def test_a_new_client_gets_a_pay_guide_template_but_a_filled_one_is_never_overwritten(self):
        filled = self.w.files["Bookkeeping Payroll/acme-plumbing/pay-guide.xlsx"]
        self.submit("Bookkeeping: Apply payroll settings", "Client payroll settings", self.settings_item["id"], {
            "q_client_name": "Acme Plumbing", "q_calendar": "Fortnightly", "q_prep_day": "Monday", "q_timesheets": "Entered in Xero Payroll",
            "q_officer": OFFICER, "q_reviewer": SAM, "q_who_posts": "Our practice"})
        self.assertEqual(self.w.files["Bookkeeping Payroll/acme-plumbing/pay-guide.xlsx"], filled)
        del self.w.files["Bookkeeping Payroll/acme-plumbing/pay-guide.xlsx"]
        self.submit("Bookkeeping: Apply payroll settings", "Client payroll settings", self.settings_item["id"], {
            "q_client_name": "Acme Plumbing", "q_calendar": "Fortnightly", "q_prep_day": "Monday", "q_timesheets": "Entered in Xero Payroll",
            "q_officer": OFFICER, "q_reviewer": SAM, "q_who_posts": "Our practice"})
        book = load_workbook(io.BytesIO(self.w.files["Bookkeeping Payroll/acme-plumbing/pay-guide.xlsx"]))
        self.assertEqual(book.sheetnames, ["rates", "employees", "rules", "holidays", "pay_items"])

    def test_payroll_settings_need_the_bookkeeping_client_first(self):
        steps = self.submit("Bookkeeping: Apply payroll settings", "Client payroll settings", self.settings_item["id"], {
            "q_client_name": "Nobody Pty Ltd", "q_calendar": "Weekly", "q_prep_day": "Friday", "q_timesheets": "Entered in Xero Payroll",
            "q_officer": OFFICER, "q_reviewer": SAM, "q_who_posts": "The client"})
        self.assertEqual(steps["apply_payroll_settings"]["outputs"]["outcome"], "payroll_client_missing")

    # ── starting the pay run ──
    def test_the_pay_run_opens_on_the_preparation_day_once(self):
        self.start_runs(at(PREP, 8, 30))
        self.assertFalse(any(i["title"].startswith("Pay run:") for i in self.w.items.values()))
        self.start_runs(at(PREP, 9, 30))
        self.start_runs(at(PREP, 10, 30))
        runs = [i for i in self.w.items.values() if i["title"].startswith("Pay run:")]
        self.assertEqual(len(runs), 1)
        item = runs[0]
        self.assertEqual(item["title"], "Pay run: Acme Plumbing, 2026-09-21 to 2026-10-04, pay day 2026-10-06")
        self.assertEqual((item["assigneeIds"], item["dueDate"]), (["user-officer"], "2026-10-06"))
        self.assertEqual(item["formId"], source_id(STARTRUNS, "Pay run"))
        self.assertIn("Timesheets are in Xero Payroll (3)", item["comments"][0])

    def test_late_deputy_timesheets_are_chased_once(self):
        self.seed_payroll(with_timesheets=False)
        self.start_runs(at(PREP, 9, 30))
        item = next(i for i in self.w.items.values() if i["title"].startswith("Pay run:"))
        self.assertEqual(item["comments"], [])
        self.start_runs(at(PREP, 10, 5))
        self.start_runs(at(PREP, 11, 5))
        chases = [c for c in self.w.items[item["id"]]["comments"] if "Draft follow-up to Robin (robin@acme.example)" in c]
        self.assertEqual(len(chases), 1)

    def test_a_missing_pay_calendar_is_reported_not_opened(self):
        self.w.payroll.org(T_ACME)["calendars"][0]["Name"] = "Weekly"
        steps = self.start_runs(at(PREP, 9, 30))
        self.assertIn('no pay calendar called "Fortnightly"', steps["start_runs"]["outputs"]["summary"])

    # ── the check ──
    def test_the_check_finds_what_the_payroll_officer_looks_for(self):
        item = self.open_run()
        steps = self.check(item)
        f = steps["check"]["outputs"]["findings"]
        self.assertEqual(steps["check"]["outputs"]["problem"], "")
        self.assertEqual(f["missing_starters"], ["New Person"])
        self.assertEqual([r["name"] for r in f["salaried_timesheets"]], ["Fran Fulltime"])
        self.assertEqual(f["hours"], [{"name": "Casey Casual", "date": "2026-09-23", "deputy": 4.0, "xero": 0}])
        bands = {r["band"]: r for r in f["bands"] if r["name"] == "Casey Casual"}
        self.assertEqual(set(bands), {"ordinary", "early", "saturday"})
        self.assertAlmostEqual(bands["saturday"]["expected"], 5.0)
        self.assertAlmostEqual(bands["early"]["expected"], round(8 / 8.5, 2))
        self.assertEqual(f["rates"], [])  # Sam's flat rate is in effect until 28 Sep, inside this period
        changes = {r["name"]: r["text"] for r in f["changes"]}
        self.assertIn("turns 18 on 2026-09-25", changes["Casey Casual"])
        self.assertIn("special arrangement ends 2026-09-28", changes["Sam Special"])
        self.assertEqual(f["reimbursements"], [{"name": "Casey Casual", "file": 45.5, "pay_run": 0}])
        self.assertEqual(f["totals"]["NetPay"], 2560.0)

    def test_an_arrangement_that_ended_before_the_period_is_a_rate_error(self):
        guide = json.loads(json.dumps(PAY_GUIDE))
        guide["employees"][2][5] = "2026-08-17"
        self.w.files["Bookkeeping Payroll/acme-plumbing/pay-guide.xlsx"] = workbook_bytes(guide)
        f = self.check(self.open_run())["check"]["outputs"]["findings"]
        self.assertEqual([(r["name"], r["band"], r["expected"], r["xero"]) for r in f["rates"]], [("Sam Special", "ordinary", 30.0, 35.0)])
        self.assertIn("ended 2026-08-17 but Xero still pays the special rate", {r["name"]: r["text"] for r in f["changes"]}["Sam Special"])

    def test_a_casual_missing_from_the_pay_guide_is_listed(self):
        guide = json.loads(json.dumps(PAY_GUIDE))
        del guide["employees"][1]
        self.w.files["Bookkeeping Payroll/acme-plumbing/pay-guide.xlsx"] = workbook_bytes(guide)
        f = self.check(self.open_run())["check"]["outputs"]["findings"]
        self.assertEqual(f["unclassified"], ["Casey Casual"])

    def test_the_check_reports_and_drafts_one_query_email(self):
        item = self.open_run()
        steps = self.check(item)
        self.assertGreater(steps["report"]["outputs"]["open_items"], 0)
        comment = self.w.items[item["id"]]["comments"][-1]
        self.assertIn("Missing in Xero Payroll (hours in Deputy): **1**", comment)
        self.assertIn("Salaried staff with timesheets: **1**", comment)
        self.assertIn("Draft query email to Robin (robin@acme.example)", comment)
        self.assertIn("[Open the full check]", comment)
        report = next(a for a in self.w.artifacts if a["title"].startswith("Payroll check: Acme Plumbing"))
        self.assertIn("New Person", report["content"])
        self.assertEqual(self.run_record()["status"], "checked")
        self.assertEqual(sum(1 for c in self.w.ai_calls if c[0] == "generate"), 1)

    def test_the_xero_only_check_never_calls_deputy_and_says_so(self):
        item = self.open_run()
        steps = self.check(item, auto=CHECK_XERO)
        self.assertEqual(self.w.deputy.calls, [])
        self.assertIn("Check pay run (Xero Payroll + Deputy)", " ".join(steps["check"]["outputs"]["findings"]["notes"]))
        self.assertEqual([r["name"] for r in steps["check"]["outputs"]["findings"]["salaried_timesheets"]], ["Fran Fulltime"])

    def test_without_a_pay_guide_rates_are_skipped_with_a_note(self):
        del self.w.files["Bookkeeping Payroll/acme-plumbing/pay-guide.xlsx"]
        item = self.open_run()
        f = self.check(item)["check"]["outputs"]["findings"]
        self.assertEqual((f["rates"], f["bands"]), ([], []))
        self.assertIn("There's no pay guide", " ".join(f["notes"]))

    def test_a_manual_run_checks_the_clients_open_pay_run(self):
        self.open_run()
        steps = run_flow(self.w, AUTOS[CHECK], {"kind": "manual", "actor_user_id": BOOKKEEPER}, {"client_name": "Acme Plumbing"})
        self.assertTrue(steps["load_run"]["outputs"]["should_check"])
        self.assertEqual(steps["check"]["outputs"]["findings"]["missing_starters"], ["New Person"])

    def test_cancel_closes_the_pay_run(self):
        item = self.open_run()
        self.submit(CHECK, "Pay run", item["id"], {"q_action": "Cancel this pay run"})
        self.assertEqual((self.run_record()["status"], self.w.items[item["id"]]["status"]), ("cancelled", "done"))

    def test_nothing_is_ever_written_to_xero_payroll(self):
        item = self.open_run()
        self.check(item)
        self.submit(PACK, "Pay run", item["id"], {"q_action": "Ready for review: build the review pack"})
        self.assertTrue(all(t.startswith(("list_", "get_")) for t, _ in self.w.payroll.calls))

    # ── review pack and approvals ──
    def test_review_pack_goes_to_the_internal_reviewer(self):
        item = self.open_run()
        self.check(item)
        steps = self.submit(PACK, "Pay run", item["id"], {"q_action": "Ready for review: build the review pack",
                                                         "q_notes": "Fran's timesheet deleted; New Person added."})
        self.assertEqual(steps["build_pack"]["outputs"]["outcome"], "in_review")
        review = next(i for i in self.w.items.values() if i["title"].startswith("Review pay run: Acme Plumbing"))
        self.assertEqual((review["assigneeIds"], review["formId"]), (["user-sam"], source_id(PACK, "Payroll review")))
        pack = next(a for a in self.w.artifacts if a["title"].startswith("Pay run review pack"))
        self.assertIn("Fran&#x27;s timesheet deleted", pack["content"])
        self.assertIn("Sam Special", pack["content"])
        self.assertIn("2,560.00", pack["content"])
        self.assertEqual(self.run_record()["status"], "in_review")

    def test_no_draft_pay_run_means_no_pack(self):
        self.w.payroll.org(T_ACME)["pay_runs"] = []
        item = self.open_run()
        steps = self.submit(PACK, "Pay run", item["id"], {"q_action": "Ready for review: build the review pack"})
        self.assertEqual(steps["build_pack"]["outputs"]["outcome"], "no_draft")
        self.assertIn("no draft pay run", self.w.items[item["id"]]["comments"][-1])

    def approve_internally(self, item):
        self.check(item)
        self.submit(PACK, "Pay run", item["id"], {"q_action": "Ready for review: build the review pack"})
        review = next(i for i in self.w.items.values() if i["title"].startswith("Review pay run:"))
        self.submit(REVIEW, "Payroll review", review["id"], {"q_decision": "Approve: send it to the client"}, actor=SAM["id"])
        return review

    def test_internal_approval_then_client_approval_completes_the_pay_run(self):
        item = self.open_run()
        review = self.approve_internally(item)
        self.assertEqual(self.w.items[review["id"]]["status"], "done")
        client_item = next(i for i in self.w.items.values() if i["title"].startswith("Client approval: Acme Plumbing"))
        self.assertEqual(client_item["assigneeIds"], ["user-officer"])
        self.assertIn("Robin and Jordan", client_item["description"])
        self.assertEqual(self.run_record()["status"], "client_approval")
        self.submit(REVIEW, "Client payroll approval", client_item["id"], {"q_client_decision": "They approved it",
                                                                         "q_client_reply": "Looks good, go ahead"})
        self.assertEqual(self.run_record()["status"], "done")
        self.assertEqual(self.w.items[item["id"]]["status"], "done")
        self.assertIn("They post it in Xero Payroll", self.w.items[item["id"]]["comments"][-1])

    def test_when_the_practice_posts_the_item_stays_open_to_post(self):
        ps = json.loads(self.w.files["Bookkeeping/Payroll/acme-plumbing.json"])
        ps["who_posts"] = "practice"
        self.w.files["Bookkeeping/Payroll/acme-plumbing.json"] = json.dumps(ps)
        item = self.open_run()
        self.approve_internally(item)
        client_item = next(i for i in self.w.items.values() if i["title"].startswith("Client approval:"))
        self.submit(REVIEW, "Client payroll approval", client_item["id"], {"q_client_decision": "They approved it"})
        self.assertEqual(self.run_record()["status"], "approved")
        self.assertNotEqual(self.w.items[item["id"]]["status"], "done")
        self.assertIn("Post it in Xero Payroll", self.w.items[item["id"]]["comments"][-1])

    def test_changes_go_back_to_the_payroll_officer(self):
        item = self.open_run()
        self.check(item)
        self.submit(PACK, "Pay run", item["id"], {"q_action": "Ready for review: build the review pack"})
        review = next(i for i in self.w.items.values() if i["title"].startswith("Review pay run:"))
        self.submit(REVIEW, "Payroll review", review["id"], {"q_decision": "Changes needed", "q_notes": "Casey's Saturday is at ordinary rate"})
        self.assertEqual(self.run_record()["status"], "changes")
        self.assertEqual(self.w.items[item["id"]]["status"], "in_progress")
        self.assertIn("Casey's Saturday", self.w.items[item["id"]]["comments"][-1])


if __name__ == "__main__":
    unittest.main()
