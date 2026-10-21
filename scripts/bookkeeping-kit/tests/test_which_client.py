"""A bill addressed to another business: nothing goes to Xero until someone says which client it's for, on the
"Which client is this for?" form. Choosing the business it's addressed to sets a Xero organisation up as a client when
it isn't one; choosing a client teaches the name it was addressed to. Also: every item says what to do first, and the
review item says where the bill came from, which Xero organisation it's in and whether the PDF is attached."""
import json
import unittest

from harness import run_flow
from test_flows import AUTOS, BOOKKEEPER, REVIEWER, T_ACME, T_BETA, Base, make_pdf, source_id, INVOICE_TEXT
from test_intake import pdf, recent

PROCESS = "Bookkeeping: Process bill, invoice or statement (Xero)"
APPLY = "Bookkeeping: Apply setup (Xero)"
OUTLOOK = "Bookkeeping: Email intake (Outlook)"
FAILED = "Bookkeeping Failed/acme-plumbing/INV-1001.pdf"


class WhichClientTests(Base):
    def setUp(self):
        super().setUp()
        self.setup_practice()  # only Acme Plumbing is set up; the connection also sees Beta Cafe
        self.add_supplier(T_ACME)
        self.add_supplier(T_BETA)

    def process(self, path):
        trigger = {"kind": "event", "actor_user_id": BOOKKEEPER,
                   "event": {"eventType": "knowledge.file_created",
                             "subject": {"path": path, "scope": "org", "name": path.split("/")[-1]}, "payload": {}}}
        return run_flow(self.w, AUTOS[PROCESS], trigger)

    def which_item(self):
        return next(i for i in self.w.items.values() if "which-client" in i["labels"] and i["status"] != "done")

    def answer(self, item, choice, client=""):
        return self.submit(APPLY, "Which client is this for?", item["id"], {"q_choice": choice, "q_client": client})

    def test_a_bill_for_another_xero_organisation_waits_and_nothing_goes_to_xero(self):
        self.invoice["bill_to"] = "Beta Cafe"
        steps = self.drop()
        self.assertEqual(steps["route_review"]["outputs"]["outcome"], "needs_client")
        self.assertEqual(self.w.xero.writes, [])
        item = self.which_item()
        self.assertTrue(item["title"].startswith("Bill for Beta Cafe, which isn't set up in Bookkeeping"))
        self.assertEqual(item["formId"], source_id(PROCESS, "Which client is this for?"))
        d = item["description"]
        self.assertTrue(d.startswith("**What to do:** say which client this bill is for"))
        self.assertIn("Nothing has gone to Xero yet", d)
        self.assertIn("**Beta Cafe** is one of the Xero organisations your Xero connection can see, but it isn't set up", d)
        self.assertIn("**The business it's addressed to:**", d)
        self.assertIn(FAILED, d)
        self.assertIn(FAILED, self.w.files)
        self.assertNotIn("Bookkeeping Inbox/acme-plumbing/INV-1001.pdf", self.w.files)

    def test_setting_the_organisation_up_files_the_bill_there(self):
        self.invoice["bill_to"] = "Beta Cafe"
        self.drop()
        item = self.which_item()
        out = self.answer(item, "The business it's addressed to")
        self.assertEqual(out["apply_setup"]["outputs"]["outcome"], "client_created")
        beta = json.loads(self.w.files["Bookkeeping/Clients/beta-cafe.json"])
        self.assertEqual((beta["xero_tenant_id"], beta["checks_enabled"]), (T_BETA, False))
        self.assertEqual(self.w.items[item["id"]]["status"], "done")
        self.assertIn("Set up **Beta Cafe** as a client", self.w.items[item["id"]]["comments"][-1])
        settings_item = next(i for i in self.w.items.values() if i["title"] == "Bookkeeping settings for Beta Cafe")
        self.assertEqual(settings_item["formId"], source_id(APPLY, "Client bookkeeping settings"))
        moved = "Bookkeeping Inbox/beta-cafe/INV-1001.pdf"
        self.assertIn(moved, self.w.files)
        self.assertNotIn(FAILED, self.w.files)
        # Its new file starts Process bill again, now for Beta Cafe, in Beta Cafe's own Xero.
        self.process(moved)
        review = self.review_item()
        self.assertIn("(Beta Cafe)", review["title"])
        self.assertTrue(all(t == T_BETA for _, t in self.w.xero.writes))
        self.assertIn("chosen on a Which client is this for? item", json.loads(self.w.files["Bookkeeping/Mail/origins.json"])["INV-1001.pdf"]["why"])

    def test_choosing_the_client_it_was_filed_under_teaches_the_name(self):
        self.invoice["bill_to"] = "Beta Cafe"
        self.drop()
        self.answer(self.which_item(), "The client it was filed under")
        routing = json.loads(self.w.files["Bookkeeping/Mail/routing.json"])
        self.assertEqual(routing["names"]["Beta Cafe"], "acme-plumbing")
        self.process("Bookkeeping Inbox/acme-plumbing/INV-1001.pdf")
        self.assertIn("(Acme Plumbing)", self.review_item()["title"])
        self.assertTrue(all(t == T_ACME for _, t in self.w.xero.writes))
        self.assertFalse([i for i in self.w.items.values() if "which-client" in i["labels"] and i["status"] != "done"])
        self.assertNotIn("Bookkeeping/Clients/beta-cafe.json", self.w.files)

    def test_another_client_by_name_and_a_name_that_matches_none_asks_again(self):
        self.invoice["bill_to"] = "Beta Cafe"
        self.drop()
        first = self.which_item()
        out = self.answer(first, "Another client (name it below)", "Gamma Holdings")
        self.assertEqual(out["apply_setup"]["outputs"]["outcome"], "unclear")
        self.assertEqual(self.w.items[first["id"]]["status"], "done")
        again = self.which_item()
        self.assertNotEqual(again["id"], first["id"])
        self.assertIn("no client is called \"Gamma Holdings\"", again["description"])
        self.answer(again, "Another client (name it below)", "acme plumbing")
        self.assertIn("Bookkeeping Inbox/acme-plumbing/INV-1001.pdf", self.w.files)

    def test_none_of_our_clients_leaves_it(self):
        self.invoice["bill_to"] = "Beta Cafe"
        self.drop()
        item = self.which_item()
        self.assertEqual(self.answer(item, "None of our clients: leave it")["apply_setup"]["outputs"]["outcome"], "not_ours")
        self.assertIn(FAILED, self.w.files)
        self.assertEqual(self.w.items[item["id"]]["status"], "done")
        self.assertEqual(self.w.xero.writes, [])

    def test_a_bill_for_another_client_already_set_up_asks_about_that_client(self):
        self.w.files["Bookkeeping/Clients/beta-cafe.json"] = json.dumps(
            {"name": "Beta Cafe", "slug": "beta-cafe", "xero_tenant_id": T_BETA, "xero_org_name": "Beta Cafe"})
        self.invoice["bill_to"] = "Beta Cafe Pty Ltd"
        self.drop()
        item = self.which_item()
        self.assertTrue(item["title"].startswith("Is this bill for Beta Cafe?"))
        self.answer(item, "The business it's addressed to")
        self.assertIn("Bookkeeping Inbox/beta-cafe/INV-1001.pdf", self.w.files)

    def test_a_bill_put_in_a_folder_by_hand_to_an_unknown_name_goes_on_with_a_warning(self):
        self.invoice["bill_to"] = "J Smith"
        self.drop()
        d = self.review_item()["description"]
        self.assertIn("**Check**\n\n- Addressed to J Smith", d)


class EmailedToTheOnlyClientTests(Base):
    """One client set up: Email intake files every bill under it, so Process bill asks when the bill names someone else."""

    def setUp(self):
        super().setUp()
        self.setup_practice()
        self.add_supplier(T_ACME)

    def fake_extract(self, prompt, input):
        if prompt.startswith("You triage"):
            return [{"index": e["index"], "kind": "supplier bill", "capture": True, "reason": "Bill"} for e in json.loads(input)]
        return super().fake_extract(prompt, input)

    def intake_and_process(self):
        self.w.mail.add("outlook", "Invoice INV-1001", "accounts@sparky.example", recent(), [pdf()])
        run_flow(self.w, AUTOS[OUTLOOK], {"kind": "schedule", "actor_user_id": BOOKKEEPER})
        [path] = [p for p in self.w.files if p.startswith("Bookkeeping Inbox/acme-plumbing/") and p.endswith(".pdf")]
        trigger = {"kind": "event", "actor_user_id": BOOKKEEPER,
                   "event": {"eventType": "knowledge.file_created",
                             "subject": {"path": path, "scope": "org", "name": path.split("/")[-1]}, "payload": {}}}
        return run_flow(self.w, AUTOS[PROCESS], trigger)

    def test_an_unknown_name_is_asked_about_not_drafted(self):
        self.invoice["bill_to"] = "Zed Traders"
        steps = self.intake_and_process()
        self.assertEqual(steps["route_review"]["outputs"]["outcome"], "needs_client")
        item = next(i for i in self.w.items.values() if "which-client" in i["labels"])
        self.assertTrue(item["title"].startswith("Which client is this bill for?"))
        self.assertIn("only because Acme Plumbing is the only client set up", item["description"])
        self.assertIn("Email from accounts <accounts@sparky.example>, \"Invoice INV-1001\"", item["description"])
        self.assertEqual(self.w.xero.writes, [])

    def test_the_review_item_says_where_it_came_from_and_that_the_pdf_is_attached(self):
        self.invoice["bill_to"] = "Acme Plumbing Pty Ltd"
        self.intake_and_process()
        d = self.review_item()["description"]
        self.assertTrue(d.startswith("**What to do:** check the bill below against the PDF, then fill in the **Bill review** form"))
        self.assertIn("- **Client:** Acme Plumbing (Xero: Acme Plumbing Pty Ltd)", d)
        self.assertIn("- **What it is:** a supplier bill to Acme Plumbing", d)
        self.assertIn("- **Came from:** Email from accounts <accounts@sparky.example>, \"Invoice INV-1001\"", d)
        self.assertIn("(Outlook)", d)
        self.assertIn("- **Why this client:** it's the only client set up", d)
        self.assertIn("- **In Xero:** draft bill in Acme Plumbing Pty Ltd's Xero: [open in Xero]", d)
        self.assertIn("- **PDF:** attached to the draft in Xero", d)
        self.assertIn("**What each answer does**", d)
        self.assertIn("- **Reject:** the draft is deleted from Xero", d)


class ItemLayoutTests(Base):
    def test_an_exception_item_says_what_to_do_first(self):
        self.setup_practice()
        self.drop(folder="nobody")
        item = next(i for i in self.w.items.values() if "bill-exception" in i["labels"])
        self.assertTrue(item["description"].startswith("**What to do:** fix what's below"))
        self.assertIn("- **What went wrong:** There are no client settings", item["description"])
        self.assertIn("- **Came from:** Put into Knowledge (Bookkeeping Inbox) by hand", item["description"])


if __name__ == "__main__":
    unittest.main()
