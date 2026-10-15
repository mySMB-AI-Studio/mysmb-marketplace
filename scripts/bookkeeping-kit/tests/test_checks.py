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
        for text in ("Acme Plumbing", "Client queries", "CHK-055"):
            self.assertIn(text, page)
        self.assertEqual(self.w.notifications[0]["user_ids"], [OWNER])
        self.overnight()
        self.assertEqual(len(self.w.artifacts), 1)

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

    def test_no_clients_set_up_says_so(self):
        del self.w.files["Bookkeeping/Clients/acme-plumbing.json"]
        steps = self.overnight()
        self.assertIn("No client business has ledger checks on", steps["run_checks"]["outputs"]["problem"])

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

    def test_a_clean_bill_raises_no_intake_checks(self):
        self.setup_practice()
        self.add_supplier(T_ACME, history_code="449")
        self.drop()
        self.assertEqual(self.record()["checks"], [])


if __name__ == "__main__":
    unittest.main()
