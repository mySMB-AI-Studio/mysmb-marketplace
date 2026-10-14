"""Scenario tests: the generated Bookkeeping for Xero automations end to end, on a fake workspace + fake Xero.

Each test maps to an acceptance criterion in the supplier-bills blueprint of the design pack.
"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
from harness import World, run_flow  # noqa: E402

PLUGIN = os.environ.get("BK_PLUGIN", os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "plugins", "bookkeeping-xero")))
T_DEFAULT, T_ACME, T_BETA = "tenant-default", "tenant-acme", "tenant-beta"
REVIEWER = {"id": "user-reviewer", "label": "Rhea Reviewer"}
BOOKKEEPER = "user-bookkeeper"


def load_plugin():
    manifest = json.load(open(os.path.join(PLUGIN, ".claude-plugin", "plugin.json"), encoding="utf-8"))
    autos = {}
    for rel in manifest["content"]["automations"]:
        p = json.load(open(os.path.join(PLUGIN, rel), encoding="utf-8"))
        autos[p["name"]] = p
    forms = {}
    for rel in manifest["content"]["forms"]:
        p = json.load(open(os.path.join(PLUGIN, rel), encoding="utf-8"))
        forms[p["title"]] = p
    return autos, forms


AUTOS, FORMS = load_plugin()


def source_id(auto_name, form_title):
    """The id the automation uses for a form (the sourceId the installer remaps)."""
    origin = FORMS[form_title]["originKey"]
    return next(d["sourceId"] for d in AUTOS[auto_name]["dependencies"] if d["originKey"] == origin)


def make_pdf(lines):
    from fpdf import FPDF
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=11)
    for line in lines:
        pdf.cell(0, 8, line, new_x="LMARGIN", new_y="NEXT")
    return bytes(pdf.output())


def blank_pdf():
    from fpdf import FPDF
    pdf = FPDF()
    pdf.add_page()
    pdf.rect(20, 20, 100, 60)
    return bytes(pdf.output())


INVOICE_TEXT = ["TAX INVOICE", "Sparky Electrical Pty Ltd  ABN 51 824 753 556", "Invoice INV-1001  Date 01/09/2026  Due 30/09/2026",
                "Replace switchboard fuse   1 x 400.00 = 400.00", "Subtotal 400.00  GST 40.00  Total 440.00"]


def sparky_invoice(**over):
    inv = {"document_type": "tax invoice", "invoice_count": 1, "supplier_name": "Sparky Electrical Pty Ltd",
           "supplier_abn": "51 824 753 556", "invoice_number": "INV-1001", "issue_date": "2026-09-01", "due_date": "2026-09-30",
           "currency": "AUD", "reference": "", "amounts_include_tax": False,
           "lines": [{"description": "Replace switchboard fuse", "quantity": 1, "unit_amount": 400.0, "line_amount": 400.0, "tax_amount": 40.0}],
           "subtotal": 400.0, "tax_total": 40.0, "total": 440.0,
           "confidence": {"supplier": "high", "invoice_number": "high", "dates": "high", "amounts": "high"}}
    inv.update(over)
    return inv


class Base(unittest.TestCase):
    def setUp(self):
        self.w = World()
        self.w.xero.add_org(T_DEFAULT, "Default Demo", default=True)
        self.w.xero.add_org(T_ACME, "Acme Plumbing Pty Ltd")
        self.w.xero.add_org(T_BETA, "Beta Cafe")
        self.invoice = sparky_invoice()
        self.coding = [{"index": 0, "account_code": "449", "tax_type": "INPUT", "reason": "Electrical repairs", "confidence": "high"}]
        self.edits = {}
        self.w.ai_extract = self.fake_extract

    def fake_extract(self, prompt, input):
        if prompt.startswith("You read supplier invoices"):
            return self.invoice
        if prompt.startswith("You code supplier bill lines"):
            return self.coding
        if prompt.startswith("A bookkeeper reviewed"):
            return self.edits
        raise AssertionError("unexpected ai.extract prompt: " + prompt[:60])

    # ── helpers that drive the real flows ──
    def submit(self, auto, form_title, todo_id, responses, actor=REVIEWER["id"]):
        trigger = {"kind": "event", "actor_user_id": actor,
                   "event": {"eventType": "form.response_submitted",
                             "subject": {"form_id": source_id(auto, form_title), "todo_id": todo_id},
                             "payload": {"responses": responses}}}
        return run_flow(self.w, AUTOS[auto], trigger)

    def setup_practice(self, auto_below="0", client_above="", approved="Awaiting approval"):
        run_flow(self.w, AUTOS["Bookkeeping: Start setup"], {"kind": "manual", "actor_user_id": BOOKKEEPER})
        setup_item = next(i for i in self.w.items.values() if i["title"] == "Set up Bookkeeping for Xero")
        self.submit("Bookkeeping: Apply setup (Xero)", "Bookkeeping setup", setup_item["id"], {
            "q_mode": "Practice: we keep the books for many client businesses", "q_timezone": "Australia/Sydney",
            "q_reviewer": REVIEWER, "q_approved_status": approved, "q_auto_below": auto_below, "q_client_above": client_above})
        run_flow(self.w, AUTOS["Bookkeeping: Start setup"], {"kind": "manual", "actor_user_id": BOOKKEEPER},
                 {"client_names": "Acme Plumbing\nBeta Cafe"})
        acme_item = next(i for i in self.w.items.values() if i["title"] == "Bookkeeping settings for Acme Plumbing")
        self.submit("Bookkeeping: Apply setup (Xero)", "Client bookkeeping settings", acme_item["id"], {
            "q_client_name": "Acme Plumbing", "q_xero_org": "Acme Plumbing Pty Ltd", "q_gst": True,
            "q_contact_name": "Alex Acme", "q_contact_email": "alex@acme.example"})

    def add_supplier(self, tenant, name="Sparky Electrical Pty Ltd", abn="51824753556", history_code=None):
        c = {"ContactID": "contact-" + name.split()[0].lower(), "Name": name, "TaxNumber": abn}
        self.w.xero.orgs[tenant]["contacts"].append(c)
        if history_code:
            self.w.xero.orgs[tenant]["invoices"].append({"InvoiceID": "old-1", "Type": "ACCPAY", "Status": "PAID", "InvoiceNumber": "OLD-1",
                                                          "Contact": dict(c), "LineItems": [{"AccountCode": history_code, "TaxType": "INPUT"}]})
        return c

    def drop(self, name="INV-1001.pdf", folder="acme-plumbing", data=None):
        path = "Bookkeeping Inbox/" + folder + "/" + name
        self.w.files[path] = data if data is not None else make_pdf(INVOICE_TEXT)
        trigger = {"kind": "event", "actor_user_id": BOOKKEEPER,
                   "event": {"eventType": "knowledge.file_created", "subject": {"path": path, "scope": "org", "name": name}, "payload": {}}}
        return run_flow(self.w, AUTOS["Bookkeeping: Process bill, invoice or statement (Xero)"], trigger)

    def review_item(self):
        return next(i for i in self.w.items.values() if "bill-review" in i["labels"])

    def acme_bills(self):
        return self.w.xero.orgs[T_ACME]["invoices"]


class SetupTests(Base):
    def test_setup_saves_settings_and_client_with_its_own_xero_org(self):
        self.setup_practice()
        s = json.loads(self.w.files["Bookkeeping/settings.json"])
        self.assertEqual(s["mode"], "practice")
        self.assertEqual(s["reviewer_id"], REVIEWER["id"])
        self.assertEqual(s["approved_status"], "SUBMITTED")
        c = json.loads(self.w.files["Bookkeeping/Clients/acme-plumbing.json"])
        self.assertEqual(c["xero_tenant_id"], T_ACME)
        self.assertIn("Bookkeeping Inbox/acme-plumbing/_README.txt", self.w.files)
        self.assertEqual(json.loads(self.w.files["Bookkeeping/Rules/acme-plumbing.json"]), {"suppliers": {}})
        setup_item = next(i for i in self.w.items.values() if i["title"] == "Set up Bookkeeping for Xero")
        self.assertEqual(setup_item["status"], "done")
        self.assertIsNotNone(setup_item["formId"])

    def test_unknown_xero_org_is_reported_and_item_left_open(self):
        self.setup_practice()
        beta = next(i for i in self.w.items.values() if i["title"] == "Bookkeeping settings for Beta Cafe")
        steps = self.submit("Bookkeeping: Apply setup (Xero)", "Client bookkeeping settings", beta["id"],
                            {"q_client_name": "Beta Cafe", "q_xero_org": "Beta Coffee House", "q_gst": True})
        self.assertEqual(steps["apply_setup"]["outputs"]["outcome"], "xero_org_not_found")
        self.assertNotEqual(self.w.items[beta["id"]]["status"], "done")
        self.assertIn("Acme Plumbing Pty Ltd", self.w.items[beta["id"]]["comments"][-1])

    def test_start_setup_with_nothing_to_do(self):
        self.setup_practice()
        steps = run_flow(self.w, AUTOS["Bookkeeping: Start setup"], {"kind": "manual", "actor_user_id": BOOKKEEPER})
        self.assertEqual(steps["start_setup"]["outputs"]["created_count"], 0)


class ProcessBillTests(Base):
    def test_known_supplier_creates_draft_in_the_clients_org_with_pdf_and_review_item(self):
        self.setup_practice()
        self.add_supplier(T_ACME, history_code="449")
        steps = self.drop()
        self.assertEqual(steps["route_review"]["outputs"]["outcome"], "review")
        bills = self.acme_bills()
        draft = [b for b in bills if b["Status"] == "DRAFT"]
        self.assertEqual(len(draft), 1)
        self.assertEqual(draft[0]["LineItems"][0]["AccountCode"], "449")
        self.assertEqual(draft[0]["InvoiceNumber"], "INV-1001")
        self.assertEqual(self.w.xero.orgs[T_DEFAULT]["invoices"], [], "nothing may land in the default org")
        self.assertTrue(all(t == T_ACME for _, t in self.w.xero.writes))
        self.assertEqual(len(self.w.xero.orgs[T_ACME]["attachments"]), 1)
        item = self.review_item()
        self.assertEqual(item["assigneeIds"], [REVIEWER["id"]])
        self.assertEqual(item["formId"], source_id("Bookkeeping: Process bill, invoice or statement (Xero)", "Bill review"))
        self.assertIn("history", json.loads(self.w.files["Bookkeeping/Bills/" + item["id"] + ".json"])["proposal"]["coding_source"])
        self.assertIn("Bookkeeping Processed/acme-plumbing/INV-1001.pdf", self.w.files)
        self.assertNotIn("Bookkeeping Inbox/acme-plumbing/INV-1001.pdf", self.w.files)
        # the AI coding call was not needed: history won
        self.assertFalse(any(p.startswith("You code") for k, p, _ in self.w.ai_calls))

    def test_ai_coding_when_supplier_has_no_history(self):
        self.setup_practice()
        self.add_supplier(T_ACME)
        self.drop()
        rec = json.loads(self.w.files["Bookkeeping/Bills/" + self.review_item()["id"] + ".json"])
        self.assertEqual(rec["proposal"]["coding_source"], "ai")
        self.assertEqual(rec["proposal"]["lines"][0]["account_code"], "449")

    def test_invalid_ai_account_is_blocked_not_posted(self):
        self.setup_practice()
        self.add_supplier(T_ACME)
        self.coding = [{"index": 0, "account_code": "200", "tax_type": "INPUT", "reason": "x", "confidence": "high"}]  # revenue, not expense
        self.drop()
        rec = json.loads(self.w.files["Bookkeeping/Bills/" + self.review_item()["id"] + ".json"])
        self.assertTrue(rec["blocking"])
        self.assertEqual(self.acme_bills(), [], "a bill with no valid account must not be posted")

    def test_readme_and_non_pdf_are_ignored(self):
        self.setup_practice()
        before = len(self.w.items)
        steps = self.drop(name="_README.txt", data=b"hello")
        self.assertFalse(steps["resolve_file"]["outputs"]["should_process"])
        self.assertNotIn("load_context", steps)
        self.assertEqual(len(self.w.items), before)

    def test_processed_folder_writes_do_not_retrigger(self):
        self.setup_practice()
        trigger = {"kind": "event", "event": {"eventType": "knowledge.file_created",
                                              "subject": {"path": "Bookkeeping Processed/acme-plumbing/INV-1001.pdf", "scope": "org"}, "payload": {}}}
        steps = run_flow(self.w, AUTOS["Bookkeeping: Process bill, invoice or statement (Xero)"], trigger)
        self.assertFalse(steps["resolve_file"]["outputs"]["should_process"])

    def test_a_scan_the_ai_cannot_read_becomes_exception_and_moves_to_failed(self):
        self.setup_practice()
        original = self.fake_extract

        def extract(prompt, input):
            if self.w.ai_files:
                raise RuntimeError("api.ai.extract timed out after 60s")
            return original(prompt, input)
        self.w.ai_extract = extract
        steps = self.drop(data=blank_pdf())
        self.assertEqual(steps["route_review"]["outputs"]["outcome"], "exception")
        item = next(i for i in self.w.items.values() if "bill-exception" in i["labels"])
        self.assertIn("no readable text", item["description"])
        self.assertIn("timed out", item["description"])
        self.assertIn("Bookkeeping Failed/acme-plumbing/INV-1001.pdf", self.w.files)
        self.assertEqual(self.acme_bills(), [])

    def test_duplicate_is_caught(self):
        self.setup_practice()
        c = self.add_supplier(T_ACME)
        self.w.xero.orgs[T_ACME]["invoices"].append({"InvoiceID": "x", "Type": "ACCPAY", "Status": "AUTHORISED", "InvoiceNumber": "INV-1001",
                                                     "Contact": dict(c), "LineItems": []})
        steps = self.drop()
        self.assertEqual(steps["route_review"]["outputs"]["outcome"], "exception")
        item = next(i for i in self.w.items.values() if "bill-exception" in i["labels"])
        self.assertIn("Duplicate", item["description"])
        self.assertEqual(len(self.acme_bills()), 1)

    def test_unknown_client_folder_is_an_exception(self):
        self.setup_practice()
        steps = self.drop(folder="gamma-gym")
        self.assertEqual(steps["route_review"]["outputs"]["outcome"], "exception")
        item = next(i for i in self.w.items.values() if "bill-exception" in i["labels"])
        self.assertIn("no client settings", item["description"])

    def test_not_set_up_is_an_exception(self):
        steps = self.drop()
        self.assertEqual(steps["route_review"]["outputs"]["outcome"], "exception")

    def test_quotes_and_multi_invoice_pdfs_are_rejected(self):
        # Statements are filed now (test_statements.py); other non-invoices and multi-invoice PDFs still stop.
        self.setup_practice()
        self.invoice = sparky_invoice(document_type="quote")
        self.drop(name="quote.pdf")
        self.invoice = sparky_invoice(invoice_count=2)
        self.drop(name="two.pdf")
        texts = [i["description"] for i in self.w.items.values() if "bill-exception" in i["labels"]]
        self.assertTrue(any("looks like a quote" in t for t in texts))
        self.assertTrue(any("2 invoices" in t for t in texts))

    def test_warnings_for_bad_totals_and_abn(self):
        self.setup_practice()
        self.add_supplier(T_ACME, history_code="449")
        self.invoice = sparky_invoice(total=450.0, supplier_abn="12 345 678 901")
        self.drop()
        rec = json.loads(self.w.files["Bookkeeping/Bills/" + self.review_item()["id"] + ".json"])
        joined = " ".join(rec["warnings"])
        self.assertIn("Subtotal plus GST", joined)
        self.assertIn("ABN", joined)
        self.assertEqual(self.review_item()["priority"], "high")

    def test_new_supplier_waits_for_approval(self):
        self.setup_practice()
        steps = self.drop()
        self.assertEqual(steps["post_draft"]["outputs"]["bill_id"], "")
        self.assertEqual(self.acme_bills(), [])
        self.assertIn("New supplier", self.review_item()["description"])

    def test_auto_approve_small_confident_bill_when_allowed(self):
        self.setup_practice(auto_below="1000", approved="Approved")
        self.add_supplier(T_ACME, history_code="449")
        steps = self.drop()
        self.assertEqual(steps["route_review"]["outputs"]["outcome"], "auto_approved")
        self.assertEqual([b["Status"] for b in self.acme_bills() if b["InvoiceID"] != "old-1"], ["AUTHORISED"])
        self.assertFalse(any("bill-review" in i["labels"] for i in self.w.items.values()))


class InboxRootTests(Base):
    """A PDF dropped straight into Bookkeeping Inbox (not a client's folder) is matched to its client and processed."""
    def setUp(self):
        super().setUp()
        self.match = {"client_slug": "acme-plumbing", "addressed_to": "Acme Plumbing Pty Ltd", "confidence": "high"}

    def fake_extract(self, prompt, input):
        if prompt.startswith("A bookkeeping practice keeps"):
            if self.match is None:
                raise AssertionError("the AI shouldn't be asked")
            return self.match
        return super().fake_extract(prompt, input)

    def add_second_client(self):
        self.w.files["Bookkeeping/Clients/beta-cafe.json"] = json.dumps(
            {"name": "Beta Cafe", "slug": "beta-cafe", "xero_tenant_id": T_BETA, "xero_org_name": "Beta Cafe"})

    def drop_root(self, name="INV-1001.pdf", data=None):
        path = "Bookkeeping Inbox/" + name
        self.w.files[path] = data if data is not None else make_pdf(INVOICE_TEXT)
        trigger = {"kind": "event", "actor_user_id": BOOKKEEPER,
                   "event": {"eventType": "knowledge.file_created", "subject": {"path": path, "scope": "org", "name": name}, "payload": {}}}
        return run_flow(self.w, AUTOS["Bookkeeping: Process bill, invoice or statement (Xero)"], trigger)

    def test_with_one_client_it_is_processed_for_that_client(self):
        self.setup_practice()
        self.add_supplier(T_ACME, history_code="449")
        self.match = None
        steps = self.drop_root()
        self.assertEqual(steps["resolve_file"]["outputs"]["client_folder"], "acme-plumbing")
        self.assertEqual(steps["route_review"]["outputs"]["outcome"], "review")
        self.assertEqual([b["InvoiceNumber"] for b in self.acme_bills() if b["InvoiceID"] != "old-1"], ["INV-1001"])
        self.assertIn("Bookkeeping Processed/acme-plumbing/INV-1001.pdf", self.w.files)
        self.assertNotIn("Bookkeeping Inbox/INV-1001.pdf", self.w.files)

    def test_with_several_clients_ai_works_out_whose_it_is(self):
        self.setup_practice()
        self.add_second_client()
        self.match = {"client_slug": "beta-cafe", "addressed_to": "Beta Cafe", "confidence": "high"}
        steps = self.drop_root()
        self.assertEqual(steps["resolve_file"]["outputs"]["client_folder"], "beta-cafe")
        self.assertEqual(steps["route_review"]["outputs"]["outcome"], "review")
        self.assertEqual(self.acme_bills(), [])
        self.assertIn("Bookkeeping Processed/beta-cafe/INV-1001.pdf", self.w.files)

    def test_when_it_is_unclear_it_waits_in_unmatched_with_an_item(self):
        self.setup_practice()
        self.add_second_client()
        self.match = {"client_slug": "", "addressed_to": "Gamma Holdings", "confidence": "low"}
        steps = self.drop_root()
        self.assertFalse(steps["resolve_file"]["outputs"]["should_process"])
        self.assertNotIn("load_context", steps)
        self.assertIn("Bookkeeping Failed/unmatched/INV-1001.pdf", self.w.files)
        self.assertNotIn("Bookkeeping Inbox/INV-1001.pdf", self.w.files)
        item = next(i for i in self.w.items.values() if i["title"] == "Which client is this for? INV-1001.pdf")
        self.assertIn("Gamma Holdings", item["description"])
        self.assertEqual(item["assigneeIds"], [REVIEWER["id"]])
        self.assertEqual(self.acme_bills(), [])

    def test_a_scan_with_several_clients_is_matched_from_the_image(self):
        self.setup_practice()
        self.add_second_client()
        self.match = {"client_slug": "beta-cafe", "addressed_to": "Beta Cafe", "confidence": "high"}
        steps = self.drop_root(data=blank_pdf())
        self.assertEqual(steps["resolve_file"]["outputs"]["client_folder"], "beta-cafe")
        self.assertTrue(self.w.ai_files, "the AI should read the scan itself")

    def test_before_setup_and_for_other_files_nothing_happens(self):
        steps = self.drop_root()
        self.assertFalse(steps["resolve_file"]["outputs"]["should_process"])
        self.assertIn("no client is set up yet", steps["resolve_file"]["outputs"]["skip_reason"])
        self.setup_practice()
        before = len(self.w.items)
        steps = self.drop_root(name="notes.txt", data=b"hello")
        self.assertEqual(steps["resolve_file"]["outputs"]["skip_reason"], "not a PDF or a photo of a bill")
        self.assertEqual(len(self.w.items), before)


class ReviewTests(Base):
    def bill_in_review(self, **setup):
        self.setup_practice(**setup)
        self.add_supplier(T_ACME, history_code="449")
        self.drop()
        return self.review_item()

    def review(self, item, **answers):
        return self.submit("Bookkeeping: Apply bill or invoice review (Xero)", "Bill review", item["id"], answers)

    def new_bill(self):
        return next(b for b in self.acme_bills() if b["InvoiceID"] != "old-1")

    def test_approve_sets_the_configured_status(self):
        item = self.bill_in_review()
        steps = self.review(item, q_decision="Approve")
        self.assertEqual(steps["apply_decision"]["outputs"]["outcome"], "approved")
        self.assertEqual(self.new_bill()["Status"], "SUBMITTED")
        self.assertEqual(self.w.items[item["id"]]["status"], "done")

    def test_approve_with_changes_updates_lines_and_learns(self):
        item = self.bill_in_review(approved="Approved")
        self.edits = {"lines": [{"index": 0, "account_code": "429", "tax_type": "EXEMPTEXPENSES"}]}
        steps = self.review(item, q_decision="Approve with changes", q_changes="line 1 account 429 GST free")
        self.assertTrue(steps["apply_decision"]["outputs"]["changed_coding"])
        bill = self.new_bill()
        self.assertEqual(bill["LineItems"][0]["AccountCode"], "429")
        self.assertEqual(bill["Status"], "AUTHORISED")
        rules = json.loads(self.w.files["Bookkeeping/Rules/acme-plumbing.json"])["suppliers"]
        self.assertEqual(rules["contact-sparky"]["account_code"], "429")
        # the next bill from the same supplier uses the rule
        self.invoice = sparky_invoice(invoice_number="INV-1002")
        self.drop(name="INV-1002.pdf")
        latest = [i for i in self.w.items.values() if "bill-review" in i["labels"] and i["status"] != "done"][0]
        rec = json.loads(self.w.files["Bookkeeping/Bills/" + latest["id"] + ".json"])
        self.assertEqual(rec["proposal"]["coding_source"], "rule")
        self.assertEqual(rec["proposal"]["lines"][0]["account_code"], "429")

    def test_invalid_change_is_ignored(self):
        item = self.bill_in_review()
        self.edits = {"lines": [{"index": 0, "account_code": "999"}]}
        self.review(item, q_decision="Approve with changes", q_changes="line 1 account 999")
        self.assertEqual(self.new_bill()["LineItems"][0]["AccountCode"], "449")

    def test_reject_deletes_the_draft(self):
        item = self.bill_in_review()
        self.review(item, q_decision="Reject")
        self.assertEqual(self.new_bill()["Status"], "DELETED")

    def test_new_supplier_approval_creates_contact_bill_and_attachment(self):
        self.setup_practice()
        self.drop()
        item = self.review_item()
        self.review(item, q_decision="Approve")
        bills = self.acme_bills()
        self.assertEqual(len(bills), 1)
        self.assertEqual(bills[0]["Status"], "SUBMITTED")
        self.assertEqual(bills[0]["Contact"]["Name"], "Sparky Electrical Pty Ltd")
        self.assertEqual(len(self.w.xero.orgs[T_ACME]["attachments"]), 1)
        self.assertEqual(self.w.xero.orgs[T_DEFAULT]["contacts"], [])

    def test_missing_due_date_uses_xero_bill_terms(self):
        self.invoice = sparky_invoice(due_date="")
        self.setup_practice()
        self.w.xero.orgs[T_ACME]["bill_terms"] = {"Day": 14, "Type": "DAYSAFTERBILLDATE"}
        self.drop()
        item = self.review_item()
        self.assertIn("due 2026-09-15", item["description"])
        self.assertIn("default bill terms", item["description"])
        self.review(item, q_decision="Approve")
        self.assertEqual(self.acme_bills()[0]["DueDate"], "2026-09-15")
        self.assertEqual(self.acme_bills()[0]["Status"], "SUBMITTED")

    def test_missing_due_date_without_terms_is_the_invoice_date(self):
        self.invoice = sparky_invoice(due_date="")
        self.setup_practice()
        self.drop()
        self.review(self.review_item(), q_decision="Approve")
        self.assertEqual(self.acme_bills()[0]["DueDate"], "2026-09-01")

    def test_bill_recorded_without_a_due_date_still_approves(self):
        # Records written before the fix have no due date; approving fills it in before Xero sees the bill.
        self.setup_practice()
        self.drop()
        item = self.review_item()
        path = "Bookkeeping/Bills/" + item["id"] + ".json"
        record = json.loads(self.w.files[path])
        record["proposal"]["due_date"] = ""
        self.w.files[path] = json.dumps(record)
        steps = self.review(item, q_decision="Approve")
        self.assertEqual(steps["apply_decision"]["outputs"]["outcome"], "approved")
        self.assertEqual(self.acme_bills()[0]["DueDate"], "2026-09-01")

    def test_retry_after_xero_rejects_reuses_the_new_contact(self):
        self.setup_practice()
        self.drop()
        item = self.review_item()
        # A first attempt created the contact, then Xero rejected the bill.
        self.w.xero.orgs[T_ACME]["contacts"].append({"ContactID": "made-earlier", "Name": "Sparky Electrical Pty Ltd",
                                                     "TaxNumber": "51824753556"})
        steps = self.review(item, q_decision="Approve")
        self.assertEqual(steps["apply_decision"]["outputs"]["outcome"], "approved")
        self.assertEqual(len(self.w.xero.orgs[T_ACME]["contacts"]), 1)
        self.assertEqual(self.acme_bills()[0]["Contact"]["ContactID"], "made-earlier")

    def test_xero_validation_message_reaches_the_item(self):
        self.setup_practice()
        self.drop()
        item = self.review_item()
        path = "Bookkeeping/Bills/" + item["id"] + ".json"
        record = json.loads(self.w.files[path])
        record["proposal"]["date"] = ""
        record["proposal"]["due_date"] = ""
        self.w.files[path] = json.dumps(record)
        self.review(item, q_decision="Approve")
        comment = self.w.items[item["id"]]["comments"][-1]
        self.assertIn("Xero says: Due Date is mandatory", comment)
        self.assertNotIn("xxxxxxxx", comment)

    def test_review_lines_are_a_list_not_a_table(self):
        self.setup_practice()
        self.drop()
        description = self.review_item()["description"]
        self.assertNotIn("|---", description)
        self.assertIn("- Line 1: Replace switchboard fuse", description)

    def test_over_client_limit_needs_client_approval_then_approves(self):
        item = self.bill_in_review(client_above="300")
        steps = self.review(item, q_decision="Approve")
        self.assertEqual(steps["apply_decision"]["outputs"]["outcome"], "client_approval_requested")
        self.assertEqual(self.new_bill()["Status"], "DRAFT")
        follow = self.w.items[steps["apply_decision"]["outputs"]["followup_id"]]
        self.assertIn("alex@acme.example", follow["description"])
        self.assertIn("Draft email", follow["description"])
        self.assertEqual(follow["formId"], source_id("Bookkeeping: Apply bill or invoice review (Xero)", "Client bill approval"))
        steps2 = self.submit("Bookkeeping: Apply bill or invoice review (Xero)", "Client bill approval", follow["id"],
                             {"q_client_decision": "They approved it", "q_client_reply": "Yes, go ahead"}, actor=BOOKKEEPER)
        self.assertEqual(steps2["apply_decision"]["outputs"]["outcome"], "approved")
        self.assertEqual(self.new_bill()["Status"], "SUBMITTED")
        self.assertEqual(self.w.items[follow["id"]]["status"], "done")

    def test_client_rejects(self):
        item = self.bill_in_review(client_above="300")
        steps = self.review(item, q_decision="Approve")
        follow_id = steps["apply_decision"]["outputs"]["followup_id"]
        self.submit("Bookkeeping: Apply bill or invoice review (Xero)", "Client bill approval", follow_id, {"q_client_decision": "They rejected it"})
        self.assertEqual(self.new_bill()["Status"], "DELETED")

    def test_ask_the_client_then_approve_on_the_follow_up(self):
        item = self.bill_in_review()
        steps = self.review(item, q_decision="Ask the client", q_notes="Is this for the Smith St job?")
        self.assertEqual(steps["apply_decision"]["outputs"]["outcome"], "question_drafted")
        follow_id = steps["apply_decision"]["outputs"]["followup_id"]
        self.assertEqual(self.w.items[follow_id]["formId"], source_id("Bookkeeping: Apply bill or invoice review (Xero)", "Bill review"))
        self.review({"id": follow_id}, q_decision="Approve")
        self.assertEqual(self.new_bill()["Status"], "SUBMITTED")

    def test_second_submission_after_approval_changes_nothing(self):
        item = self.bill_in_review()
        self.review(item, q_decision="Approve")
        writes = len(self.w.xero.writes)
        self.review(item, q_decision="Reject")
        self.assertEqual(len(self.w.xero.writes), writes)
        self.assertIn("already approved", self.w.items[item["id"]]["comments"][-1])

    def test_missing_account_cannot_be_approved_without_changes(self):
        self.setup_practice()
        self.add_supplier(T_ACME)
        self.coding = []
        self.drop()
        item = self.review_item()
        self.review(item, q_decision="Approve")
        self.assertEqual(self.acme_bills(), [])
        self.assertIn("no account code", self.w.items[item["id"]]["comments"][-1])
        self.assertEqual(self.w.items[item["id"]]["status"], "in_progress")

    def test_other_forms_are_ignored(self):
        self.setup_practice()
        trigger = {"kind": "event", "event": {"eventType": "form.response_submitted", "subject": {"form_id": "some-other-form", "todo_id": "x"},
                                              "payload": {"responses": {}}}}
        steps = run_flow(self.w, AUTOS["Bookkeeping: Apply bill or invoice review (Xero)"], trigger)
        self.assertEqual(steps["load_review"]["outputs"]["problem"], "ignored")


class DigestTests(Base):
    def test_digest_counts_per_client_and_notifies(self):
        self.setup_practice()
        c = self.add_supplier(T_ACME, history_code="449")
        self.w.xero.orgs[T_ACME]["invoices"].append({"InvoiceID": "od", "Type": "ACCPAY", "Status": "AUTHORISED", "InvoiceNumber": "OLD-9",
                                                     "Contact": dict(c), "AmountDue": 120.0, "DueDateString": "2026-01-01T00:00:00", "LineItems": []})
        self.drop()
        steps = run_flow(self.w, AUTOS["Bookkeeping: Weekly AP digest (Xero)"], {"kind": "schedule"})
        acme = next(x for x in steps["gather_ap"]["outputs"]["summary"]["clients"] if x["slug"] == "acme-plumbing")
        self.assertEqual(acme["draft"][0], 1)
        self.assertEqual(acme["overdue"], [1, 120.0])
        self.assertEqual(acme["in_review"], 1)
        self.assertEqual(len(self.w.artifacts), 1)
        self.assertIn("Acme Plumbing", self.w.artifacts[0]["content"])
        self.assertEqual(self.w.notifications[0]["user_ids"], [REVIEWER["id"]])


if __name__ == "__main__":
    unittest.main()
