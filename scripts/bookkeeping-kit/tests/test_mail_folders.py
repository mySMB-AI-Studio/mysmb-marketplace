"""Email intake on a real practice inbox: every new email is read in order (none missed on a busy day), from the Inbox,
extra folders, each client's own folder and a shared mailbox; each attachment is checked; photos become one PDF; iPhone
HEIC photos are converted; clients are matched by name, trading name, ABN and the names the practice taught."""
import datetime
import io
import json
import unittest

from harness import run_flow
from test_flows import AUTOS, BOOKKEEPER, REVIEWER, T_ACME, T_BETA, Base, make_pdf, source_id
from test_intake import BILL_TEXT, pdf, recent
from test_scans import photo

OUTLOOK = "Bookkeeping: Email intake (Outlook)"
SHARED = "Bookkeeping: Email intake (Outlook shared mailbox)"
HOTMAIL = "Bookkeeping: Email intake (Hotmail)"
GMAIL = "Bookkeeping: Email intake (Gmail)"
PROCESS = "Bookkeeping: Process bill, invoice or statement (Xero)"
APPLY = "Bookkeeping: Apply setup (Xero)"
TERMS = ["TERMS AND CONDITIONS OF TRADE", "1. Payment is due within 30 days.", "2. Title passes on payment."]


class MailBase(Base):
    def setUp(self):
        super().setUp()
        self.triage = None
        self.route = {}  # file or subject fragment -> AI answer; default: Acme, high confidence
        self.route_inputs = []
        self.setup_practice()
        self.w.files["Bookkeeping/Clients/beta-cafe.json"] = json.dumps(
            {"name": "Beta Cafe", "slug": "beta-cafe", "xero_tenant_id": T_BETA, "xero_org_name": "Beta Cafe"})

    def fake_extract(self, prompt, input):
        if prompt.startswith("You triage"):
            if self.triage is not None:
                return self.triage
            return [{"index": e["index"], "kind": "supplier bill", "capture": True, "reason": "Bill"} for e in json.loads(input)]
        if prompt.startswith("A bookkeeping practice keeps"):
            ask = json.loads(input)
            self.route_inputs.append(ask)
            for key, answer in self.route.items():
                if key in ask.get("text", "") or key in ask.get("subject", ""):
                    return answer
            return {"document": "bill or invoice", "client_slug": "acme-plumbing", "addressed_to": "Acme Plumbing Pty Ltd",
                    "confidence": "high"}
        return super().fake_extract(prompt, input)

    def run_intake(self, auto=OUTLOOK):
        return run_flow(self.w, AUTOS[auto], {"kind": "schedule", "actor_user_id": BOOKKEEPER})

    def settings(self, **intake):
        s = json.loads(self.w.files["Bookkeeping/settings.json"])
        s.setdefault("intake", {}).update(intake)
        self.w.files["Bookkeeping/settings.json"] = json.dumps(s)

    def client(self, slug, **fields):
        path = "Bookkeeping/Clients/" + slug + ".json"
        c = json.loads(self.w.files[path])
        c.update(fields)
        self.w.files[path] = json.dumps(c)

    def filed(self, slug=None):
        return sorted(p for p in self.w.files if p.startswith("Bookkeeping Inbox/" + (slug + "/" if slug else ""))
                      and not p.split("/")[-1].startswith("_"))

    def items(self, label):
        return [i for i in self.w.items.values() if label in i["labels"]]


class CursorTests(MailBase):
    def test_a_busy_inbox_is_read_in_order_and_nothing_is_missed(self):
        # 65 new emails since the last run: more than one run handles, and more than the newest 50 a list returns.
        for i in range(65):
            self.w.mail.add("outlook", "Invoice " + str(i), "accounts@sparky.example", recent(hours=5 - i * 0.05),
                            [pdf(att_id="a" + str(i), name="INV-" + str(i) + ".pdf")])
        handled = []
        for _ in range(4):
            steps = self.run_intake()
            handled += [c["subject"] for c in steps["find_emails"]["outputs"]["candidates"]]
        self.assertEqual(handled, ["Invoice " + str(i) for i in range(65)])
        self.assertEqual(len(self.filed("acme-plumbing")), 65)
        self.assertEqual(self.run_intake()["find_emails"]["outputs"]["candidates"], [])
        ledger = json.loads(self.w.files["Bookkeeping/Mail/outlook.json"])
        self.assertIn("inbox", ledger["cursors"])

    def test_the_first_run_says_how_many_are_waiting(self):
        for i in range(23):
            self.w.mail.add("outlook", "Invoice " + str(i), "accounts@sparky.example", recent(hours=2 - i * 0.05),
                            [pdf(att_id="a" + str(i))])
        steps = self.run_intake()
        self.assertEqual(len(steps["find_emails"]["outputs"]["candidates"]), 20)
        self.assertIn("3 more new email(s) wait for the next run.", steps["file_bills"]["outputs"]["summary"])

    def test_an_email_that_fails_to_download_is_read_again_without_refiling_later_ones(self):
        self.w.mail.add("outlook", "Invoice A", "accounts@sparky.example", recent(hours=3), [pdf(att_id="a1", name="A.pdf")])
        self.w.mail.add("outlook", "Invoice B", "accounts@sparky.example", recent(hours=2), [pdf(att_id="a2", name="B.pdf")])
        self.w.mail.fail_download = 1  # A fails once
        self.run_intake()
        self.assertEqual([p.split("/")[-1].split(" ", 2)[-1] for p in self.filed()], ["B.pdf"])
        steps = self.run_intake()
        self.assertEqual([c["subject"] for c in steps["find_emails"]["outputs"]["candidates"]], ["Invoice A"])
        self.assertEqual(sorted(p.split("/")[-1].split(" ", 2)[-1] for p in self.filed()), ["A.pdf", "B.pdf"])

    def test_more_than_a_page_in_one_second_never_stalls_the_folder(self):
        # 60 emails received in the same second (a bulk move, say), then one more a minute later. Each run relists
        # the cursor's second; once all 60 are handled, a full page of them would come back every run and the later
        # email would never be reached, unless the intake pages past them.
        same = recent(hours=2)
        later = recent(hours=1)
        for i in range(60):
            self.w.mail.add("outlook", "Invoice B" + str(i), "accounts@sparky.example", same,
                            [pdf(att_id="b" + str(i), name="B" + str(i) + ".pdf")])
        self.w.mail.add("outlook", "Invoice LATE", "accounts@sparky.example", later, [pdf(att_id="late", name="LATE.pdf")])
        handled = []
        for _ in range(6):
            handled += [c["subject"] for c in self.run_intake()["find_emails"]["outputs"]["candidates"]]
        self.assertIn("Invoice LATE", handled)
        self.assertEqual(len(handled), 61)
        self.assertEqual(len(set(handled)), 61)
        self.assertTrue(any(c[1] == "list_emails" and c[2].get("skip") for c in self.w.mail.calls))

    def test_an_older_connector_still_works(self):
        # Production before the connector update: receivedAfter and oldestFirst are ignored.
        self.w.mail.old_connector = True
        self.w.mail.add("outlook", "Invoice INV-1001", "accounts@sparky.example", recent(), [pdf()])
        self.assertEqual(self.run_intake()["file_bills"]["outputs"]["filed"], 1)
        self.assertEqual(self.run_intake()["find_emails"]["outputs"]["candidates"], [])


class FolderTests(MailBase):
    def test_extra_folders_are_read_too(self):
        self.settings(folders=["Inbox/Bills"])
        self.w.mail.add("outlook", "Invoice INV-1001", "accounts@sparky.example", recent(), [pdf()], folder="Inbox/Bills")
        self.w.mail.add("outlook", "Invoice INV-1002", "accounts@sparky.example", recent(), [pdf(att_id="a2", name="INV-1002.pdf")])
        steps = self.run_intake()
        self.assertEqual(steps["file_bills"]["outputs"]["filed"], 2)
        self.assertEqual(sorted(c["folder"] for c in steps["find_emails"]["outputs"]["candidates"]), ["inbox", "inbox/bills"])

    def test_a_clients_own_folder_decides_the_client_without_ai(self):
        self.client("beta-cafe", mail_folder="Clients/Beta")
        self.route = {"INV-1001": {"client_slug": "acme-plumbing", "confidence": "high"}}  # would be wrong
        self.w.mail.add("outlook", "Invoice INV-1001", "accounts@sparky.example", recent(), [pdf()], folder="Clients/Beta")
        steps = self.run_intake()
        self.assertEqual(len(self.filed("beta-cafe")), 1)
        self.assertEqual(self.route_inputs, [])
        self.assertIn("it's in Beta Cafe's mail folder", steps["file_bills"]["outputs"]["summary"])

    def test_a_folder_that_doesnt_exist_is_reported_and_the_inbox_still_read(self):
        self.settings(folders=["Inbox/Bils"])
        self.w.mail.add("outlook", "Invoice INV-1001", "accounts@sparky.example", recent(), [pdf()])
        steps = self.run_intake()
        self.assertEqual(steps["file_bills"]["outputs"]["filed"], 1)
        self.assertIn("Couldn't read the folder Inbox/Bils", steps["file_bills"]["outputs"]["summary"])

    def test_gmail_labels_and_pages(self):
        self.settings(folders=["Bills"])
        for i in range(55):
            self.w.mail.add("gmail", "Invoice " + str(i), "accounts@sparky.example", recent(hours=3 - i * 0.05),
                            [pdf(att_id="g" + str(i), name="G" + str(i) + ".pdf")])
        self.w.mail.add("gmail", "Invoice from the Bills label", "accounts@sparky.example", recent(hours=4),
                        [pdf(att_id="b1", name="Label.pdf")], folder="Bills")
        handled = []
        for _ in range(3):
            handled += [c["subject"] for c in self.run_intake(GMAIL)["find_emails"]["outputs"]["candidates"]]
        self.assertEqual(handled[0], "Invoice from the Bills label")
        self.assertEqual(handled[1:], ["Invoice " + str(i) for i in range(55)])
        self.assertTrue(any(c[1] == "list_messages" and c[2].get("pageToken") for c in self.w.mail.calls))


class SharedMailboxTests(MailBase):
    def test_the_shared_mailbox_must_be_set_first(self):
        steps = self.run_intake(SHARED)
        self.assertIn("No shared mailbox is set", steps["find_emails"]["outputs"]["problem"])
        self.assertEqual(self.w.mail.calls, [])

    def test_bills_in_the_shared_mailbox_are_filed(self):
        self.settings(shared_mailbox="accounts@practice.example")
        self.w.mail.add("outlook-shared", "Invoice INV-1001", "accounts@sparky.example", recent(), [pdf()])
        steps = self.run_intake(SHARED)
        self.assertEqual(steps["file_bills"]["outputs"]["filed"], 1)
        self.assertIn("Bookkeeping/Mail/outlook-shared.json", self.w.files)

    def test_an_email_in_two_mailboxes_is_filed_once(self):
        self.settings(shared_mailbox="accounts@practice.example")
        when = recent()
        self.w.mail.add("outlook", "Invoice INV-1001", "accounts@sparky.example", when, [pdf()])
        self.w.mail.add("outlook-shared", "Invoice INV-1001", "accounts@sparky.example", when, [pdf()])
        self.run_intake()
        self.assertEqual(self.run_intake(SHARED)["find_emails"]["outputs"]["candidates"], [])
        self.assertEqual(len(self.filed()), 1)


class HotmailTests(MailBase):
    """A personal Hotmail / Outlook.com inbox: Microsoft 365's connection is work or school only, so it's read through
    hotmail-mail, which answers like m365-mail-read (the fake asserts it's never given a shared `mailbox`)."""

    def test_bills_in_a_hotmail_inbox_are_filed_reading_on_from_the_last_run(self):
        self.w.mail.add("hotmail", "Invoice INV-1001", "accounts@sparky.example", recent(), [pdf()])
        steps = self.run_intake(HOTMAIL)
        self.assertEqual(steps["file_bills"]["outputs"]["filed"], 1)
        self.assertIn("Bookkeeping/Mail/hotmail.json", self.w.files)
        self.assertEqual({c[0] for c in self.w.mail.calls}, {"hotmail"})
        [listed] = [c[2] for c in self.w.mail.calls if c[1] == "list_emails"]
        self.assertTrue(listed["oldestFirst"])
        self.assertTrue(listed["receivedAfter"])
        self.assertEqual(self.run_intake(HOTMAIL)["find_emails"]["outputs"]["candidates"], [])

    def test_hotmail_folders_and_iphone_photos(self):
        self.settings(folders=["Inbox/Bills"])
        self.w.mail.add("hotmail", "Invoice INV-1001", "accounts@sparky.example", recent(), [pdf()], folder="Inbox/Bills")
        heic = b"\x00\x00\x00\x18ftypheic" + bytes(40000)
        self.w.mail.add("hotmail", "Fuel receipt", "tom@acme.example", recent(),
                        [{"id": "p1", "name": "IMG_7.HEIC", "type": "image/heic", "bytes": heic, "heic": True,
                          "jpeg": photo(noisy=True)}])
        steps = self.run_intake(HOTMAIL)
        self.assertEqual(steps["file_bills"]["outputs"]["filed"], 2)
        self.assertTrue(any(p.endswith("IMG_7 (photo).pdf") for p in self.filed("acme-plumbing")))
        self.assertTrue(any(c[1] == "get_email_attachment" and c[2].get("heicToJpeg") for c in self.w.mail.calls))

    def test_the_hotmail_connector_before_its_update_still_files_new_bills(self):
        # Production's hotmail-mail before myhub-mcp-servers #821: receivedAfter and oldestFirst are ignored.
        self.w.mail.old_connector = True
        self.w.mail.add("hotmail", "Invoice INV-1001", "accounts@sparky.example", recent(), [pdf()])
        self.assertEqual(self.run_intake(HOTMAIL)["file_bills"]["outputs"]["filed"], 1)
        self.assertEqual(self.run_intake(HOTMAIL)["find_emails"]["outputs"]["candidates"], [])

    def test_the_same_bill_sent_to_hotmail_and_outlook_is_filed_once(self):
        when = recent()
        self.w.mail.add("hotmail", "Invoice INV-1001", "accounts@sparky.example", when, [pdf()])
        self.w.mail.add("outlook", "Invoice INV-1001", "accounts@sparky.example", when, [pdf()])
        self.run_intake(HOTMAIL)
        self.assertEqual(self.run_intake()["find_emails"]["outputs"]["candidates"], [])
        self.assertEqual(len(self.filed()), 1)


class AttachmentTests(MailBase):
    def test_terms_and_conditions_sent_with_a_bill_are_left_alone(self):
        self.route = {"TERMS AND CONDITIONS": {"document": "other", "client_slug": "acme-plumbing", "confidence": "high"}}
        self.w.mail.add("outlook", "Invoice INV-1001", "accounts@sparky.example", recent(),
                        [pdf(), pdf(att_id="a2", name="Terms.pdf", lines=TERMS)])
        steps = self.run_intake()
        self.assertEqual([p.split("/")[-1].split(" ", 2)[-1] for p in self.filed()], ["INV-1001.pdf"])
        self.assertEqual(self.items("bill-exception"), [])
        self.assertIn("left out Terms.pdf (not a bill)", steps["file_bills"]["outputs"]["summary"])

    def test_an_email_whose_attachments_are_none_of_them_bills_becomes_an_item(self):
        self.route = {"TERMS AND CONDITIONS": {"document": "other", "client_slug": "", "confidence": "high"}}
        self.w.mail.add("outlook", "Our terms", "accounts@sparky.example", recent(),
                        [pdf(name="Terms.pdf", lines=TERMS), pdf(att_id="a2", name="Terms 2.pdf", lines=TERMS)])
        self.run_intake()
        self.assertEqual(self.filed(), [])
        [item] = self.items("email-intake")
        self.assertTrue(item["title"].startswith("Check this email"))

    def test_two_bills_for_two_clients_in_one_email(self):
        beta_bill = ["TAX INVOICE", "Sparky Electrical", "Bill to: Beta Cafe", "Total 110.00"]
        self.route = {"Beta Cafe": {"document": "bill or invoice", "client_slug": "beta-cafe", "addressed_to": "Beta Cafe",
                                    "confidence": "high"}}
        self.w.mail.add("outlook", "Invoices", "accounts@sparky.example", recent(),
                        [pdf(), pdf(att_id="a2", name="INV-2002.pdf", lines=beta_bill)])
        self.run_intake()
        self.assertEqual((len(self.filed("acme-plumbing")), len(self.filed("beta-cafe"))), (1, 1))

    def test_several_photos_become_one_pdf(self):
        from pypdf import PdfReader
        self.w.mail.add("outlook", "Receipts from Bunnings", "tom@acme.example", recent(),
                        [{"id": "p1", "name": "IMG_1.jpg", "type": "image/jpeg", "bytes": photo(noisy=True)},
                         {"id": "p2", "name": "IMG_2.png", "type": "image/png", "bytes": photo("PNG", noisy=True)}])
        steps = self.run_intake()
        [path] = self.filed("acme-plumbing")
        self.assertTrue(path.endswith("Receipts from Bunnings (2 photos).pdf"))
        self.assertEqual(len(PdfReader(io.BytesIO(self.w.files[path])).pages), 2)
        self.assertEqual(steps["file_bills"]["outputs"]["filed"], 1)

    def test_an_iphone_heic_photo_is_converted_by_the_connector(self):
        heic = b"\x00\x00\x00\x18ftypheic" + bytes(40000)
        self.w.mail.add("outlook", "Fuel receipt", "tom@acme.example", recent(),
                        [{"id": "p1", "name": "IMG_7.HEIC", "type": "image/heic", "bytes": heic, "heic": True,
                          "jpeg": photo(noisy=True)}])
        self.run_intake()
        [path] = self.filed("acme-plumbing")
        self.assertTrue(path.endswith("IMG_7 (photo).pdf"))
        self.assertTrue(any(c[1] == "get_email_attachment" and c[2].get("heicToJpeg") for c in self.w.mail.calls))

    def test_an_unconverted_heic_photo_becomes_an_item(self):
        self.w.mail.old_connector = True
        heic = b"\x00\x00\x00\x18ftypheic" + bytes(40000)
        self.w.mail.add("outlook", "Fuel receipt", "tom@acme.example", recent(),
                        [{"id": "p1", "name": "IMG_7.HEIC", "type": "image/heic", "bytes": heic, "heic": True, "jpeg": b""}])
        self.run_intake()
        self.assertEqual(self.filed(), [])
        [item] = self.items("email-intake")
        self.assertIn("IMG_7.HEIC is an iPhone HEIC photo that couldn't be converted", item["description"])


class MatchingTests(MailBase):
    def test_the_ai_sees_each_clients_abn_trading_names_and_sender_history(self):
        self.client("acme-plumbing", abn="51824753556", aliases=["Acme Plumbing & Gas"])
        self.w.mail.add("outlook", "Invoice INV-1001", "accounts@sparky.example", recent(), [pdf()])
        self.run_intake()
        acme = next(c for c in self.route_inputs[0]["clients"] if c["slug"] == "acme-plumbing")
        self.assertEqual(acme["abn"], "51824753556")
        self.assertIn("Acme Plumbing & Gas", acme["other_names"])
        routing = json.loads(self.w.files["Bookkeeping/Mail/routing.json"])
        self.assertEqual(routing["senders"]["accounts@sparky.example"], {"acme-plumbing": 1})

    def test_a_client_abn_on_the_bill_places_it_when_the_ai_is_unsure(self):
        self.client("beta-cafe", abn="83914571673")
        lines = ["TAX INVOICE", "Sparky Electrical  ABN 51 824 753 556", "Customer ABN 83 914 571 673", "Total 110.00"]
        self.route = {"Customer ABN": {"document": "bill or invoice", "client_slug": "", "addressed_to": "B.C.", "confidence": "low"}}
        self.w.mail.add("outlook", "Invoice", "accounts@sparky.example", recent(), [pdf(lines=lines)])
        steps = self.run_intake()
        self.assertEqual(len(self.filed("beta-cafe")), 1)
        self.assertIn("its ABN 83914571673 is on the document", steps["file_bills"]["outputs"]["summary"])

    def test_a_name_the_practice_taught_places_the_next_one(self):
        unsure = {"document": "bill or invoice", "client_slug": "", "addressed_to": "J & K Nguyen", "confidence": "low"}
        self.route = {"J & K Nguyen": unsure}
        lines = ["TAX INVOICE", "Sparky Electrical", "Bill to: J & K Nguyen", "Total 220.00"]
        self.w.mail.add("outlook", "Invoice 1", "accounts@sparky.example", recent(hours=2), [pdf(att_id="a1", name="1.pdf", lines=lines)])
        self.run_intake()
        [failed] = [p for p in self.w.files if p.startswith("Bookkeeping Failed/unmatched/")]
        [item] = self.items("email-intake")
        self.assertIn("remembered", item["description"])
        # The bookkeeper files it under Beta Cafe; Process bill learns who "J & K Nguyen" is.
        name = failed.split("/")[-1]
        self.w.files["Bookkeeping Inbox/beta-cafe/" + name] = self.w.files.pop(failed)
        self.invoice = dict(self.invoice, bill_to="J & K Nguyen")
        trigger = {"kind": "event", "actor_user_id": BOOKKEEPER, "event": {"eventType": "knowledge.file_created",
                   "subject": {"path": "Bookkeeping Inbox/beta-cafe/" + name, "scope": "org"}, "payload": {}}}
        steps = run_flow(self.w, AUTOS[PROCESS], trigger)
        self.assertEqual(steps["resolve_file"]["outputs"]["learned"], "documents addressed to J & K Nguyen are for beta-cafe")
        # The next bill addressed to them is placed by itself, even though the AI is still unsure.
        self.w.mail.add("outlook", "Invoice 2", "accounts@sparky.example", recent(hours=1), [pdf(att_id="a2", name="2.pdf", lines=lines)])
        self.run_intake()
        self.assertTrue(any(p.endswith(" 2.pdf") for p in self.filed("beta-cafe")))

    def test_setup_saves_trading_names_mail_folder_abn_and_mail_settings(self):
        self.w.xero.orgs[T_ACME]["abn"] = "51824753556"
        self.submit(APPLY, "Client bookkeeping settings", next(iter(self.w.items)), {
            "q_client_name": "Acme Plumbing", "q_xero_org": "Acme Plumbing Pty Ltd", "q_gst": True,
            "q_aliases": "Acme Plumbing & Gas\nA. Smith", "q_mail_folder": "Inbox/Clients/Acme/"})
        c = json.loads(self.w.files["Bookkeeping/Clients/acme-plumbing.json"])
        self.assertEqual((c["abn"], c["aliases"], c["mail_folder"]), ("51824753556", ["Acme Plumbing & Gas", "A. Smith"], "Inbox/Clients/Acme"))
        setup_item = next(i for i in self.w.items.values() if i["title"] == "Set up Bookkeeping for Xero")
        self.submit(APPLY, "Bookkeeping setup", setup_item["id"], {
            "q_mode": "Practice: we keep the books for many client businesses", "q_reviewer": REVIEWER,
            "q_approved_status": "Awaiting approval", "q_mail_folders": "Inbox/Bills\n\nSuppliers/",
            "q_shared_mailbox": "accounts@practice.example"})
        s = json.loads(self.w.files["Bookkeeping/settings.json"])
        self.assertEqual(s["intake"]["folders"], ["Inbox/Bills", "Suppliers"])
        self.assertEqual(s["intake"]["shared_mailbox"], "accounts@practice.example")

    def test_process_bill_keeps_an_older_clients_abn_on_file(self):
        self.w.xero.orgs[T_ACME]["abn"] = "51824753556"
        self.client("acme-plumbing", abn="", org_names=[])
        self.add_supplier(T_ACME, history_code="449")
        self.drop()
        c = json.loads(self.w.files["Bookkeeping/Clients/acme-plumbing.json"])
        self.assertEqual((c["abn"], c["org_names"]), ("51824753556", ["Acme Plumbing Pty Ltd", "Acme Plumbing Pty Ltd"]))


if __name__ == "__main__":
    unittest.main()
