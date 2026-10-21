"""Ledger checks (Xero) end to end, plus the intake checks Process bill adds, on a fake workspace + fake Xero."""
import datetime
import json
import os
import re
import sys
import unittest
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(__file__))
from harness import World, run_flow  # noqa: E402
from test_flows import AUTOS, INVOICE_TEXT, T_ACME, Base, make_pdf, source_id  # noqa: E402

AUTO = "Bookkeeping: Ledger checks (Xero)"
T = "tenant-checks"
OWNER = "user-checks-owner"
TODAY = datetime.datetime.now(ZoneInfo("Australia/Sydney")).date()


def day(n):
    """n days ago (negative: in the future), as YYYY-MM-DD."""
    return str(TODAY - datetime.timedelta(days=n))


def month_day(k, d=15):
    """Day d of the month k months ago (k=0: this month), never later than today."""
    m = TODAY.replace(day=1)
    for _ in range(k):
        m = (m - datetime.timedelta(days=1)).replace(day=1)
    return str(min(m.replace(day=d), TODAY))


def plus(date, n):
    return str(datetime.date.fromisoformat(date) + datetime.timedelta(days=n))


def last_month_day():
    return str((TODAY.replace(day=1) - datetime.timedelta(days=1)).replace(day=10))


def contact(cid, name, abn="", bank="", address=True):
    return {"ContactID": cid, "Name": name, "TaxNumber": abn, "BankAccountDetails": bank, "ContactStatus": "ACTIVE",
            "Addresses": [{"AddressType": "POBOX", "AddressLine1": "1 Main St" if address else ""}]}


def doc(doc_id, number, who, date, total, kind="ACCPAY", status="AUTHORISED", due=None, paid_on=None, attachments=True,
        sent=None, account="449", tax_type="INPUT", tax=None):
    tax = round(total / 11, 2) if tax is None else tax
    inv = {"InvoiceID": doc_id, "Type": kind, "InvoiceNumber": number, "Contact": {"ContactID": who["ContactID"], "Name": who["Name"]},
           "DateString": date + "T00:00:00", "DueDateString": (due or date) + "T00:00:00", "Status": status,
           "LineAmountTypes": "Exclusive", "SubTotal": round(total - tax, 2), "TotalTax": tax, "Total": total,
           "AmountDue": 0 if status == "PAID" else total, "HasAttachments": attachments,
           "LineItems": [{"AccountCode": account, "TaxType": tax_type, "LineAmount": round(total - tax, 2), "TaxAmount": tax}]}
    if paid_on:
        inv["FullyPaidOnDate"] = paid_on + "T00:00:00"
    if sent is not None:
        inv["SentToContact"] = sent
    return inv


def spend(txn_id, who, date, total, attachments=True, reconciled=True, account="429", tax_type="INPUT"):
    tax = round(total / 11, 2)
    return {"BankTransactionID": txn_id, "Type": "SPEND", "Contact": {"ContactID": who["ContactID"], "Name": who["Name"]},
            "DateString": date + "T00:00:00", "Status": "AUTHORISED", "LineAmountTypes": "Exclusive", "Total": total,
            "TotalTax": tax, "HasAttachments": attachments, "IsReconciled": reconciled,
            "LineItems": [{"AccountCode": account, "TaxType": tax_type, "LineAmount": round(total - tax, 2), "TaxAmount": tax}]}


class Checks(unittest.TestCase):
    def setUp(self):
        self.w = World()
        self.w.xero.add_org(T, "Acme Plumbing Pty Ltd", default=True)
        self.org = self.w.xero.orgs[T]
        self.org["lock_date"] = day(40) + "T00:00:00"
        self.org["short_code"] = "!Ab12C"
        for i, a in enumerate(self.org["accounts"]):
            a["AccountID"] = "acc-" + a["Code"]
            a["Class"] = "REVENUE" if a["Type"] in ("REVENUE", "OTHERINCOME") else "EXPENSE"
        # Every account moved this year, so the default file has nothing to report.
        self.org["profit_and_loss"] = {"income": {"acc-200": 50000.0, "acc-260": 100.0},
                                       "expenses": {"acc-400": 1.0, "acc-429": 1.0, "acc-449": 1.0, "acc-489": 1.0}}
        self.supplies = contact("c-supplies", "Plumbing Supplies Co", "51824753556", "062000 11112222")
        self.org["contacts"].append(self.supplies)
        self.org["invoices"].append(doc("b-ok", "PS-1", self.supplies, day(5), 330.0, status="PAID", paid_on=day(1)))
        self.w.files["Bookkeeping/settings.json"] = json.dumps({"version": 1, "timezone": "Australia/Sydney",
                                                                "reviewer_id": "user-reviewer", "checks_owner_id": OWNER})
        self.client = {"version": 1, "slug": "acme-plumbing", "name": "Acme Plumbing", "xero_tenant_id": T,
                       "xero_org_name": "Acme Plumbing Pty Ltd", "gst_registered": True, "reviewer_id": "user-reviewer"}
        self.save_client()

    # ── helpers ──
    def save_client(self):
        self.w.files["Bookkeeping/Clients/acme-plumbing.json"] = json.dumps(self.client)

    def add(self, c):
        self.org["contacts"].append(c)
        return c

    def check_now(self, client_name=""):
        return run_flow(self.w, AUTOS[AUTO], {"kind": "manual", "actor_user_id": OWNER}, {"client_name": client_name})

    def overnight(self):
        """The next night's scheduled run: yesterday's check is done, so today's is due."""
        path = "Bookkeeping/Checks/acme-plumbing.json"
        if path in self.w.files:
            state = json.loads(self.w.files[path])
            state["last_daily"] = day(1)
            self.w.files[path] = json.dumps(state)
        return run_flow(self.w, AUTOS[AUTO], {"kind": "schedule"}, {"client_name": ""})

    def submit(self, todo_id, responses):
        trigger = {"kind": "event", "actor_user_id": OWNER,
                   "event": {"eventType": "form.response_submitted",
                             "subject": {"form_id": source_id(AUTO, "Check findings"), "todo_id": todo_id},
                             "payload": {"responses": responses}}}
        return run_flow(self.w, AUTOS[AUTO], trigger, {"client_name": ""})

    def state(self):
        return json.loads(self.w.files["Bookkeeping/Checks/acme-plumbing.json"])

    def items(self):
        return [i for i in self.w.items.values() if "checks" in i["labels"]]

    def open_item(self):
        rows = [i for i in self.items() if i["status"] != "done"]
        self.assertEqual(len(rows), 1, [i["title"] for i in rows])
        return rows[0]

    def ref(self, item, check):
        line = next(l for l in item["description"].split("\n") if check in l)
        return re.search(r"ref ([0-9A-F]{6})", line).group(1)

    def duplicate_bills(self):
        sparky = self.add(contact("c-sparky", "Sparky Electrical Pty Ltd", "53004085616", "062000 12345678"))
        self.org["invoices"] += [doc("b1", "INV-7", sparky, day(10), 440.0), doc("b2", "INV-8", sparky, day(7), 440.0)]
        return sparky

    # ── the sweep and its item ──
    def test_a_clean_file_raises_nothing(self):
        steps = self.overnight()
        self.assertEqual(self.items(), [])
        self.assertEqual(steps["run_checks"]["outputs"]["summary"]["errors"], [])
        self.assertEqual(self.state()["last_weekly"], str(TODAY))

    def test_duplicate_bills_open_one_checks_item_that_later_runs_update(self):
        self.duplicate_bills()
        self.overnight()
        item = self.open_item()
        self.assertEqual(item["title"], "Checks: Acme Plumbing")
        self.assertEqual(item["assigneeIds"], [OWNER])
        self.assertEqual(item["labels"], ["bookkeeping", "checks", "acme-plumbing"])
        self.assertEqual(item["formId"], source_id(AUTO, "Check findings"))
        self.assertEqual(item["priority"], "medium")
        self.assertIn("- [ ] **Medium** — CHK-055 Possible Duplicate Bill — $440.00 — Bills INV-7", item["description"])
        # Links switch to the client's own Xero organisation first, whatever the browser last had open.
        self.assertIn("[Open in Xero](https://go.xero.com/organisationlogin/default.aspx?shortcode=!Ab12C"
                      "&redirecturl=/AccountsPayable/Edit.aspx?InvoiceID=b2)", item["description"])
        self.assertEqual(self.state()["todo_id"], item["id"])
        # Already checked today: the next scheduled run skips it.
        run_flow(self.w, AUTOS[AUTO], {"kind": "schedule"}, {"client_name": ""})
        self.assertEqual(len(self.items()), 1)
        # The next night updates the same item, with no comment when nothing changed.
        self.overnight()
        self.assertEqual(self.open_item()["id"], item["id"])
        self.assertEqual(self.w.items[item["id"]]["comments"], [])

    def test_changed_bank_details_flag_the_change_and_the_bill_about_to_be_paid(self):
        sparky = self.add(contact("c-sparky", "Sparky Electrical Pty Ltd", "53004085616", "062000 12345678"))
        self.org["invoices"].append(doc("b9", "INV-9", sparky, day(3), 1200.0, due=day(-5)))
        self.overnight()
        self.assertEqual(self.items(), [], "the first run only takes the snapshot")
        sparky["BankAccountDetails"] = "063999 87654321"
        self.overnight()
        item = self.open_item()
        self.assertEqual(item["priority"], "high")
        self.assertIn("CHK-017 Contact Bank Account Changed", item["description"])
        self.assertIn("**High** — CHK-057 Supplier Bank Details Changed Before A Payment — $1,200.00", item["description"])
        raw = self.w.files["Bookkeeping/Checks/acme-plumbing.json"]
        for digits in ("12345678", "87654321", "063999", "062000"):
            self.assertNotIn(digits, raw, "bank numbers must never be stored")
        self.assertNotIn("87654321", item["description"])

    def test_ticked_line_stays_dismissed_until_its_details_change(self):
        self.duplicate_bills()
        self.overnight()
        item = self.open_item()
        self.org["invoices"].append(doc("i1", "INV-100", self.supplies, day(2), 99.0, kind="ACCREC", account="200", tax_type="OUTPUT"))
        self.org["invoices"].append(doc("i2", "INV-101", self.supplies, day(1), 99.0, kind="ACCREC", account="200", tax_type="OUTPUT"))
        self.overnight()
        desc = self.w.items[item["id"]]["description"]
        self.w.items[item["id"]]["description"] = "\n".join(
            l.replace("- [ ]", "- [x]", 1) if "CHK-055" in l else l for l in desc.split("\n"))
        self.overnight()
        desc = self.w.items[item["id"]]["description"]
        self.assertNotIn("CHK-055", desc)
        self.assertIn("CHK-028", desc)
        self.assertIn("1 finding(s) dismissed or snoozed", desc)
        self.assertEqual(next(f for f in self.state()["findings"].values() if f["check"] == "CHK-055")["status"], "dismissed")
        # One of the two bills gets paid: the finding's details changed, so it's back.
        next(i for i in self.org["invoices"] if i["InvoiceID"] == "b1").update(Status="PAID", AmountDue=0, FullyPaidOnDate=day(0))
        self.overnight()
        self.assertIn("CHK-055", self.w.items[item["id"]]["description"])
        self.assertIn("1 new, 0 resolved", self.w.items[item["id"]]["comments"][-1])

    def test_all_clear_completes_the_item_and_new_findings_open_a_new_one(self):
        self.duplicate_bills()
        self.overnight()
        first = self.open_item()
        next(i for i in self.org["invoices"] if i["InvoiceID"] == "b2")["Status"] = "VOIDED"
        self.overnight()
        self.assertEqual(self.w.items[first["id"]]["status"], "done")
        self.assertIn("All clear", self.w.items[first["id"]]["comments"][-1])
        self.assertEqual(self.state()["todo_id"], "")
        self.org["invoices"].append(doc("b3", "INV-77", self.supplies, day(1), 330.0))
        self.overnight()
        second = self.open_item()
        self.assertNotEqual(second["id"], first["id"])
        self.assertIn("CHK-055", second["description"])

    def test_an_item_closed_by_hand_isnt_reopened_for_the_same_findings(self):
        self.duplicate_bills()
        self.overnight()
        item = self.open_item()
        self.w.items[item["id"]]["status"] = "done"
        self.overnight()
        self.assertEqual(len(self.items()), 1)
        self.org["invoices"].append(doc("b3", "INV-77", self.supplies, day(1), 330.0))
        self.overnight()
        self.assertEqual(len(self.items()), 2)

    def test_the_item_is_found_by_title_when_its_id_is_lost(self):
        self.duplicate_bills()
        self.overnight()
        item = self.open_item()
        state = self.state()
        state["todo_id"] = "gone"
        self.w.files["Bookkeeping/Checks/acme-plumbing.json"] = json.dumps(state)
        self.overnight()
        self.assertEqual(len(self.items()), 1)
        self.assertEqual(self.state()["todo_id"], item["id"])

    def test_urgent_set_by_a_person_is_left_alone(self):
        self.duplicate_bills()
        self.overnight()
        item = self.open_item()
        self.w.items[item["id"]]["priority"] = "urgent"
        self.overnight()
        self.assertEqual(self.w.items[item["id"]]["priority"], "urgent")

    # ── the Check findings form ──
    def test_snooze_and_not_an_issue_through_the_form(self):
        self.duplicate_bills()
        self.org["invoices"].append(doc("i1", "INV-100", self.supplies, day(2), 99.0, kind="ACCREC", account="200", tax_type="OUTPUT"))
        self.org["invoices"].append(doc("i2", "INV-101", self.supplies, day(1), 99.0, kind="ACCREC", account="200", tax_type="OUTPUT"))
        self.overnight()
        first = self.open_item()
        self.submit(first["id"], {"q_refs": self.ref(first, "CHK-055"), "q_action": "Snooze until the date below",
                                  "q_until": day(-10), "q_note": "Supplier is sending a credit note"})
        self.assertEqual(self.w.items[first["id"]]["status"], "done")
        self.assertIn("snoozed until " + day(-10), self.w.items[first["id"]]["comments"][-1])
        second = self.open_item()
        self.assertEqual(second["formId"], source_id(AUTO, "Check findings"))
        self.assertNotIn("CHK-055", second["description"])
        self.assertIn("CHK-028", second["description"])
        self.assertIn("Supplier is sending a credit note", second["comments"][0])
        # The snooze holds on the next run.
        self.overnight()
        self.assertNotIn("CHK-055", self.w.items[second["id"]]["description"])
        self.submit(second["id"], {"q_refs": self.ref(self.w.items[second["id"]], "CHK-028"),
                                   "q_action": "Not an issue: hide until their details change"})
        self.assertEqual(self.w.items[second["id"]]["status"], "done")
        self.assertEqual([i for i in self.items() if i["status"] != "done"], [], "nothing open: no new item")
        state = self.state()
        self.assertEqual(sorted(f["status"] for f in state["findings"].values()), ["dismissed", "snoozed"])

    def test_check_again_rechecks_and_dismisses_nothing(self):
        self.duplicate_bills()
        self.overnight()
        first = self.open_item()
        self.org["invoices"].append(doc("b3", "INV-77", self.supplies, day(1), 330.0))
        self.submit(first["id"], {"q_refs": "all", "q_action": "Nothing: just check this client again now"})
        state = self.state()
        self.assertEqual(state["dismissed"], {})
        self.assertEqual(sorted(f["check"] for f in state["findings"].values() if f["status"] == "open"), ["CHK-055", "CHK-055"])
        self.assertIn("CHK-055", self.open_item()["description"])
        self.assertNotIn("no open finding matched", self.w.items[first["id"]]["comments"][-1])

    def test_daily_and_weekly_runs_agree_on_duplicates(self):
        sparky = self.duplicate_bills()
        # Same number as a paid bill from 50 days ago: outside what a daily run reads, so never flagged either way.
        self.org["invoices"].append(doc("b-old", "INV-8", sparky, day(50), 440.0, status="PAID", paid_on=day(45)))
        self.overnight()
        item = self.open_item()
        checks = sorted(f["check"] for f in self.state()["findings"].values())
        self.assertNotIn("CHK-080", checks)
        self.overnight()
        self.assertEqual(sorted(f["check"] for f in self.state()["findings"].values()), checks)
        self.assertEqual(self.w.items[item["id"]]["comments"], [], "nothing came and went")

    def test_transfers_are_not_spend_money(self):
        t = spend("tr1", self.supplies, last_month_day(), 5000.0, attachments=False)
        t["Type"] = "SPEND-TRANSFER"
        self.org["BankTransactions"] = [t]
        self.overnight()
        self.assertNotIn("CHK-021", " ".join(f["check"] for f in self.state().get("findings", {}).values()))

    def test_ticking_a_weekly_finding_hides_it_on_the_next_daily_run(self):
        self.org["lock_date"] = None
        self.overnight()
        item = self.open_item()
        desc = item["description"]
        self.w.items[item["id"]]["description"] = desc.replace("- [ ] **Medium** — CHK-134", "- [x] **Medium** — CHK-134")
        self.duplicate_bills()
        self.overnight()
        self.assertNotIn("CHK-134", self.w.items[item["id"]]["description"])
        self.assertEqual(self.state()["last_weekly"], str(TODAY))

    def test_bank_details_added_to_a_contact_that_had_none(self):
        tradie = self.add(contact("c-tradie", "Joe Tradie", "53004085616", ""))
        self.org["invoices"].append(doc("b-t", "JT-1", tradie, day(2), 900.0, due=day(-3)))
        self.overnight()
        self.assertEqual(self.items(), [])
        tradie["BankAccountDetails"] = "062000 55556666"
        self.overnight()
        desc = self.open_item()["description"]
        self.assertIn("CHK-017", desc)
        self.assertIn("CHK-057", desc)

    def test_form_with_a_past_snooze_date_changes_nothing(self):
        self.duplicate_bills()
        self.overnight()
        first = self.open_item()
        self.submit(first["id"], {"q_refs": self.ref(first, "CHK-055"), "q_action": "Snooze until the date below", "q_until": day(1)})
        self.assertIn("the snooze date has to be after today", self.w.items[first["id"]]["comments"][-1])
        self.assertIn("CHK-055", self.open_item()["description"])

    # ── weekly checks ──
    def test_weekly_checks(self):
        self.client.update(gst_registered=False, suspense_codes=["899"])
        self.save_client()
        self.org["lock_date"] = None
        self.org["accounts"] += [{"AccountID": "acc-404", "Code": "404", "Name": "Bank Fees", "Type": "EXPENSE", "Class": "EXPENSE", "Status": "ACTIVE"},
                                 {"AccountID": "acc-899", "Code": "899", "Name": "Transfers in transit", "Type": "CURRLIAB", "Class": "LIABILITY", "Status": "ACTIVE"}]
        self.org["profit_and_loss"]["income"]["acc-200"] = 80000.0
        self.org["profit_and_loss"]["expenses"]["acc-404"] = 30.0
        self.org["trial_balance"] = {str(TODAY): {"acc-899": 250.0}, day(30): {"acc-899": 400.0}}
        self.org["BankTransactions"] = [spend("s1", self.supplies, last_month_day(), 120.0, attachments=False)]
        self.org["invoices"] += [
            doc("i-unsent", "INV-200", self.supplies, day(4), 550.0, kind="ACCREC", sent=False, account="200", tax_type="OUTPUT"),
            doc("i-captured", "INV-201", self.supplies, day(4), 660.0, kind="ACCREC", sent=False, account="200", tax_type="OUTPUT", tax=0),
            doc("b-fee", "FEE-1", self.supplies, day(6), 22.0, account="404")]
        self.w.files["Bookkeeping/Checks/acme-plumbing-intake.json"] = json.dumps({"captured": ["i-captured"]})
        steps = self.overnight()
        self.assertEqual(steps["run_checks"]["outputs"]["summary"]["errors"], [])
        desc = self.open_item()["description"]
        for check in ("CHK-021", "CHK-024", "CHK-031", "CHK-058", "CHK-125", "CHK-134", "CHK-136"):
            self.assertIn(check, desc)
        self.assertIn("1 approved sales invoice(s) were never sent from Xero (INV-200)", desc)
        self.assertNotIn("INV-201)", desc.split("CHK-024")[1].split("\n")[0], "captured invoices are left out")
        # A daily-only run doesn't touch the weekly findings.
        self.overnight()
        self.assertIn("CHK-021", self.open_item()["description"])
        self.assertEqual(self.state()["last_weekly"], str(TODAY))

    def test_no_lock_date_twice_is_not_a_lock_date_change(self):
        self.org["lock_date"] = None
        self.overnight()
        state = self.state()
        state["last_weekly"] = day(8)  # the next run is weekly too
        state["snapshot"]["lock_change"] = {"from": "", "to": "", "on": day(1)}  # what the first release saved
        self.w.files["Bookkeeping/Checks/acme-plumbing.json"] = json.dumps(state)
        self.overnight()
        desc = self.open_item()["description"]
        self.assertIn("CHK-134", desc)
        self.assertNotIn("CHK-135", desc)
        self.assertNotIn("lock_change", self.state()["snapshot"])

    def test_a_lock_date_moved_back_is_flagged(self):
        self.org["lock_date"] = day(40) + "T00:00:00"
        self.overnight()
        state = self.state()
        state["last_weekly"] = day(8)
        self.w.files["Bookkeeping/Checks/acme-plumbing.json"] = json.dumps(state)
        self.org["lock_date"] = day(200) + "T00:00:00"
        self.overnight()
        self.assertIn("CHK-135 Lock Date Change", self.open_item()["description"])

    def test_suppliers_without_an_abn_are_one_line_per_client(self):
        a = self.add(contact("c-a", "Alpha Supplies", ""))
        b = self.add(contact("c-b", "Beta Freight", ""))
        self.org["invoices"] += [doc("x1", "A-1", a, day(6), 220.0), doc("x2", "B-1", b, day(5), 550.0), doc("x3", "B-2", b, day(4), 110.0)]
        self.overnight()
        lines = [l for l in self.open_item()["description"].split("\n") if "CHK-008" in l]
        self.assertEqual(len(lines), 1)
        self.assertIn("$80.00 GST claimed on purchases over $82.50 from 2 supplier(s) with no ABN in Xero: Beta Freight $60.00, "
                      "Alpha Supplies $20.00", lines[0])

    def test_suppliers_missing_tpar_details_only_for_tpar_clients(self):
        bare = self.add(contact("c-tradie", "Joe Tradie", abn="", address=False))
        self.org["invoices"].append(doc("b-t", "JT-1", bare, day(10), 2200.0, status="PAID", paid_on=day(8)))
        self.overnight()
        self.assertNotIn("CHK-007", self.open_item()["description"])
        self.client["tpar"] = True
        self.save_client()
        self.check_now("Acme Plumbing")
        self.assertIn("CHK-007 TPAR Information Missing", self.open_item()["description"])
        self.assertIn("CHK-008", self.open_item()["description"])

    def test_weekly_report_goes_out_once_a_week(self):
        self.duplicate_bills()
        self.overnight()
        self.assertEqual(len(self.w.artifacts), 1)
        page = self.w.artifacts[0]["content"]
        self.assertEqual(self.w.artifacts[0]["title"], "Ledger checks " + str(TODAY))
        for text in ("Acme Plumbing", "Client queries", "CHK-055", "1 business · 1 open finding · 0 high · $440.00 at risk"):
            self.assertIn(text, page)
        # Its own white page, so it reads the same in a dark-themed viewer.
        self.assertIn("html{background:#ffffff", page)
        self.assertEqual(self.w.notifications[0]["user_ids"], [OWNER])
        self.overnight()
        self.assertEqual(len(self.w.artifacts), 1)

    def test_weekly_report_shows_gst_findings_open_and_resolved(self):
        self.client["gst_registered"] = False
        self.save_client()
        self.org["invoices"].append(doc("i-gst", "INV-300", self.supplies, day(4), 550.0, kind="ACCREC", account="200",
                                        tax_type="OUTPUT"))
        self.overnight()
        page = self.w.artifacts[0]["content"]
        gst = page.split("<h2>GST checks</h2>")[1].split("<h2>")[0]
        self.assertIn("CHK-031 GST on Invoice and/or Credit Note When Not Registered", gst)
        self.assertRegex(gst, r"CHK-031[^<]*</td><td class='n'>1</td><td class='n'>[0-9.,]+</td><td class='n'>—</td>")
        # Fixed in Xero: next week's report shows it as resolved, and only its check, key, amount and dates are kept.
        self.org["invoices"] = [i for i in self.org["invoices"] if i["InvoiceID"] != "i-gst"]
        state = self.state()
        state["last_weekly"] = day(8)
        self.w.files["Bookkeeping/Checks/acme-plumbing.json"] = json.dumps(state)
        self.w.files["Bookkeeping/Checks/_report.json"] = json.dumps({"on": day(8)})
        self.overnight()
        self.assertEqual(len(self.w.artifacts), 2)
        gst = self.w.artifacts[1]["content"].split("<h2>GST checks</h2>")[1].split("<h2>")[0]
        self.assertRegex(gst, r"CHK-031[^<]*</td><td class='n'>—</td><td class='n'>—</td><td class='n'>1</td>")
        self.assertIn("All businesses", gst)
        logged = [r for r in self.state()["resolved"] if r["check"] == "CHK-031"]
        self.assertEqual(len(logged), 1)
        self.assertEqual(set(logged[0]), {"check", "key", "amount", "first_seen", "on"})
        self.assertEqual(logged[0]["on"], str(TODAY))

    def test_resolved_log_keeps_about_a_year(self):
        state = {"version": 1, "slug": "acme-plumbing", "last_daily": day(1), "last_weekly": day(8),
                 "resolved": [{"check": "CHK-031", "key": "CHK-031:old", "amount": 1.0, "first_seen": day(500), "on": day(450)},
                              {"check": "CHK-031", "key": "CHK-031:recent", "amount": 1.0, "first_seen": day(60), "on": day(30)}]}
        self.w.files["Bookkeeping/Checks/acme-plumbing.json"] = json.dumps(state)
        self.overnight()
        self.assertEqual([r["key"] for r in self.state()["resolved"]], ["CHK-031:recent"])

    def test_clients_with_checks_turned_off_are_skipped(self):
        self.duplicate_bills()
        self.client["checks_enabled"] = False
        self.save_client()
        self.overnight()
        self.assertEqual(self.items(), [])
        steps = self.check_now("Acme Plumbing")
        self.assertIn("No client business has ledger checks on", steps["run_checks"]["outputs"]["problem"])

    def test_a_manual_run_finds_the_client_by_its_xero_name_too(self):
        self.duplicate_bills()
        self.check_now("Acme Plumbing Pty Ltd")
        self.assertIn("CHK-055", self.open_item()["description"])
        steps = self.check_now("Nobody Here")
        self.assertIn("Acme Plumbing", steps["run_checks"]["outputs"]["problem"])

    def test_a_client_xero_refuses_is_tried_three_times_a_day_and_shown_in_the_report(self):
        self.w.files["Bookkeeping/Clients/gone.json"] = json.dumps({"version": 1, "slug": "gone", "name": "Gone Pty Ltd",
                                                                   "xero_tenant_id": "tenant-gone", "gst_registered": True})
        for n in range(1, 4):
            errors = self.overnight()["run_checks"]["outputs"]["summary"]["errors"]
            self.assertEqual(len(errors), 1)
            self.assertIn("Gone Pty Ltd: ", errors[0])
            self.assertNotIn("not retried", errors[0])
            self.assertEqual(json.loads(self.w.files["Bookkeeping/Checks/gone.json"])["failed"]["tries"], n)
        errors = self.overnight()["run_checks"]["outputs"]["summary"]["errors"]
        self.assertIn("(not retried again today)", errors[0])
        self.assertEqual(json.loads(self.w.files["Bookkeeping/Checks/gone.json"])["failed"]["tries"], 3)
        # The weekly report went out on the first night, saying which file couldn't be read.
        self.assertEqual(len(self.w.artifacts), 1)
        self.assertIn("Couldn't read Xero on", self.w.artifacts[0]["content"])
        # Tomorrow it's tried again.
        gone = json.loads(self.w.files["Bookkeeping/Checks/gone.json"])
        gone["failed"]["on"] = day(1)
        self.w.files["Bookkeeping/Checks/gone.json"] = json.dumps(gone)
        errors = self.overnight()["run_checks"]["outputs"]["summary"]["errors"]
        self.assertNotIn("not retried", errors[0])
        # A manual run always tries, and a good read clears the failure.
        self.w.xero.add_org("tenant-gone", "Gone Pty Ltd")
        steps = self.check_now("Gone Pty Ltd")
        self.assertEqual(steps["run_checks"]["outputs"]["summary"]["errors"], [])
        self.assertNotIn("failed", json.loads(self.w.files["Bookkeeping/Checks/gone.json"]))

    def test_no_clients_set_up_says_so(self):
        del self.w.files["Bookkeeping/Clients/acme-plumbing.json"]
        steps = self.overnight()
        self.assertIn("No client business has ledger checks on", steps["run_checks"]["outputs"]["problem"])

    # ── register checks (Register lookups (ABR) saves, Ledger checks reads) ──
    def on_register(self, abn, name, status="Active", status_from="1999-11-01", gst_from="2000-07-01", gst_to=None, dgr=False):
        self.w.abr.records[abn] = {"status": status, "status_from": status_from, "entity_name": name.upper(),
                                   "gst_registered": bool(gst_from) and not gst_to, "gst_from": gst_from, "gst_to": gst_to,
                                   "dgr_endorsed": dgr, "acnc_registered": False, "business_names": [], "trading_names": []}

    def register_then_weekly(self):
        """Night 1 saves the client's ABNs, Register lookups looks them up, night 2's weekly run checks them."""
        self.overnight()
        run_flow(self.w, AUTOS["Bookkeeping: Register lookups (ABR)"], {"kind": "schedule"}, {"client_name": ""})
        state = self.state()
        state["last_daily"], state["last_weekly"] = day(1), day(8)
        self.w.files["Bookkeeping/Checks/acme-plumbing.json"] = json.dumps(state)
        return run_flow(self.w, AUTOS[AUTO], {"kind": "schedule"}, {"client_name": ""})

    def register_desc(self):
        return "\n".join(l for l in self.open_item()["description"].split("\n"))

    def test_cancelled_businesses_still_billed_paid_or_owing(self):
        self.on_register("51824753556", "Plumbing Supplies Co")
        gone = self.add(contact("c-gone", "Gone Electrical", "53004085616"))
        self.on_register("53004085616", "Gone Electrical", status="Cancelled", status_from=day(30))
        self.org["invoices"] += [doc("g1", "GE-9", gone, day(10), 550.0),
                                 doc("g2", "GE-8", gone, day(40), 330.0, status="PAID", paid_on=day(5)),
                                 doc("s1", "INV-500", gone, day(12), 880.0, kind="ACCREC", account="200", tax_type="OUTPUT", sent=True)]
        self.org["BankTransactions"] = [spend("sp1", gone, day(3), 220.0)]
        self.register_then_weekly()
        desc = self.register_desc()
        for check in ("CHK-071", "CHK-072", "CHK-088", "CHK-030", "CHK-039"):
            self.assertIn(check, desc)
        self.assertIn("Gone Electrical's ABN 53004085616 was cancelled on", desc)
        self.assertIn("still owes $880.00", desc)

    def test_gst_from_businesses_not_registered(self):
        self.on_register("51824753556", "Plumbing Supplies Co")
        nogst = self.add(contact("c-nogst", "Small Painter", "53004085616"))
        self.on_register("53004085616", "Small Painter", gst_from=None)
        self.org["invoices"] += [doc("n1", "SP-1", nogst, day(10), 110.0), doc("n2", "SP-2", nogst, day(8), 220.0),
                                 doc("n3", "SP-0", nogst, day(20), 330.0, status="PAID", paid_on=day(15))]
        self.org["BankTransactions"] = [spend("sp2", nogst, day(4), 99.0)]
        self.register_then_weekly()
        desc = self.register_desc()
        self.assertIn("CHK-068", desc)
        self.assertNotIn("CHK-085", desc, "two unpaid bills are one CHK-068 line, not CHK-085")
        self.assertIn("CHK-076", desc)
        self.assertIn("CHK-077", desc)

    def test_wrong_abns_likely_matches_and_donations(self):
        self.on_register("51824753556", "Totally Different Holdings")
        self.add(contact("c-zen", "Zenith IT", ""))
        self.org["invoices"].append(doc("z1", "Z-1", {"ContactID": "c-zen", "Name": "Zenith IT"}, day(6), 1100.0))
        self.w.abr.names["zenith it"] = [{"abn": "53004085616", "name": "ZENITH IT PTY LTD", "score": 99}]
        self.org["accounts"].append({"AccountID": "acc-490", "Code": "490", "Name": "Donations", "Type": "EXPENSE", "Class": "EXPENSE", "Status": "ACTIVE"})
        rc = self.add(contact("c-rc", "Local Footy Club", "33102417032"))
        self.on_register("33102417032", "Local Footy Club", dgr=False)
        self.org["invoices"].append(doc("d1", "DON-1", rc, day(7), 500.0, account="490", tax_type="EXEMPTEXPENSES", tax=0))
        self.register_then_weekly()
        desc = self.register_desc()
        self.assertIn("CHK-004", desc)
        self.assertIn("is registered to TOTALLY DIFFERENT HOLDINGS", desc)
        self.assertIn("CHK-005", desc)
        self.assertIn("Zenith IT → 53004085616 (ZENITH IT PTY LTD)", desc)
        self.assertIn("CHK-009", desc)

    def test_no_register_results_means_no_register_checks(self):
        gone = self.add(contact("c-gone", "Gone Electrical", "53004085616"))
        self.on_register("53004085616", "Gone Electrical", status="Cancelled", status_from=day(30))
        self.org["invoices"].append(doc("g1", "GE-9", gone, day(10), 550.0))
        self.overnight()  # Register lookups never ran
        state = self.state()
        state["last_daily"], state["last_weekly"] = day(1), day(8)
        self.w.files["Bookkeeping/Checks/acme-plumbing.json"] = json.dumps(state)
        self.overnight()
        self.assertFalse(any(f["check"] == "CHK-071" for f in self.state().get("findings", {}).values()))

    # ── the checks built from the seed packs (21 Oct) ──
    def test_an_asic_fee_overdue_or_due_soon_is_high(self):
        asic = self.add(contact("c-asic", "ASIC", "86768265615"))
        self.org["invoices"] += [doc("a1", "ASIC-2026", asic, day(40), 321.0, due=day(30), tax=0),
                                 doc("a2", "ASIC-LATE", asic, day(20), 96.0, due=day(-5), tax=0),
                                 doc("a3", "ASIC-2025", asic, day(60), 310.0, due=day(50), status="PAID", paid_on=day(52), tax=0),
                                 doc("a4", "ASIC-NEXT", asic, day(5), 321.0, due=day(-60), tax=0)]
        self.overnight()
        lines = [l for l in self.open_item()["description"].split("\n") if "CHK-170" in l]
        self.assertEqual(len(lines), 2, lines)
        self.assertIn("**High**", lines[0])
        self.assertTrue(any("ASIC-2026 of $321.00 was due on" in l and "is unpaid" in l for l in lines))
        self.assertTrue(any("ASIC-LATE of $96.00 is due on" in l for l in lines))

    def test_nearly_the_same_bill_number_is_an_advanced_duplicate(self):
        telstra = self.add(contact("c-tel", "Telstra Corporation Ltd", "33051775556"))
        self.org["invoices"] += [doc("t1", "TEL-0515", telstra, day(10), 330.0, status="PAID", paid_on=day(9)),
                                 doc("t2", "TEL-0515R", telstra, day(7), 330.0, status="PAID", paid_on=day(6)),
                                 # Different numbers that just share a start aren't duplicates.
                                 doc("t3", "INV-100", telstra, day(30), 99.0, due=day(-30)),
                                 doc("t4", "INV-1001", telstra, day(12), 99.0, due=day(-30))]
        self.overnight()
        desc = self.open_item()["description"]
        self.assertIn("CHK-081 Duplicate Bill Raised Advanced", desc)
        self.assertIn("TEL-0515", desc)
        self.assertNotIn("CHK-080", desc, "one finding per pair: the advanced duplicate")
        self.assertNotIn("INV-1001", desc)

    def test_spend_money_to_a_supplier_that_is_billed(self):
        ms = self.add(contact("c-ms", "Microsoft Australia Pty Ltd", "29002589460"))
        self.org["invoices"] += [doc("m1", "MS-07", ms, day(60), 660.0, account="489", status="PAID", paid_on=day(55)),
                                 doc("m2", "MS-08", ms, day(30), 660.0, account="489", status="PAID", paid_on=day(25))]
        self.org["BankTransactions"] = [spend("e16", ms, day(12), 660.0, account="489")]
        self.overnight()
        desc = self.open_item()["description"]
        self.assertIn("CHK-074", desc)
        self.assertIn("1 spend money payment(s) to Microsoft Australia Pty Ltd", desc)
        self.assertIn("which is normally billed (2 bills)", desc)

    def test_fuel_bought_and_no_fuel_tax_credits(self):
        bp = self.add(contact("c-bp", "BP Australia", "40337466735"))
        self.org["BankTransactions"] = [spend("e21", bp, day(12), 1480.0, account="449")]
        self.overnight()
        self.assertIn("CHK-131", self.open_item()["description"])
        self.assertIn("$1,480.00 of fuel bought (BP Australia)", self.open_item()["description"])

    def test_no_fuel_tax_credit_finding_when_they_are_recorded(self):
        bp = self.add(contact("c-bp", "BP Australia", "40337466735"))
        self.org["BankTransactions"] = [spend("e21", bp, day(12), 1480.0, account="449")]
        self.org["accounts"].append({"AccountID": "acc-275", "Code": "275", "Name": "Fuel Tax Credits", "Type": "OTHERINCOME",
                                     "Class": "REVENUE", "Status": "ACTIVE"})
        self.org["profit_and_loss"]["income"]["acc-275"] = 310.0
        self.overnight()
        self.assertFalse([i for i in self.items() if "CHK-131" in i["description"]])

    def test_a_suppliers_bill_coded_to_an_unusual_account(self):
        jm = self.add(contact("c-jm", "Jacaranda Marketing", "25671877382"))
        self.org["invoices"] += [doc("j%d" % i, "JM-1%02d" % i, jm, day(70 - 10 * i), 880.0, account="400", status="PAID",
                                     paid_on=day(68 - 10 * i)) for i in range(4)]
        self.org["invoices"].append(doc("j9", "JM-127", jm, day(8), 880.0, account="429"))
        self.overnight()
        line = next(l for l in self.open_item()["description"].split("\n") if "CHK-094" in l)
        self.assertIn("Jacaranda Marketing's expense is nearly always coded to 400 Advertising (4 of 5 lines)", line)
        self.assertIn("bill JM-127 → 429 General Expenses", line)
        self.assertIn("heuristic", line)

    def test_a_fixed_asset_account_with_no_depreciation_account(self):
        self.org["accounts"] += [
            {"AccountID": "acc-710", "Code": "710", "Name": "Office Equipment", "Type": "FIXED", "Class": "ASSET", "Status": "ACTIVE"},
            {"AccountID": "acc-720", "Code": "720", "Name": "Computer Equipment", "Type": "FIXED", "Class": "ASSET", "Status": "ACTIVE"},
            {"AccountID": "acc-721", "Code": "721", "Name": "Less Accumulated Depreciation on Computer Equipment", "Type": "FIXED",
             "Class": "ASSET", "Status": "ACTIVE"},
            {"AccountID": "acc-700", "Code": "700", "Name": "Land", "Type": "FIXED", "Class": "ASSET", "Status": "ACTIVE"}]
        self.org["trial_balance"] = {str(TODAY): {"acc-710": 8000.0, "acc-720": 5000.0, "acc-721": -1000.0, "acc-700": 90000.0}}
        self.overnight()
        lines = [l for l in self.open_item()["description"].split("\n") if "CHK-141" in l]
        self.assertEqual(len(lines), 1, lines)
        self.assertIn("Fixed asset account 710 Office Equipment has a balance of $8,000.00", lines[0])

    def test_one_general_depreciation_account_means_no_fixed_asset_account_finding(self):
        self.org["accounts"] += [
            {"AccountID": "acc-710", "Code": "710", "Name": "Office Equipment", "Type": "FIXED", "Class": "ASSET", "Status": "ACTIVE"},
            {"AccountID": "acc-711", "Code": "711", "Name": "Accumulated Depreciation", "Type": "FIXED", "Class": "ASSET", "Status": "ACTIVE"}]
        self.org["trial_balance"] = {str(TODAY): {"acc-710": 8000.0, "acc-711": -2000.0}}
        self.overnight()
        self.assertFalse([i for i in self.items() if "CHK-141" in i["description"]])

    def test_a_manual_look_back_finds_older_duplicates_and_stays_until_set_to_0(self):
        bayside = self.add(contact("c-bos", "Bayside Office Supplies", "93107930949"))
        self.org["invoices"] += [doc("b1", "BOS-0412", bayside, day(210), 462.0, status="PAID", paid_on=day(200)),
                                 doc("b2", "BOS-0412", bayside, day(203), 462.0, status="PAID", paid_on=day(196))]
        self.overnight()
        self.assertFalse([i for i in self.items() if "BOS-0412" in i["description"]], "older than the daily checks' 35 days")
        manual = {"kind": "manual", "actor_user_id": OWNER}
        run_flow(self.w, AUTOS[AUTO], manual, {"client_name": "Acme Plumbing", "look_back_months": "12"})
        desc = self.open_item()["description"]
        self.assertIn("CHK-080", desc)
        self.assertIn("**Looking back 12 months**", desc)
        self.overnight()
        self.assertIn("CHK-080", self.open_item()["description"], "the next night still looks back, so it stays open")
        run_flow(self.w, AUTOS[AUTO], manual, {"client_name": "Acme Plumbing", "look_back_months": "0"})
        self.assertNotIn("look_back_months", self.state())

    # ── behaviour checks: a contact's month or overdue documents against its own history ──
    def sale(self, doc_id, number, who, date, total, paid_after=None, due=None):
        """A sales invoice; paid_after: days after its date it was paid (None: still owed)."""
        if paid_after is None:
            return doc(doc_id, number, who, date, total, kind="ACCREC", account="200", tax_type="OUTPUT", sent=True,
                       due=due or plus(date, 30))
        return doc(doc_id, number, who, date, total, kind="ACCREC", account="200", tax_type="OUTPUT", sent=True,
                   due=plus(date, 30), status="PAID", paid_on=plus(date, paid_after))

    def test_a_month_far_above_a_customers_and_a_suppliers_usual(self):
        harbour = self.add(contact("c-hl", "Harbourline Logistics Pty Ltd", "71938570839"))
        ms = self.add(contact("c-ms", "Microsoft Australia Pty Ltd", "29002589460"))
        for k in (3, 2, 1):
            self.org["invoices"] += [self.sale("h%d" % k, "INV-10%d" % k, harbour, month_day(k), 4400.0, paid_after=15),
                                     doc("m%d" % k, "MS-%d" % k, ms, month_day(k), 660.0, account="489", status="PAID",
                                         paid_on=plus(month_day(k), 3))]
        self.org["invoices"] += [self.sale("h0", "INV-1052", harbour, month_day(0, 1), 39050.0, due=day(-30)),
                                 doc("m0", "MS-0", ms, month_day(0, 1), 1980.0, account="489", due=day(-30))]
        self.overnight()
        desc = self.open_item()["description"]
        line = next(l for l in desc.split("\n") if "CHK-036" in l)
        self.assertIn("Harbourline Logistics Pty Ltd was invoiced $39,050.00 in", line)
        self.assertIn("against a usual $4,400.00 a month (3 earlier months)", line)
        self.assertIn("Microsoft Australia Pty Ltd billed $1,980.00 in", next(l for l in desc.split("\n") if "CHK-082" in l))

    def test_an_overdue_invoice_from_a_customer_that_usually_pays_in_about_20_days(self):
        harbour = self.add(contact("c-hl", "Harbourline Logistics Pty Ltd", "71938570839"))
        self.org["invoices"] += [self.sale("h%d" % k, "INV-11%d" % k, harbour, day(60 + 30 * k), 3960.0, paid_after=20)
                                 for k in range(3)]
        self.org["invoices"].append(self.sale("h9", "INV-1003", harbour, day(274), 3960.0, due=day(244)))
        self.overnight()
        line = next(l for l in self.open_item()["description"].split("\n") if "CHK-037" in l)
        self.assertIn("Invoice INV-1003 to Harbourline Logistics Pty Ltd ($3,960.00) is 244 days overdue", line)
        self.assertIn("usually paid within about 20 days (3 paid)", line)

    def test_several_overdue_invoices_after_a_steady_history_are_one_finding(self):
        sunline = self.add(contact("c-ss", "Sunline Solar Pty Ltd", "27295289264"))
        self.org["invoices"] += [self.sale("s%d" % k, "INV-20%d" % k, sunline, day(140 + 30 * k), 3300.0, paid_after=20)
                                 for k in range(3)]
        self.org["invoices"] += [self.sale("s7", "INV-1032", sunline, day(107), 3564.0, due=day(77)),
                                 self.sale("s8", "INV-1037", sunline, day(77), 3960.0, due=day(47)),
                                 self.sale("s9", "INV-1042", sunline, day(47), 2750.0, due=day(17))]
        self.overnight()
        desc = self.open_item()["description"]
        line = next(l for l in desc.split("\n") if "CHK-038" in l)
        self.assertIn("3 invoices to Sunline Solar Pty Ltd ($10,274.00) are overdue (INV-1032 77 days, INV-1037 47 days, "
                      "INV-1042 17 days)", line)
        self.assertNotIn("CHK-037", desc, "grouped, not one finding each")

    def test_overdue_bills_from_suppliers_usually_paid_promptly(self):
        coastal = self.add(contact("c-cib", "Coastal Insurance Brokers Pty Ltd", "71014323325"))
        granite = self.add(contact("c-gpg", "Granite Property Group Pty Ltd", "76676336067"))
        self.org["invoices"].append(doc("c1", "CIB-2026-01", coastal, day(280), 3520.0, due=day(250), status="PAID", paid_on=day(265)))
        self.org["invoices"].append(doc("c2", "CIB-2026-07", coastal, day(98), 3520.0, due=day(68)))
        self.org["invoices"] += [doc("g%d" % k, "GPG-0%d" % k, granite, day(90 + 30 * k), 5500.0, due=day(83 + 30 * k),
                                     status="PAID", paid_on=day(85 + 30 * k)) for k in range(3)]
        self.org["invoices"] += [doc("g8", "GPG-08", granite, day(81), 5500.0, due=day(74)),
                                 doc("g9", "GPG-09", granite, day(51), 5500.0, due=day(44)),
                                 doc("g10", "GPG-10", granite, day(21), 5500.0, due=day(14))]
        self.overnight()
        desc = self.open_item()["description"]
        self.assertIn("Bill CIB-2026-07 from Coastal Insurance Brokers Pty Ltd ($3,520.00) is 68 days overdue",
                      next(l for l in desc.split("\n") if "CHK-083" in l))
        self.assertIn("3 bills from Granite Property Group Pty Ltd ($16,500.00) are overdue",
                      next(l for l in desc.split("\n") if "CHK-084" in l))

    def test_a_customer_that_pays_at_all_sorts_of_times_isnt_unusual(self):
        slow = self.add(contact("c-sl", "Slow Payers Pty Ltd", "33102417032"))
        self.org["invoices"] += [self.sale("p%d" % k, "INV-30%d" % k, slow, day(200 + 20 * k), 990.0, paid_after=after)
                                 for k, after in enumerate((15, 60, 90, 120))]
        self.org["invoices"].append(self.sale("p9", "INV-309", slow, day(150), 990.0, due=day(120)))
        self.overnight()
        self.assertFalse([i for i in self.items() if "CHK-037" in i["description"]])

    # ── the test register (a test company's made-up ABNs aren't on the register) ──
    def register_csv(self, cancelled_on):
        """The seed packs' "Registry fixture" tab saved as CSV: title lines, then the header, then one row per contact."""
        dmy = datetime.date.fromisoformat(cancelled_on).strftime("%d/%m/%Y")
        return ("﻿Registry fixture — ABR mock for the demo (agent configuration C12)\n"
                "Identical to the other packs\n"
                "Contact,ABN on record,Registry entity name,ABN status,GST registration,DGR,Checks\n"
                "Plumbing Supplies Co,51 824 753 556,Plumbing Supplies Co,Active,Registered,No,\n"
                "Gone Electrical,53 004 085 616,Gone Electrical Pty Ltd,Cancelled (" + dmy + "),Not registered,No,CHK-071\n"
                "Northbank Consulting,12 345 678 901,—,Not found (invalid checksum),—,No,CHK-004\n"
                "Hilltop Cleaning,,Hilltop Cleaning (sole trader),Active — found by name,Not registered,No,\n")

    def test_a_test_register_replaces_the_register_for_that_client_only(self):
        gone = self.add(contact("c-gone", "Gone Electrical", "53004085616"))
        self.add(contact("c-north", "Northbank Consulting", "12345678901"))
        self.org["invoices"].append(doc("g1", "GE-9", gone, day(10), 550.0))
        # The real register knows neither ABN, as with the seed packs' made-up ones.
        self.w.files["Bookkeeping/Test register/Acme Plumbing Pty Ltd.csv"] = self.register_csv(day(30))
        self.register_then_weekly()
        self.assertEqual(self.w.abr.calls, [], "a test company never reaches the register")
        cache = json.loads(self.w.files["Bookkeeping/Checks/acme-plumbing-abr.json"])
        self.assertEqual(cache["test_register"], "Bookkeeping/Test register/Acme Plumbing Pty Ltd.csv")
        self.assertEqual(cache["abns"]["53004085616"]["status_from"], day(30))
        self.assertTrue(cache["abns"]["51824753556"]["gst_registered"])
        desc = self.register_desc()
        self.assertIn("**Test register:**", desc)
        self.assertIn("Gone Electrical's ABN 53004085616 was cancelled on", desc)
        self.assertIn("Northbank Consulting (12345678901 fails the ABN checksum)", desc)
        for line in desc.split("\n"):
            if "CHK-071" in line or "CHK-004" in line:
                self.assertIn("(Test register, not the Australian Business Register.)", line)

    def test_deleting_the_test_register_goes_back_to_the_register(self):
        gone = self.add(contact("c-gone", "Gone Electrical", "53004085616"))
        self.org["invoices"].append(doc("g1", "GE-9", gone, day(10), 550.0))
        path = "Bookkeeping/Test register/Acme Plumbing.csv"
        self.w.files[path] = self.register_csv(day(30))
        self.register_then_weekly()
        self.assertIn("CHK-071", self.register_desc())
        del self.w.files[path]
        self.on_register("51824753556", "Plumbing Supplies Co")
        run_flow(self.w, AUTOS["Bookkeeping: Register lookups (ABR)"], {"kind": "schedule"}, {"client_name": ""})
        cache = json.loads(self.w.files["Bookkeeping/Checks/acme-plumbing-abr.json"])
        self.assertNotIn("test_register", cache)
        self.assertTrue(self.w.abr.calls, "the register is asked again")
        self.assertFalse(cache["abns"]["53004085616"]["found"], "the file's cancelled record is forgotten")
        self.assertEqual(cache["abns"]["51824753556"]["status"], "Active")

    def test_another_clients_test_register_is_ignored(self):
        self.on_register("51824753556", "Plumbing Supplies Co")
        self.w.files["Bookkeeping/Test register/Other Business.csv"] = self.register_csv(day(30))
        self.overnight()
        run_flow(self.w, AUTOS["Bookkeeping: Register lookups (ABR)"], {"kind": "schedule"}, {"client_name": ""})
        cache = json.loads(self.w.files["Bookkeeping/Checks/acme-plumbing-abr.json"])
        self.assertNotIn("test_register", cache)
        self.assertTrue(self.w.abr.calls)

    def test_register_lookups_rechecks_weekly_and_never_stores_the_digits_it_doesnt_need(self):
        self.on_register("51824753556", "Plumbing Supplies Co")
        self.overnight()
        lookups = AUTOS["Bookkeeping: Register lookups (ABR)"]
        run_flow(self.w, lookups, {"kind": "schedule"}, {"client_name": ""})
        run_flow(self.w, lookups, {"kind": "schedule"}, {"client_name": ""})
        self.assertEqual(len([c for c in self.w.abr.calls if c[0] == "abr_lookup_abns"]), 1, "fresh results aren't looked up again")
        cache = json.loads(self.w.files["Bookkeeping/Checks/acme-plumbing-abr.json"])
        self.assertEqual(cache["abns"]["51824753556"]["status"], "Active")
        self.assertNotIn("guid", json.dumps(cache).lower())

    def test_a_register_error_keeps_what_was_known_and_doesnt_count_as_fresh(self):
        self.on_register("51824753556", "Plumbing Supplies Co", status="Cancelled", status_from=day(400))
        self.overnight()
        lookups = AUTOS["Bookkeeping: Register lookups (ABR)"]
        run_flow(self.w, lookups, {"kind": "schedule"}, {"client_name": ""})
        path = "Bookkeeping/Checks/acme-plumbing-abr.json"
        cache = json.loads(self.w.files[path])
        cache["abns"]["51824753556"]["checked"] = day(10)
        cache["refreshed"] = day(10)
        self.w.files[path] = json.dumps(cache)
        real = self.w.abr.call
        self.w.abr.call = lambda tool, args: {"results": [{"abn": a, "valid_checksum": True, "found": False, "error": "ABR 503"}
                                                          for a in args.get("abns", [])]}
        run_flow(self.w, lookups, {"kind": "schedule"}, {"client_name": ""})
        cache = json.loads(self.w.files[path])
        self.assertEqual(cache["abns"]["51824753556"]["status"], "Cancelled", "an error row mustn't overwrite the record")
        self.assertEqual(cache["refreshed"], day(10), "a run that got nothing isn't fresh")
        self.w.abr.call = lambda tool, args: (_ for _ in ()).throw(RuntimeError("connector not connected"))
        run_flow(self.w, lookups, {"kind": "schedule"}, {"client_name": ""})
        self.assertEqual(json.loads(self.w.files[path])["refreshed"], day(10))
        self.w.abr.call = real

    def test_a_likely_abn_needs_every_word_of_the_name(self):
        self.on_register("51824753556", "Plumbing Supplies Co")
        harbour = self.add(contact("c-hb", "Harbour IT Solutions", ""))
        guild = self.add(contact("c-gu", "Guild Insurance", ""))
        self.org["invoices"] += [doc("h1", "H-1", harbour, day(6), 990.0), doc("g1", "G-1", guild, day(5), 880.0)]
        # What the real register returned on QA: a high score for a different business.
        self.w.abr.names["harbour it solutions"] = [{"abn": "26821202442", "name": "HARBOUR SOLUTIONS", "score": 98}]
        self.w.abr.names["guild insurance"] = [{"abn": "55004538863", "name": "GUILD INSURANCE LIMITED", "score": 99}]
        # Two different businesses scoring about the same: ambiguous, even though only one has every word.
        bright = self.add(contact("c-bs", "BrightSpark Electrical", ""))
        self.org["invoices"].append(doc("b9", "BS-1", bright, day(4), 660.0))
        self.w.abr.names["brightspark electrical"] = [
            {"abn": "30337043217", "name": "Brightspark Data and Electrical", "score": 97},
            {"abn": "11222333444", "name": "BRIGHT SPARKS CONTRACTING", "score": 96}]
        # A search made under the first rule is redone, not kept for a month.
        self.overnight()
        self.w.files["Bookkeeping/Checks/acme-plumbing-abr.json"] = json.dumps({"refreshed": day(1), "abns": {}, "names": {
            "harbour it solutions": {"name": "Harbour IT Solutions", "checked": day(1),
                                     "match": {"abn": "26821202442", "name": "HARBOUR SOLUTIONS", "score": 98}}}})
        self.register_then_weekly()
        line = next(l for l in self.open_item()["description"].split("\n") if "CHK-005" in l)
        self.assertIn("Guild Insurance → 55004538863 (GUILD INSURANCE LIMITED)", line)
        self.assertNotIn("HARBOUR SOLUTIONS", line)
        self.assertNotIn("Brightspark", line)

    def test_a_likely_abn_closes_once_added_and_stale_register_data_pauses_the_checks(self):
        self.on_register("51824753556", "Plumbing Supplies Co")
        zen = self.add(contact("c-zen", "Zenith IT", ""))
        self.org["invoices"].append(doc("z1", "Z-1", zen, day(6), 1100.0))
        self.w.abr.names["zenith it"] = [{"abn": "53004085616", "name": "ZENITH IT PTY LTD", "score": 99}]
        self.register_then_weekly()
        self.assertIn("CHK-005", self.open_item()["description"])
        zen["TaxNumber"] = "53004085616"
        self.on_register("53004085616", "Zenith IT")
        self.register_then_weekly()
        self.assertFalse(any(f["check"] == "CHK-005" for f in self.state().get("findings", {}).values()))
        self.assertEqual([i for i in self.items() if i["status"] != "done"], [], "nothing left open: the item completed")
        # Register lookups stops: a fortnight later the register checks close and the checklist says they're paused.
        gone = self.add(contact("c-gone", "Gone Electrical", "33102417032"))
        self.on_register("33102417032", "Gone Electrical", status="Cancelled", status_from=day(30))
        self.org["invoices"].append(doc("g1", "GE-9", gone, day(10), 550.0))
        self.register_then_weekly()
        self.assertIn("CHK-071", self.open_item()["description"])
        path = "Bookkeeping/Checks/acme-plumbing-abr.json"
        cache = json.loads(self.w.files[path])
        cache["refreshed"] = day(20)
        self.w.files[path] = json.dumps(cache)
        state = self.state()
        state["last_daily"], state["last_weekly"] = day(1), day(8)
        self.w.files["Bookkeeping/Checks/acme-plumbing.json"] = json.dumps(state)
        self.org["lock_date"] = None  # keep one ordinary finding open, so the checklist is there to read
        self.overnight()
        self.assertFalse(any(f["check"] == "CHK-071" for f in self.state().get("findings", {}).values()))
        self.assertTrue(self.state()["snapshot"]["register_paused"])
        self.assertIn("Register checks (cancelled ABNs, GST registration, DGR) are paused", self.open_item()["description"])

    def test_no_gst_status_check_for_a_client_not_registered_for_gst(self):
        self.client["gst_registered"] = False
        self.save_client()
        self.on_register("51824753556", "Plumbing Supplies Co")
        self.org["invoices"] += [doc("p1", "PS-2", self.supplies, day(6), 110.0, tax=0), doc("p2", "PS-3", self.supplies, day(4), 220.0, tax=0)]
        self.register_then_weekly()
        self.assertFalse(any(f["check"] == "CHK-003" for f in self.state().get("findings", {}).values()))

    # ── drafts, batch payments and GST on non-GST accounts (decision D9: the buildable release-1 checks) ──
    def drafts_and_batches(self):
        who = {"ContactID": self.supplies["ContactID"], "Name": self.supplies["Name"]}
        self.org["Quotes"] = [{"QuoteID": "q1", "QuoteNumber": "QU-0007", "Contact": who, "DateString": day(9) + "T00:00:00", "Total": 1100.0, "Status": "DRAFT"},
                              {"QuoteID": "q2", "QuoteNumber": "QU-0008", "Contact": who, "DateString": day(9) + "T00:00:00", "Total": 500.0, "Status": "ACCEPTED"}]
        self.org["PurchaseOrders"] = [{"PurchaseOrderID": "po1", "PurchaseOrderNumber": "PO-0003", "Contact": who, "DateString": day(4) + "T00:00:00", "Total": 770.0, "Status": "SUBMITTED"}]
        self.org["BatchPayments"] = [{"BatchPaymentID": "bp1", "DateString": day(3) + "T00:00:00", "Reference": "Supplier run #12", "Details": "Café rent",
                                      "TotalAmount": 1430.0, "Status": "AUTHORISED", "Payments": [{"Details": "rent_oct"}]},
                                     {"BatchPaymentID": "bp2", "DateString": day(3) + "T00:00:00", "Reference": "Wages (Oct) 2/3", "TotalAmount": 900.0,
                                      "Status": "AUTHORISED", "Payments": []}]
        self.org["accounts"].append({"AccountID": "acc-485", "Code": "485", "Name": "Overseas Subscriptions", "Type": "EXPENSE", "Class": "EXPENSE",
                                     "Status": "ACTIVE", "TaxType": "EXEMPTEXPENSES"})
        self.org["profit_and_loss"]["expenses"]["acc-485"] = 1.0
        self.org["invoices"] += [doc("b-draft", "D-1", self.supplies, day(3), 220.0, status="DRAFT"),
                                 doc("b-gst", "OS-9", self.supplies, day(6), 110.0, account="485"),
                                 doc("i-draft", "INV-300", self.supplies, day(2), 330.0, kind="ACCREC", status="DRAFT", account="200", tax_type="OUTPUT")]

    def test_drafts_batch_payment_text_and_gst_on_a_non_gst_account(self):
        self.drafts_and_batches()
        steps = self.overnight()
        self.assertEqual(steps["run_checks"]["outputs"]["summary"]["errors"], [])
        desc = self.open_item()["description"]
        line = lambda check: next(l for l in desc.split("\n") if check in l)
        self.assertIn("1 quote(s) are still in draft (QU-0007)", line("CHK-040"))
        self.assertIn("1 purchase order(s) are in draft or awaiting approval (PO-0003)", line("CHK-093"))
        self.assertIn("1 bill(s) are in draft or awaiting approval (Plumbing Supplies Co)", line("CHK-078"))
        self.assertIn("1 batch payment(s) have text a bank's direct-entry file may reject", line("CHK-016"))
        for ch in ("#", "é", "_"):
            self.assertIn(ch, line("CHK-016"))
        self.assertIn("to be confirmed", line("CHK-016"))
        self.assertIn("GST on 1 line(s) coded to 485 Overseas Subscriptions, whose tax rate (EXEMPTEXPENSES) has no GST", line("CHK-137"))
        # A merged catalogue check rides on the finding that covers it.
        findings = self.state()["findings"]
        self.assertEqual(next(f for f in findings.values() if f["check"] == "CHK-033")["also"], ["CHK-032"])
        self.assertEqual(next(f for f in findings.values() if f["check"] == "CHK-040")["also"], [])

    def test_a_list_xero_wont_share_keeps_its_findings_until_it_can_be_read(self):
        self.drafts_and_batches()
        self.overnight()
        self.assertIn("CHK-093", self.open_item()["description"])
        self.org["PurchaseOrders"] = None  # the connection loses access to purchase orders
        state = self.state()
        state["last_weekly"] = day(8)
        self.w.files["Bookkeeping/Checks/acme-plumbing.json"] = json.dumps(state)
        steps = self.overnight()
        self.assertEqual(steps["run_checks"]["outputs"]["summary"]["errors"], [])
        po = next(f for f in self.state()["findings"].values() if f["check"] == "CHK-093")
        self.assertEqual(po["status"], "open", "not read this week, so not resolved either")
        self.assertIn("CHK-040", self.open_item()["description"])

    # ── fixed asset checks (Asset lookups saves the Xero Assets register, Ledger checks reads it) ──
    def assets_setup(self):
        self.org["accounts"] += [{"AccountID": "acc-710", "Code": "710", "Name": "Office Equipment", "Type": "FIXED", "Class": "ASSET", "Status": "ACTIVE"},
                                 {"AccountID": "acc-720", "Code": "720", "Name": "Motor Vehicles", "Type": "FIXED", "Class": "ASSET", "Status": "ACTIVE"},
                                 {"AccountID": "acc-730", "Code": "730", "Name": "Furniture", "Type": "FIXED", "Class": "ASSET", "Status": "ACTIVE"}]
        self.org["trial_balance"] = {str(TODAY): {"acc-710": 5000.0, "acc-720": 12000.0}}
        self.w.assets.assets[T] = [{"assetId": "a1", "assetName": "Laptop", "assetNumber": "FA-0001", "assetStatus": "Draft",
                                    "purchasePrice": 2200.0, "purchaseDate": day(20) + "T00:00:00"},
                                   {"assetId": "a2", "assetName": "Van", "assetNumber": "FA-0002", "assetStatus": "Registered",
                                    "purchasePrice": 30000.0, "purchaseDate": day(200) + "T00:00:00"}]
        self.w.assets.types[T] = [{"assetTypeId": "t1", "assetTypeName": "Computers", "fixedAssetAccountId": "acc-710"}]

    def test_asset_lookups_feed_the_fixed_asset_checks(self):
        self.assets_setup()
        lookups = run_flow(self.w, AUTOS["Bookkeeping: Asset lookups (Xero Assets)"], {"kind": "schedule"}, {"client_name": ""})
        self.assertEqual(lookups["refresh_assets"]["outputs"]["summary"]["errors"], [])
        saved = json.loads(self.w.files["Bookkeeping/Checks/acme-plumbing-assets.json"])
        self.assertEqual([a["name"] for a in saved["draft"]], ["Laptop"])
        self.assertEqual(saved["type_accounts"], ["acc-710"])
        self.assertTrue(all(c[1].get("xero_tenant_id") == T for c in self.w.assets.calls), "the client's own organisation")
        self.overnight()
        desc = self.open_item()["description"]
        self.assertIn("1 fixed asset(s) are still in draft in Xero (Laptop)", desc)
        self.assertIn("Fixed asset account 720 Motor Vehicles has a balance of $12,000.00, but no asset type", desc)
        self.assertNotIn("710 Office Equipment", desc, "its asset type uses it")
        self.assertNotIn("730 Furniture", desc, "no balance")

    def test_no_asset_lookups_means_no_fixed_asset_checks(self):
        self.assets_setup()
        self.overnight()
        self.assertEqual([f for f in (self.state().get("findings") or {}).values() if f["check"] in ("CHK-139", "CHK-140")], [])

    def test_checks_only_read_xero(self):
        self.duplicate_bills()
        self.overnight()
        self.assertEqual(self.w.xero.writes, [])

    def test_empty_form_answers_change_nothing(self):
        self.duplicate_bills()
        self.overnight()
        before = json.dumps(self.w.items, sort_keys=True)
        self.submit(self.open_item()["id"], {})
        self.assertEqual(json.dumps(self.w.items, sort_keys=True), before)


class IntakeChecks(Base):
    """The catalogue checks Process bill runs on the PDF it already reads: warnings tagged with their IDs, never blocks."""

    def record(self):
        return json.loads(self.w.files["Bookkeeping/Bills/" + self.review_item()["id"] + ".json"])

    def test_bank_details_on_the_pdf_differ_from_the_contact(self):
        self.setup_practice()
        c = self.add_supplier(T_ACME, history_code="449")
        c["BankAccountDetails"] = "062-000 1111 2222"
        self.invoice.update(pay_bsb="062-000", pay_account="3333 4444")
        self.drop()
        desc = self.review_item()["description"]
        self.assertNotIn("4444", desc)
        self.assertIn("[CHK-020]", desc)
        self.assertEqual(self.record()["checks"], ["CHK-020"])
        self.assertEqual(self.record()["blocking"], [])

    def test_new_supplier_with_bank_details_only_on_the_invoice(self):
        self.setup_practice()
        self.invoice.update(pay_bsb="062000", pay_account="55556666")
        self.drop()
        self.assertIn("[CHK-060]", self.review_item()["description"])
        # A bill from a supplier Xero doesn't know is also the catalogue's CHK-073 (merged into this warning).
        self.assertIn("isn't in Xero yet. The contact is created when you approve. [CHK-073]", self.review_item()["description"])
        self.assertIn("CHK-073", self.record()["checks"])

    def test_abn_on_the_pdf_differs_from_the_contact(self):
        self.setup_practice()
        self.add_supplier(T_ACME, abn="53004085616", history_code="449")
        self.drop()
        self.assertIn("isn't the ABN on Sparky Electrical Pty Ltd in Xero (53004085616). Check it's the same business before "
                      "approving. [CHK-089]", self.review_item()["description"])

    def test_more_than_one_abn_on_the_pdf(self):
        self.setup_practice()
        self.add_supplier(T_ACME, history_code="449")
        self.invoice["abns_printed"] = ["51 824 753 556", "53 004 085 616"]
        self.drop()
        self.assertIn("[CHK-091]", self.review_item()["description"])

    def test_same_file_twice_and_a_new_abn_for_a_known_supplier(self):
        self.setup_practice()
        self.add_supplier(T_ACME, history_code="449")
        pdf = make_pdf(INVOICE_TEXT)  # one copy: the PDF embeds the time it was made
        self.drop(data=pdf)
        index = json.loads(self.w.files["Bookkeeping/Checks/acme-plumbing-intake.json"])
        self.assertEqual(len(index["files"]), 1)
        self.assertEqual(index["abns"]["contact-sparky"], ["51824753556"])
        first = self.review_item()["id"]
        self.w.items[first]["labels"] = ["done"]
        self.invoice.update(invoice_number="INV-1002", supplier_abn="53 004 085 616")
        self.drop(name="INV-1002.pdf", data=pdf)
        desc = self.review_item()["description"]
        self.assertIn("This exact file was processed before", desc)
        self.assertIn("[CHK-130]", desc)

    def test_gst_on_the_pdf_but_coded_gst_free_and_the_reverse(self):
        self.setup_practice()
        self.add_supplier(T_ACME)
        self.coding = [{"index": 0, "account_code": "449", "tax_type": "EXEMPTEXPENSES", "reason": "x", "confidence": "high"}]
        self.drop()
        self.assertIn("[CHK-092]", self.review_item()["description"])

    def test_no_gst_on_the_pdf_but_coded_with_gst(self):
        self.setup_practice()
        self.add_supplier(T_ACME)
        self.invoice.update(tax_total=0, total=400.0, lines=[{"description": "Fuse", "quantity": 1, "unit_amount": 400.0,
                                                              "line_amount": 400.0, "tax_amount": 0}])
        self.drop()
        self.assertIn("[CHK-124]", self.review_item()["description"])

    def test_review_item_links_open_the_clients_own_xero_org(self):
        self.setup_practice()
        self.w.xero.orgs[T_ACME]["short_code"] = "!Zz9Q"
        self.add_supplier(T_ACME, history_code="449")
        self.drop()
        self.assertIn("(https://go.xero.com/organisationlogin/default.aspx?shortcode=!Zz9Q&redirecturl=/AccountsPayable/Edit.aspx?InvoiceID=",
                      self.review_item()["description"])

    def test_register_results_flag_a_cancelled_or_unregistered_abn_at_intake(self):
        self.setup_practice()
        self.add_supplier(T_ACME, history_code="449")
        self.w.files["Bookkeeping/Checks/acme-plumbing-abr.json"] = json.dumps({"refreshed": "2026-10-01", "abns": {
            "51824753556": {"found": True, "status": "Cancelled", "status_from": "2026-01-01", "gst_from": None, "gst_to": None}}})
        self.drop()
        desc = self.review_item()["description"]
        self.assertIn("as cancelled since 2026-01-01", desc)
        self.assertIn("[CHK-002]", desc)
        self.assertIn("[CHK-085]", desc)
        self.assertEqual(self.record()["blocking"], [], "register checks are warnings, never blocks")

    def test_a_clean_bill_raises_no_intake_checks(self):
        self.setup_practice()
        self.add_supplier(T_ACME, history_code="449")
        self.drop()
        self.assertEqual(self.record()["checks"], [])


if __name__ == "__main__":
    unittest.main()
