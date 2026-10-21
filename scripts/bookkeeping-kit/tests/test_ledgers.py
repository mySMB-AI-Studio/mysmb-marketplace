"""Bookkeeping checks for MYOB and QuickBooks: the checks-only packs end to end, on a fake workspace + fake ledgers."""
import datetime
import json
import os
import re
import sys
import unittest
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(__file__))
from harness import World, run_flow  # noqa: E402

PLUGINS = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "plugins"))
TODAY = datetime.datetime.now(ZoneInfo("Australia/Sydney")).date()
OWNER = "user-checks-owner"
BOOKKEEPER = "user-bookkeeper"


def load_pack(slug):
    plugin = os.path.join(PLUGINS, slug)
    manifest = json.load(open(os.path.join(plugin, ".claude-plugin", "plugin.json"), encoding="utf-8"))
    autos, forms = {}, {}
    for rel in manifest["content"]["automations"]:
        p = json.load(open(os.path.join(plugin, rel), encoding="utf-8"))
        autos[p["name"]] = p
    for rel in manifest["content"]["forms"]:
        p = json.load(open(os.path.join(plugin, rel), encoding="utf-8"))
        forms[p["title"]] = p
    return autos, forms


PACKS = {slug: load_pack(slug) for slug in ("bookkeeping-myob", "bookkeeping-quickbooks")}


def day(n):
    """n days ago, as YYYY-MM-DD."""
    return str(TODAY - datetime.timedelta(days=n))


def last_month_day():
    return str((TODAY.replace(day=1) - datetime.timedelta(days=1)).replace(day=10))


class PackBase(unittest.TestCase):
    SLUG, LEDGER = "", ""

    def setUp(self):
        self.w = World()
        self.autos, self.forms = PACKS[self.SLUG]
        self.w.files["Bookkeeping/settings.json"] = json.dumps({"version": 1, "timezone": "Australia/Sydney", "checks_owner_id": OWNER})

    def auto(self, short):
        return self.autos["Bookkeeping: " + short + " (" + self.LEDGER + ")"]

    def source_id(self, auto, form_title):
        origin = self.forms[form_title]["originKey"]
        return next(d["sourceId"] for d in auto["dependencies"] if d["originKey"] == origin)

    def submit(self, auto, form_title, todo_id, responses):
        trigger = {"kind": "event", "actor_user_id": BOOKKEEPER,
                   "event": {"eventType": "form.response_submitted",
                             "subject": {"form_id": self.source_id(auto, form_title), "todo_id": todo_id},
                             "payload": {"responses": responses}}}
        return run_flow(self.w, auto, trigger)

    def save_client(self, client):
        self.w.files["Bookkeeping/Clients/" + client["slug"] + ".json"] = json.dumps(client)

    def check_now(self, name=""):
        return run_flow(self.w, self.auto("Ledger checks"), {"kind": "manual", "actor_user_id": OWNER}, {"client_name": name})

    def overnight(self):
        return run_flow(self.w, self.auto("Ledger checks"), {"kind": "schedule"}, {"client_name": ""})

    def items(self):
        return [i for i in self.w.items.values() if "checks" in i["labels"]]

    def open_item(self):
        rows = [i for i in self.items() if i["status"] != "done"]
        self.assertEqual(len(rows), 1, [i["title"] for i in rows])
        return rows[0]

    def lines(self, item, check):
        return [l for l in item["description"].split("\n") if l.startswith("- [ ]") and check in l]


# ── MYOB ─────────────────────────────────────────────────────────────────────
def card(uid, name, kind="Supplier", abn="", address=True):
    return {"UID": uid, "Type": kind, "CompanyName": name, "IsActive": True, "_abn": abn,
            "Addresses": [{"Street": "1 Main St" if address else "", "City": ""}]}


def mdoc(uid, number, who, date, total, kind="bill", status="Open", account="a-repairs", code="GST", delivery="Nothing"):
    tax = round(total / 11, 2) if code == "GST" else 0.0
    return {"UID": uid, "kind": kind, "Number": number, "Date": date, "Status": status, "card": who, "Total": total, "TotalTax": tax,
            "Balance": total if status == "Open" else 0.0, "Delivery": delivery, "IsTaxInclusive": True,
            "Lines": [{"Total": total, "TaxCode": code, "Account": account}]}


class Myob(PackBase):
    SLUG, LEDGER = "bookkeeping-myob", "MYOB"

    def setUp(self):
        super().setUp()
        self.file = self.w.myob.add_file("file-acme", "Acme Plumbing Pty Ltd")
        self.w.myob.add_file("file-beta", "Beta Cafe")
        self.supplies = card("c-supplies", "Plumbing Supplies Co", abn="51 824 753 556")
        self.file["cards"].append(self.supplies)
        self.file["docs"].append(mdoc("b-ok", "PS-1", self.supplies, day(5), 330.0, status="Closed"))
        self.client = {"version": 1, "slug": "acme-plumbing", "name": "Acme Plumbing", "ledger": "myob",
                       "myob_company_file_id": "file-acme", "myob_file_name": "Acme Plumbing Pty Ltd", "gst_registered": True}
        self.save_client(self.client)

    def spend(self, uid, who, date, total, account="a-supplies", code="GST", reconciled=True):
        acc = next(a for a in self.file["accounts"] if a["UID"] == account)
        self.file["spend"].append({"UID": uid, "Date": date + "T00:00:00", "Contact": {"UID": who["UID"], "Name": who["CompanyName"], "Type": who["Type"]},
                                   "AmountPaid": total, "IsTaxInclusive": True, "TotalTax": round(total / 11, 2) if code == "GST" else 0.0,
                                   "Memo": "", "Lines": [{"Account": {"UID": account, "DisplayID": acc["DisplayID"]}, "TaxCode": {"Code": code}, "Amount": total}]})
        self.file["journals"].append({"UID": "j-" + uid, "DateOccurred": date + "T00:00:00", "JournalType": "CashPayment",
                                      "SourceTransaction": {"UID": uid, "TransactionType": "SpendMoneyTxn"},
                                      "Lines": [{"Account": {"UID": "a-bank"}, "Amount": total, "IsCredit": True,
                                                 "ReconciledDate": (date + "T00:00:00") if reconciled else None},
                                                {"Account": {"UID": account}, "Amount": total, "IsCredit": False}]})

    # ── setup ──
    def test_setup_forms_keep_xeros_settings_and_find_the_company_file(self):
        self.w.files["Bookkeeping/settings.json"] = json.dumps({"version": 1, "ledger": "xero", "reviewer_id": "user-reviewer",
                                                                "approved_status": "SUBMITTED"})
        steps = run_flow(self.w, self.auto("Start checks setup"), {"kind": "manual", "actor_user_id": BOOKKEEPER}, {"client_names": "Acme Plumbing"})
        # Bookkeeping is set up already (by Bookkeeping for Xero), so only the client's item is made.
        self.assertEqual(steps["start_checks"]["outputs"]["created_count"], 1)
        item = next(i for i in self.w.items.values() if i["title"] == "Checks settings for Acme Plumbing")
        self.assertIn("Client checks settings (MYOB)", item["description"])
        apply = self.auto("Apply checks setup")
        del self.w.files["Bookkeeping/Clients/acme-plumbing.json"]
        out = self.submit(apply, "Client checks settings (MYOB)", item["id"], {
            "q_client_name": "Acme Plumbing", "q_file": "acme plumbing", "q_gst": True, "q_tpar": True, "q_suspense": "9-9999"})
        self.assertEqual(out["apply_checks"]["outputs"]["outcome"], "client_saved")
        client = json.loads(self.w.files["Bookkeeping/Clients/acme-plumbing.json"])
        self.assertEqual((client["ledger"], client["myob_company_file_id"], client["myob_file_name"]), ("myob", "file-acme", "Acme Plumbing Pty Ltd"))
        self.assertTrue(client["checks_enabled"] and client["tpar"] and client["gst_registered"])
        self.assertEqual(client["suspense_codes"], ["9-9999"])
        self.assertEqual(self.w.items[item["id"]]["status"], "done")
        # The setup form only changes the checks' own settings.
        run_flow(self.w, self.auto("Start checks setup"), {"kind": "manual", "actor_user_id": BOOKKEEPER})
        self.w.files.pop("Bookkeeping/settings.json")
        run_flow(self.w, self.auto("Start checks setup"), {"kind": "manual", "actor_user_id": BOOKKEEPER})
        setup = next(i for i in self.w.items.values() if i["title"] == "Set up Bookkeeping checks for MYOB")
        self.w.files["Bookkeeping/settings.json"] = json.dumps({"version": 1, "reviewer_id": "user-reviewer", "approved_status": "SUBMITTED"})
        self.submit(apply, "Bookkeeping checks setup", setup["id"], {"q_checks_owner": {"id": OWNER, "label": "Checks Owner"}})
        settings = json.loads(self.w.files["Bookkeeping/settings.json"])
        self.assertEqual((settings["checks_owner_id"], settings["reviewer_id"], settings["approved_status"]), (OWNER, "user-reviewer", "SUBMITTED"))
        self.assertIn("Ledger checks (MYOB)", self.w.items[setup["id"]]["comments"][-1])

    def test_a_company_file_that_isnt_there_or_a_xero_client_isnt_saved(self):
        apply = self.auto("Apply checks setup")
        self.w.items["t1"] = {"id": "t1", "title": "Checks settings for Gamma", "status": "not_started", "labels": [], "comments": [], "description": ""}
        out = self.submit(apply, "Client checks settings (MYOB)", "t1", {"q_client_name": "Gamma Joinery", "q_file": "Gamma Joinery", "q_gst": True})
        self.assertEqual(out["apply_checks"]["outputs"]["outcome"], "file_not_found")
        self.assertIn("Acme Plumbing Pty Ltd, Beta Cafe", self.w.items["t1"]["comments"][-1])
        self.assertNotEqual(self.w.items["t1"]["status"], "done")
        self.save_client({"version": 1, "slug": "beta-cafe", "name": "Beta Cafe", "xero_tenant_id": "tenant-beta", "xero_org_name": "Beta Cafe"})
        out = self.submit(apply, "Client checks settings (MYOB)", "t1", {"q_client_name": "Beta Cafe", "q_file": "Beta Cafe", "q_gst": True})
        self.assertEqual(out["apply_checks"]["outputs"]["outcome"], "other_ledger")
        self.assertIn("already set up as a Xero client", self.w.items["t1"]["comments"][-1])
        self.assertIn("xero_tenant_id", self.w.files["Bookkeeping/Clients/beta-cafe.json"])

    # ── the overnight checks ──
    def test_a_clean_file_raises_nothing_and_reads_only_the_clients_own_file(self):
        steps = self.overnight()
        self.assertEqual(steps["run_checks"]["outputs"]["summary"]["errors"], [])
        self.assertEqual(self.items(), [])
        state = json.loads(self.w.files["Bookkeeping/Checks/acme-plumbing.json"])
        self.assertEqual(state["last_weekly"], str(TODAY))
        self.assertIn("CHK-086", state["na"])
        for tool, args in self.w.myob.calls:
            if tool != "list_company_files":
                self.assertEqual(args.get("myob_company_file_id"), "file-acme", tool)

    def test_duplicate_bills_open_a_checks_item_that_says_what_isnt_checked(self):
        sparky = card("c-sparky", "Sparky Electrical Pty Ltd", abn="53004085616")
        self.file["cards"].append(sparky)
        self.file["docs"] += [mdoc("b1", "INV-7", sparky, day(10), 440.0), mdoc("b2", "INV-7", sparky, day(7), 440.0)]
        self.overnight()
        item = self.open_item()
        self.assertEqual(item["title"], "Checks: Acme Plumbing")
        self.assertIn("(MYOB: Acme Plumbing Pty Ltd)", item["description"])
        self.assertIn("Fix each one in MYOB", item["description"])
        self.assertTrue(self.lines(item, "CHK-079"))
        # CHK-002 reads bill PDFs, which only Bookkeeping for Xero's bill intake reads.
        self.assertIn("Not checked, as MYOB's API doesn't give what they need: CHK-002, CHK-016, CHK-017", item["description"])
        # Bills carry no attachment flag in MYOB: never a "nothing attached" finding.
        self.assertFalse(self.lines(item, "CHK-086"))
        self.assertNotIn("Open in", item["description"])

    def test_weekly_checks_read_myobs_records(self):
        nofile = card("c-noabn", "Cash Handyman", abn="")
        customer = card("c-bayview", "Bayview Hospitality", kind="Customer")
        self.file["cards"] += [nofile, customer]
        # Unsent: an approved invoice still waiting to be emailed.
        self.file["docs"].append(mdoc("i1", "00000123", customer, last_month_day(), 990.0, kind="invoice", account="a-sales", delivery="Email"))
        # GST claimed from a supplier with no ABN, and on bank fees; one spend money not reconciled.
        self.spend("s1", nofile, last_month_day(), 550.0, account="a-supplies", reconciled=False)
        self.spend("s2", self.supplies, last_month_day(), 22.0, account="a-fees", code="GST")
        self.overnight()
        item = self.open_item()
        self.assertIn("never sent from MYOB (00000123)", self.lines(item, "CHK-024")[0])
        self.assertIn("supplier(s) with no ABN in MYOB: Cash Handyman", self.lines(item, "CHK-008")[0])
        self.assertIn("coded to 6-2000 Bank Fees", self.lines(item, "CHK-058")[0])
        self.assertIn("1 bank transaction(s)", self.lines(item, "CHK-022")[0])
        self.assertIn("Bank feed lines not yet coded", self.lines(item, "CHK-022")[0])

    def test_tpar_uses_the_supplier_payment_as_the_paid_date(self):
        self.client["tpar"] = True
        self.save_client(self.client)
        builder = card("c-build", "Builder Bob", abn="", address=False)
        self.file["cards"].append(builder)
        self.file["docs"].append(mdoc("b-bob", "BB-1", builder, day(20), 1100.0, status="Closed"))
        self.overnight()
        self.assertFalse([i for i in self.items() if "CHK-007" in i["description"]])
        self.file["payments"].append({"UID": "p1", "Date": day(15) + "T00:00:00", "Lines": [{"Type": "Bill", "Purchase": {"UID": "b-bob"}, "AmountApplied": 1100.0}]})
        state = json.loads(self.w.files["Bookkeeping/Checks/acme-plumbing.json"])
        state["last_daily"] = state["last_weekly"] = day(8)
        self.w.files["Bookkeeping/Checks/acme-plumbing.json"] = json.dumps(state)
        self.overnight()
        self.assertIn("Builder Bob", self.lines(self.open_item(), "CHK-007")[0])

    def test_a_myob_error_is_reported_not_taken_as_a_clean_file(self):
        self.w.myob.errors["list_bill_lines"] = "MYOB API 503: service unavailable"
        steps = self.overnight()
        errors = steps["run_checks"]["outputs"]["summary"]["errors"]
        self.assertTrue(errors and "MYOB says: MYOB API 503" in errors[0], errors)
        self.assertEqual(self.items(), [])

    def test_xero_and_myob_clients_side_by_side(self):
        self.save_client({"version": 1, "slug": "beta-cafe", "name": "Beta Cafe", "xero_tenant_id": "tenant-beta", "xero_org_name": "Beta Cafe"})
        # A recent Bookkeeping for Xero report doesn't hold up this pack's own.
        self.w.files["Bookkeeping/Checks/_report.json"] = json.dumps({"on": str(TODAY), "url": "x"})
        steps = self.overnight()
        self.assertEqual([c["client"] for c in steps["run_checks"]["outputs"]["summary"]["checked"]], ["Acme Plumbing"])
        self.assertNotIn("Bookkeeping/Checks/beta-cafe.json", self.w.files)
        self.assertEqual([a["title"] for a in self.w.artifacts], ["Ledger checks (MYOB) " + str(TODAY)])
        self.assertIn("Bookkeeping/Checks/_report-myob.json", self.w.files)
        self.assertIn("Generated by Bookkeeping checks for MYOB.", self.w.artifacts[0]["content"])

    def test_register_lookups_take_only_myob_clients(self):
        self.save_client({"version": 1, "slug": "beta-cafe", "name": "Beta Cafe", "xero_tenant_id": "tenant-beta", "xero_org_name": "Beta Cafe"})
        self.overnight()
        self.w.abr.records["51824753556"] = {"entity_name": "PLUMBING SUPPLIES CO PTY LTD", "status": "Active", "gst_registered": True, "gst_from": "2000-07-01"}
        steps = run_flow(self.w, self.autos["Bookkeeping: Register lookups (ABR, MYOB)"], {"kind": "schedule"}, {"client_name": ""})
        self.assertEqual([c["client"] for c in steps["refresh_register"]["outputs"]["summary"]["clients"]], ["Acme Plumbing"])
        self.assertIn("51824753556", json.loads(self.w.files["Bookkeeping/Checks/acme-plumbing-abr.json"])["abns"])


# ── QuickBooks ───────────────────────────────────────────────────────────────
    def test_customer_payments_give_the_overdue_checks_their_history(self):
        harbour = card("c-hl", "Harbourline Logistics Pty Ltd", kind="Customer")
        self.file["cards"].append(harbour)
        for k in range(3):
            self.file["docs"].append(mdoc("hi%d" % k, "0000010%d" % k, harbour, day(30 + 20 * k), 3960.0, kind="invoice",
                                          status="Closed", account="a-sales", delivery="Email"))
            self.file["receipts"].append({"UID": "r%d" % k, "Date": day(10 + 20 * k) + "T00:00:00",
                                          "Invoices": [{"UID": "hi%d" % k, "Number": "0000010%d" % k, "Type": "Invoice"}]})
        late = mdoc("hi9", "00000099", harbour, day(274), 3960.0, kind="invoice", account="a-sales", delivery="Email")
        late["Due"] = day(244)
        self.file["docs"].append(late)
        self.overnight()
        line = self.lines(self.open_item(), "CHK-037")[0]
        self.assertIn("Invoice 00000099 to Harbourline Logistics Pty Ltd ($3,960.00) is 244 days overdue", line)
        self.assertIn("usually paid within about 20 days (3 paid)", line)


def qvendor(vid, name, address=True):
    return {"Id": vid, "DisplayName": name, "Active": True, "BillAddr": {"Line1": "1 Main St"} if address else {}}


def qtax(net, code):
    tax = round(net * 0.1, 2) if code == "4" else 0.0
    return tax, {"TotalTax": tax, "TaxLine": [{"Amount": tax, "DetailType": "TaxLineDetail", "TaxLineDetail": {
        "TaxRateRef": {"value": "r-gst-p" if code == "4" else "r-free"}, "NetAmountTaxable": net, "TaxPercent": 10 if code == "4" else 0}}]}


def qbill(bid, number, vendor, date, net, account="57", code="4", paid=False):
    tax, detail = qtax(net, code)
    return {"Id": bid, "DocNumber": number, "TxnDate": date, "DueDate": date, "VendorRef": {"value": vendor["Id"], "name": vendor["DisplayName"]},
            "TotalAmt": round(net + tax, 2), "Balance": 0 if paid else round(net + tax, 2), "TxnTaxDetail": detail,
            "Line": [{"Amount": net, "DetailType": "AccountBasedExpenseLineDetail",
                      "AccountBasedExpenseLineDetail": {"AccountRef": {"value": account}, "TaxCodeRef": {"value": code}}}]}


def qinvoice(iid, number, customer, date, net, email="EmailSent"):
    tax, detail = qtax(net, "4")
    return {"Id": iid, "DocNumber": number, "TxnDate": date, "DueDate": date, "CustomerRef": {"value": customer[0], "name": customer[1]},
            "TotalAmt": round(net + tax, 2), "Balance": round(net + tax, 2), "TxnTaxDetail": detail, "EmailStatus": email,
            "Line": [{"Amount": net, "DetailType": "SalesItemLineDetail", "SalesItemLineDetail": {"ItemRef": {"value": "1"}, "TaxCodeRef": {"value": "4"}}}]}


class QuickBooks(PackBase):
    SLUG, LEDGER = "bookkeeping-quickbooks", "QuickBooks"

    def setUp(self):
        super().setUp()
        self.q = self.w.qbo
        self.q.close_date = day(40)
        self.supplies = qvendor("12", "Plumbing Supplies Co")
        self.q.vendors.append(self.supplies)
        self.q.bills.append(qbill("100", "PS-1", self.supplies, day(5), 300.0, paid=True))
        self.client = {"version": 1, "slug": "acme-plumbing", "name": "Acme Plumbing", "ledger": "quickbooks",
                       "qbo_company_name": "Acme Plumbing Pty Ltd", "gst_registered": True}
        self.save_client(self.client)

    def test_setup_takes_the_connected_company_only(self):
        apply = self.auto("Apply checks setup")
        self.w.items["t1"] = {"id": "t1", "title": "Checks settings", "status": "not_started", "labels": [], "comments": [], "description": ""}
        out = self.submit(apply, "Client checks settings (QuickBooks)", "t1", {"q_client_name": "Beta Cafe", "q_file": "Beta Cafe", "q_gst": True})
        self.assertEqual(out["apply_checks"]["outputs"]["outcome"], "file_not_found")
        self.assertIn("reaches **Acme Plumbing Pty Ltd**, not **Beta Cafe**", self.w.items["t1"]["comments"][-1])
        out = self.submit(apply, "Client checks settings (QuickBooks)", "t1", {"q_client_name": "Acme Plumbing", "q_file": "Acme Plumbing", "q_gst": True})
        self.assertEqual(out["apply_checks"]["outputs"]["outcome"], "client_saved")
        client = json.loads(self.w.files["Bookkeeping/Clients/acme-plumbing.json"])
        self.assertEqual((client["ledger"], client["qbo_company_name"]), ("quickbooks", "Acme Plumbing Pty Ltd"))

    def test_a_clean_company_raises_nothing(self):
        steps = self.overnight()
        self.assertEqual(steps["run_checks"]["outputs"]["summary"]["errors"], [])
        self.assertEqual(self.items(), [])

    def test_duplicates_attachments_and_gst_on_quickbooks(self):
        sparky = qvendor("13", "Sparky Electrical")
        self.q.vendors.append(sparky)
        self.q.bills += [qbill("101", "INV-7", sparky, day(10), 400.0), qbill("102", "INV-7", sparky, day(7), 400.0)]
        # Last month: one bill with its receipt attached, one without; GST on bank fees.
        self.q.bills += [qbill("103", "R-1", self.supplies, last_month_day(), 150.0), qbill("104", "R-2", self.supplies, last_month_day(), 160.0, account="58")]
        self.q.attachables.append({"Id": "a1", "AttachableRef": [{"EntityRef": {"type": "Bill", "value": "103"}}],
                                   "MetaData": {"LastUpdatedTime": last_month_day() + "T10:00:00+10:00"}})
        self.q.invoices.append(qinvoice("200", "1001", ("C7", "Bayview Hospitality"), last_month_day(), 900.0, email="NeedToSend"))
        self.overnight()
        item = self.open_item()
        self.assertIn("(QuickBooks: Acme Plumbing Pty Ltd)", item["description"])
        dup = self.lines(item, "CHK-079")[0]
        self.assertIn("[Open in QuickBooks](https://app.qbo.intuit.com/app/bill?txnId=102)", dup)
        bare = self.lines(item, "CHK-086")[0]
        self.assertIn("1 bill(s)", bare)
        self.assertIn("coded to Bank Fees, which normally has no GST", self.lines(item, "CHK-058")[0])
        self.assertIn("never sent from QuickBooks (1001)", self.lines(item, "CHK-024")[0])
        self.assertIn("Not checked, as QuickBooks' API doesn't give what they need: CHK-002", item["description"])
        self.assertFalse(self.lines(item, "CHK-022"))

    def test_the_closing_date_is_the_lock_date(self):
        self.q.close_date = ""
        self.overnight()
        self.assertIn("No lock date is set in QuickBooks", self.lines(self.open_item(), "CHK-134")[0])

    def test_a_client_whose_company_isnt_connected_is_an_error(self):
        self.q.name = "Beta Cafe"
        steps = self.overnight()
        errors = steps["run_checks"]["outputs"]["summary"]["errors"]
        self.assertTrue(errors and "reaches Beta Cafe, not Acme Plumbing Pty Ltd" in errors[0], errors)
        self.assertEqual(self.items(), [])
        self.assertEqual([t for t, _a in self.q.calls], ["get_company_info"])


    def test_customer_payments_give_the_overdue_checks_their_history(self):
        for k in range(3):
            inv = qinvoice("3%d" % k, "20%d" % k, ("C9", "Harbourline Logistics Pty Ltd"), day(30 + 20 * k), 3600.0)
            inv["Balance"] = 0
            self.q.invoices.append(inv)
            self.q.customer_payments.append({"Id": "p%d" % k, "TxnDate": day(10 + 20 * k),
                                             "Line": [{"Amount": 3960.0, "LinkedTxn": [{"TxnId": "3%d" % k, "TxnType": "Invoice"}]}]})
        late = qinvoice("39", "1003", ("C9", "Harbourline Logistics Pty Ltd"), day(274), 3600.0)
        late["DueDate"] = day(244)
        self.q.invoices.append(late)
        self.overnight()
        line = self.lines(self.open_item(), "CHK-037")[0]
        self.assertIn("Invoice 1003 to Harbourline Logistics Pty Ltd ($3,960.00) is 244 days overdue", line)
        self.assertIn("usually paid within about 20 days (3 paid)", line)


if __name__ == "__main__":
    unittest.main()
