"""Email intake: bills in the owner's Outlook or Gmail inbox are filed under the right client; nothing else is touched."""
import datetime
import json
import unittest

from harness import run_flow
from test_flows import AUTOS, BOOKKEEPER, T_BETA, Base, make_pdf

OUTLOOK = "Bookkeeping: Email intake (Outlook)"
GMAIL = "Bookkeeping: Email intake (Gmail)"
BILL_TEXT = ["TAX INVOICE", "Sparky Electrical Pty Ltd  ABN 51 824 753 556", "Bill to: Acme Plumbing Pty Ltd",
             "Invoice INV-1001  Date 01/09/2026  Due 30/09/2026", "Subtotal 400.00  GST 40.00  Total 440.00"]


def recent(hours=1):
    return (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%SZ")


def pdf(att_id="a1", name="INV-1001.pdf", lines=None):
    return {"id": att_id, "name": name, "type": "application/pdf", "bytes": make_pdf(lines or BILL_TEXT)}


class IntakeTests(Base):
    def setUp(self):
        super().setUp()
        self.triage = None  # None: every email is a bill
        self.match = {"client_slug": "acme-plumbing", "bill_to": "Acme Plumbing Pty Ltd", "confidence": "high"}
        self.setup_practice()

    def fake_extract(self, prompt, input):
        if prompt.startswith("You triage"):
            emails = json.loads(input)
            if self.triage is not None:
                return self.triage
            return [{"index": e["index"], "is_bill": True, "kind": "supplier invoice", "reason": "Tax invoice attached"} for e in emails]
        if prompt.startswith("A bookkeeping practice keeps"):
            return self.match
        return super().fake_extract(prompt, input)

    def add_second_client(self):
        self.w.files["Bookkeeping/Clients/beta-cafe.json"] = json.dumps(
            {"name": "Beta Cafe", "slug": "beta-cafe", "xero_tenant_id": T_BETA, "xero_org_name": "Beta Cafe"})

    def run_intake(self, auto=OUTLOOK):
        return run_flow(self.w, AUTOS[auto], {"kind": "schedule", "actor_user_id": BOOKKEEPER})

    def inbox_files(self, slug="acme-plumbing"):
        return [p for p in self.w.files if p.startswith("Bookkeeping Inbox/" + slug + "/") and p.endswith(".pdf")]

    def mail_writes(self):
        read_only = {"list_emails", "list_email_attachments", "get_email_attachment", "get_email", "list_messages",
                     "get_message", "get_attachment", "list_labels"}
        return [c for c in self.w.mail.calls if c[1] not in read_only]

    def test_outlook_bill_is_filed_in_the_clients_inbox_folder(self):
        self.add_second_client()
        self.w.mail.add("outlook", "Invoice INV-1001", "accounts@sparky.example", recent(), [pdf()])
        steps = self.run_intake()
        self.assertEqual(steps["file_bills"]["outputs"]["filed"], 1)
        files = self.inbox_files()
        self.assertEqual(len(files), 1)
        self.assertTrue(files[0].endswith("INV-1001.pdf"))
        self.assertEqual(self.w.files[files[0]][:4], b"%PDF")
        # Saving the file is the knowledge.file_created event that starts Process bill.
        self.assertIn(("knowledge.file_created", files[0]), self.w.events)
        self.assertEqual(self.mail_writes(), [])

    def test_filed_bill_goes_through_process_bill(self):
        self.w.mail.add("outlook", "Invoice INV-1001", "accounts@sparky.example", recent(), [pdf()])
        self.run_intake()
        path = self.inbox_files()[0]
        trigger = {"kind": "event", "actor_user_id": BOOKKEEPER,
                   "event": {"eventType": "knowledge.file_created", "subject": {"path": path, "scope": "org"}, "payload": {}}}
        steps = run_flow(self.w, AUTOS["Bookkeeping: Process bill, invoice or statement (Xero)"], trigger)
        self.assertEqual(steps["route_review"]["outputs"]["outcome"], "review")

    def test_each_email_is_filed_once(self):
        self.w.mail.add("outlook", "Invoice INV-1001", "accounts@sparky.example", recent(), [pdf()])
        self.run_intake()
        steps = self.run_intake()
        self.assertEqual(steps["find_emails"]["outputs"]["candidates"], [])
        self.assertEqual(len(self.inbox_files()), 1)

    def test_a_sales_invoice_the_client_issued_is_captured_too(self):
        self.add_second_client()
        self.triage = [{"index": 0, "is_bill": True, "kind": "sales invoice", "reason": "Invoice issued by the client"}]
        self.match = {"client_slug": "acme-plumbing", "bill_to": "Acme Plumbing Pty Ltd", "confidence": "high"}
        self.w.mail.add("outlook", "Invoice AP-2045 sent to Bayview", "office@acme.example", recent(), [pdf(name="AP-2045.pdf")])
        steps = self.run_intake()
        self.assertEqual(steps["file_bills"]["outputs"]["filed"], 1)
        self.assertIn("sales invoice filed for **acme-plumbing** (issued by Acme Plumbing Pty Ltd)",
                      steps["file_bills"]["outputs"]["summary"])

    def test_emails_that_are_not_bills_are_left_alone(self):
        self.w.mail.add("outlook", "Your September statement", "accounts@sparky.example", recent(), [pdf(name="Statement.pdf")])
        self.triage = [{"index": 0, "is_bill": False, "kind": "statement", "reason": "Statement of account"}]
        steps = self.run_intake()
        self.assertEqual(steps["file_bills"]["outputs"]["filed"], 0)
        self.assertEqual(self.inbox_files(), [])
        self.assertFalse(any("bill-exception" in i["labels"] for i in self.w.items.values()))
        self.assertEqual(self.mail_writes(), [])
        ledger = json.loads(self.w.files["Bookkeeping/Mail/outlook.json"])
        self.assertEqual(list(ledger["seen"].values())[0]["outcome"], "not_a_bill")
        self.assertEqual(self.run_intake()["find_emails"]["outputs"]["candidates"], [])

    def test_a_bill_with_nothing_readable_attached_becomes_an_item(self):
        # A small image is a logo or a signature, not a photo of the bill; the bill itself is only linked online.
        self.w.mail.add("outlook", "Your Telstra bill is ready", "billing@telstra.example", recent(),
                        [{"id": "a1", "name": "logo.jpg", "type": "image/jpeg", "bytes": b"jpg"}],
                        preview="Your bill for Acme Plumbing Pty Ltd is ready. View it online.")
        steps = self.run_intake()
        self.assertEqual(len(steps["triage_emails"]["outputs"]["unreadable"]), 1)
        self.assertEqual(self.inbox_files(), [])
        item = next(i for i in self.w.items.values() if "no-attachment" in i["labels"])
        self.assertIn("(Acme Plumbing)", item["title"])
        self.assertIn("links to the bill online", item["description"])
        self.assertIn("Bookkeeping Inbox/acme-plumbing/", item["description"])
        self.assertEqual(item["priority"], "medium")
        ledger = json.loads(self.w.files["Bookkeeping/Mail/outlook.json"])
        self.assertEqual(list(ledger["seen"].values())[0]["outcome"], "no_attachment")
        self.assertEqual(self.mail_writes(), [])

    def test_a_word_invoice_is_named_in_the_item(self):
        self.w.mail.add("outlook", "Invoice 88", "accounts@sparky.example", recent(),
                        [{"id": "a1", "name": "Invoice 88.docx", "type": "application/msword", "bytes": b"doc"}])
        self.run_intake()
        item = next(i for i in self.w.items.values() if "no-attachment" in i["labels"])
        self.assertIn("Invoice 88.docx attached, which can't be read", item["description"])

    def test_emails_without_attachments_are_triaged_too(self):
        self.triage = [{"index": 0, "kind": "other", "capture": False, "reason": "A question about BAS"}]
        self.w.mail.add("outlook", "Quick question about BAS", "alex@acme.example", recent(), [])
        steps = self.run_intake()
        self.assertEqual(steps["triage_emails"]["outputs"]["skipped"][0]["outcome"], "not_a_bill")
        self.assertNotIn("list_email_attachments", [c[1] for c in self.w.mail.calls])

    def test_bill_for_an_unknown_client_becomes_an_exception(self):
        self.add_second_client()
        self.match = {"client_slug": "", "bill_to": "Gamma Holdings", "confidence": "low"}
        self.w.mail.add("outlook", "Invoice 77", "billing@vendor.example", recent(), [pdf(name="77.pdf")])
        steps = self.run_intake()
        self.assertEqual(steps["file_bills"]["outputs"]["unmatched"], 1)
        self.assertEqual(self.inbox_files(), [])
        self.assertTrue(any(p.startswith("Bookkeeping Failed/unmatched/") for p in self.w.files))
        item = next(i for i in self.w.items.values() if "email-intake" in i["labels"])
        self.assertIn("Gamma Holdings", item["description"])
        self.assertIn("billing@vendor.example", item["description"])

    def test_a_single_client_needs_no_matching(self):
        self.match = None  # would fail if the AI were asked
        self.w.mail.add("outlook", "Invoice INV-1001", "accounts@sparky.example", recent(), [pdf()])
        self.assertEqual(self.run_intake()["file_bills"]["outputs"]["filed"], 1)

    def test_first_run_only_looks_back_a_day(self):
        self.w.mail.add("outlook", "Old invoice", "accounts@sparky.example", recent(hours=72), [pdf()])
        self.assertEqual(self.run_intake()["find_emails"]["outputs"]["candidates"], [])

    def test_download_errors_retry_then_become_an_exception(self):
        self.w.mail.add("outlook", "Invoice INV-1001", "accounts@sparky.example", recent(), [pdf()])
        self.w.mail.fail_download = 3
        self.run_intake()
        self.run_intake()
        self.assertFalse(any("email-intake" in i["labels"] for i in self.w.items.values()))
        self.run_intake()
        item = next(i for i in self.w.items.values() if "email-intake" in i["labels"])
        self.assertIn("three times", item["description"])
        self.assertEqual(self.run_intake()["find_emails"]["outputs"]["candidates"], [])

    def test_an_email_moved_out_and_back_is_not_filed_twice(self):
        mid = self.w.mail.add("outlook", "Invoice INV-1001", "accounts@sparky.example", recent(hours=2), [pdf()])
        other = self.w.mail.add("outlook", "Newsletter", "news@vendor.example", recent(hours=1), [])
        self.triage = [{"index": 0, "kind": "supplier bill", "capture": True, "reason": "Tax invoice attached"},
                       {"index": 1, "kind": "other", "capture": False, "reason": "Marketing"}]
        self.run_intake()
        self.assertEqual(len(self.inbox_files()), 1)
        # Outlook gives a moved email a new id; the sender, subject and time received stay the same.
        self.w.mail.find("outlook", mid)["id"] = "o-moved-1"
        self.w.mail.find("outlook", other)["id"] = "o-moved-2"
        self.triage = None
        steps = self.run_intake()
        self.assertEqual(steps["find_emails"]["outputs"]["candidates"], [])
        self.assertEqual(len(self.inbox_files()), 1)

    def test_the_same_subject_from_the_same_sender_later_is_a_new_email(self):
        self.w.mail.add("outlook", "Invoice", "accounts@sparky.example", recent(hours=3), [pdf()])
        self.run_intake()
        self.w.mail.add("outlook", "Invoice", "accounts@sparky.example", recent(hours=1), [pdf(att_id="a2", name="INV-1002.pdf")])
        steps = self.run_intake()
        self.assertEqual(len(steps["find_emails"]["outputs"]["candidates"]), 1)
        self.assertEqual(len(self.inbox_files()), 2)

    def test_gmail_bill_is_filed_in_the_clients_inbox_folder(self):
        self.w.mail.add("gmail", "Invoice INV-1001", "Sparky Accounts <accounts@sparky.example>", recent(), [pdf(att_id="ANGjdJ")])
        steps = run_flow(self.w, AUTOS[GMAIL], {"kind": "manual", "actor_user_id": BOOKKEEPER})
        self.assertEqual(steps["file_bills"]["outputs"]["filed"], 1)
        self.assertEqual(len(self.inbox_files()), 1)
        self.assertIn("Bookkeeping/Mail/gmail.json", self.w.files)

    def test_not_set_up_does_nothing(self):
        del self.w.files["Bookkeeping/settings.json"]
        self.w.mail.add("outlook", "Invoice INV-1001", "accounts@sparky.example", recent(), [pdf()])
        steps = self.run_intake()
        self.assertEqual(steps["find_emails"]["outputs"]["problem"], "Bookkeeping isn't set up yet.")
        self.assertEqual(self.w.mail.calls, [])


if __name__ == "__main__":
    unittest.main()
