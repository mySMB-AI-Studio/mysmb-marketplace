"""Invoice requests: "please invoice Bayview for …" becomes a priced draft, approved in WorkQ, emailed only if asked."""
import json
import unittest

from harness import run_flow
from test_flows import AUTOS, BOOKKEEPER, T_ACME, T_BETA, Base, source_id
from test_intake import recent

DRAFT = "Bookkeeping: Draft requested invoice (Xero)"
REVIEW = "Bookkeeping: Apply bill or invoice review (Xero)"
OUTLOOK = "Bookkeeping: Email intake (Outlook)"
BAYVIEW = {"ContactID": "contact-bayview", "Name": "Bayview Hospitality Group", "EmailAddress": "accounts@bayview.example"}
LABOUR = {"Code": "PLUMB-HR", "Name": "Plumbing labour (per hour)", "Description": "Plumbing labour", "IsSold": True,
          "SalesDetails": {"UnitPrice": 120.0, "AccountCode": "200", "TaxType": "OUTPUT"}}


class RequestTests(Base):
    def setUp(self):
        super().setUp()
        self.w.xero.orgs[T_ACME]["items"] = [dict(LABOUR)]
        self.parsed = {"is_request": True, "customer_name": "Bayview Hospitality Group", "customer_email": None,
                       "reference": "September works", "invoice_date": None, "due_date": None,
                       "lines": [{"description": "Plumbing labour, September", "quantity": 6, "unit_amount": None, "item_code": "PLUMB-HR"}],
                       "notes": ""}
        self.coding = [{"index": 0, "account_code": "200", "tax_type": "OUTPUT", "reason": "Plumbing income", "confidence": "medium"}]
        self.triage = None
        self.setup_practice()

    def fake_extract(self, prompt, input):
        if prompt.startswith("A small business has asked its bookkeeper"):
            return self.parsed
        if prompt.startswith("You code sales invoice lines"):
            return self.coding
        if prompt.startswith("You triage"):
            if self.triage is not None:
                return self.triage
            return [{"index": e["index"], "kind": "invoice request", "capture": True, "reason": "Asks for an invoice"}
                    for e in json.loads(input)]
        return super().fake_extract(prompt, input)

    def ask(self, text="Please invoice Bayview for 6 hours of plumbing labour in September.", client="Acme Plumbing"):
        return run_flow(self.w, AUTOS[DRAFT], {"kind": "manual", "actor_user_id": BOOKKEEPER},
                        {"client_name": client, "request_text": text})

    def item(self):
        return next(i for i in self.w.items.values() if "invoice-request" in i["labels"] and "bill-exception" not in i["labels"])

    def decide(self, item, **answers):
        answers.setdefault("q_decision", "Approve")
        return self.submit(REVIEW, "Invoice to send", item["id"], answers)

    def invoices(self):
        return [i for i in self.w.xero.orgs[T_ACME]["invoices"] if i["Type"] == "ACCREC"]

    def test_request_is_priced_from_the_xero_item_drafted_and_emailed_on_approval(self):
        self.w.xero.orgs[T_ACME]["contacts"].append(dict(BAYVIEW))
        steps = self.ask()
        self.assertEqual(steps["route_request"]["outputs"]["outcome"], "review")
        [inv] = self.invoices()
        self.assertEqual((inv["Status"], inv["InvoiceNumber"]), ("DRAFT", "INV-1001"))
        self.assertEqual(inv["LineItems"][0]["ItemCode"], "PLUMB-HR")
        self.assertEqual(inv["LineItems"][0]["UnitAmount"], 120.0)
        item = self.item()
        self.assertTrue(item["title"].startswith("Invoice to raise: Bayview Hospitality Group INV-1001"))
        self.assertEqual(item["formId"], source_id(DRAFT, "Invoice to send"))
        self.assertIn("> Please invoice Bayview for 6 hours", item["description"])
        self.assertIn("Price from the Xero item PLUMB-HR", item["description"])
        self.decide(item, q_send=True)
        self.assertEqual(self.invoices()[0]["Status"], "AUTHORISED")
        self.assertEqual(self.w.xero.orgs[T_ACME]["emailed"], [(inv["InvoiceID"], "accounts@bayview.example")])
        self.assertIn("Xero emailed it to accounts@bayview.example", self.w.items[item["id"]]["comments"][-1])

    def test_approving_without_send_does_not_email(self):
        self.w.xero.orgs[T_ACME]["contacts"].append(dict(BAYVIEW))
        self.ask()
        item = self.item()
        self.decide(item, q_send=False)
        self.assertEqual(self.invoices()[0]["Status"], "AUTHORISED")
        self.assertEqual(self.w.xero.orgs[T_ACME]["emailed"], [])
        self.assertIn("It wasn't emailed", self.w.items[item["id"]]["comments"][-1])

    def test_a_line_with_no_price_blocks_until_the_reviewer_adds_one(self):
        self.w.xero.orgs[T_ACME]["contacts"].append(dict(BAYVIEW))
        self.parsed["lines"] = [{"description": "Emergency call-out, Saturday", "quantity": 1, "unit_amount": None, "item_code": None}]
        self.ask()
        item = self.item()
        self.assertIn("has no price", item["description"])
        self.assertEqual(self.invoices(), [])
        self.decide(item)
        self.assertIn("no price", self.w.items[item["id"]]["comments"][-1])
        self.edits = {"lines": [{"index": 0, "unit_amount": 280.0}]}
        self.decide(item, q_decision="Approve with changes", q_changes="line 1 unit price 280", q_send=True)
        [inv] = self.invoices()
        self.assertEqual((inv["Status"], inv["LineItems"][0]["UnitAmount"]), ("AUTHORISED", 280.0))
        self.assertEqual(len(self.w.xero.orgs[T_ACME]["emailed"]), 1)

    def test_new_customer_is_created_with_its_email_on_approval(self):
        self.parsed.update(customer_name="Harbourview Dental", customer_email="office@harbourview.example")
        self.ask()
        self.assertEqual(self.invoices(), [])
        item = self.item()
        self.assertIn("(new customer)", item["description"])
        self.decide(item, q_send=True)
        contact = next(c for c in self.w.xero.orgs[T_ACME]["contacts"] if c["Name"] == "Harbourview Dental")
        self.assertEqual(contact["EmailAddress"], "office@harbourview.example")
        self.assertEqual(self.invoices()[0]["Status"], "AUTHORISED")
        self.assertEqual(self.w.xero.orgs[T_ACME]["emailed"][0][1], "office@harbourview.example")

    def test_a_customer_without_an_email_is_approved_but_not_emailed(self):
        self.w.xero.orgs[T_ACME]["contacts"].append({"ContactID": "contact-bayview", "Name": "Bayview Hospitality Group"})
        self.ask()
        item = self.item()
        self.assertIn("There's no email address", item["description"])
        self.decide(item, q_send=True)
        self.assertEqual(self.invoices()[0]["Status"], "AUTHORISED")
        self.assertIn("couldn't email it", self.w.items[item["id"]]["comments"][-1])

    def test_something_that_is_not_a_request_becomes_an_exception(self):
        self.parsed = {"is_request": False}
        steps = self.ask("Thanks for the BAS reminder, all good.")
        self.assertEqual(steps["route_request"]["outputs"]["outcome"], "exception")
        item = next(i for i in self.w.items.values() if "bill-exception" in i["labels"])
        self.assertIn("doesn't look like a request", item["description"])

    def test_an_unknown_client_name_is_an_exception(self):
        steps = self.ask(client="Nobody Pty Ltd")
        self.assertIn("no client settings for Nobody Pty Ltd", steps["load_request"]["outputs"]["problem"])

    def test_emailed_request_from_the_client_is_filed_and_drafted(self):
        self.w.files["Bookkeeping/Clients/beta-cafe.json"] = json.dumps(
            {"name": "Beta Cafe", "slug": "beta-cafe", "xero_tenant_id": T_BETA, "xero_org_name": "Beta Cafe"})
        self.w.xero.orgs[T_ACME]["contacts"].append(dict(BAYVIEW))
        self.w.mail.add("outlook", "Invoice for Bayview please", "Alex Acme <alex@acme.example>", recent(), [],
                        preview="Hi, can you invoice Bayview", html="<p>Hi,<br>Please invoice Bayview for 6 hours of plumbing labour.</p>")
        steps = run_flow(self.w, AUTOS[OUTLOOK], {"kind": "schedule", "actor_user_id": BOOKKEEPER})
        self.assertEqual(steps["file_bills"]["outputs"]["requested"], 1)
        self.assertIn("sent by Alex Acme", steps["file_bills"]["outputs"]["summary"])
        self.assertFalse(any(c[1].startswith("A bookkeeping practice keeps") for c in self.w.ai_calls))
        [path] = [p for p in self.w.files if p.startswith("Bookkeeping Requests/acme-plumbing/")]
        self.assertIn("Please invoice Bayview for 6 hours", json.loads(self.w.files[path])["text"])
        trigger = {"kind": "event", "actor_user_id": BOOKKEEPER,
                   "event": {"eventType": "knowledge.file_created", "subject": {"path": path, "scope": "org"}, "payload": {}}}
        steps = run_flow(self.w, AUTOS[DRAFT], trigger)
        self.assertEqual(steps["route_request"]["outputs"]["outcome"], "review")
        self.assertIn("Alex Acme <alex@acme.example>", self.item()["description"])
        self.assertNotIn(path, self.w.files)

    def test_request_from_an_unknown_sender_needs_a_client(self):
        self.w.files["Bookkeeping/Clients/beta-cafe.json"] = json.dumps(
            {"name": "Beta Cafe", "slug": "beta-cafe", "xero_tenant_id": T_BETA, "xero_org_name": "Beta Cafe"})
        self.match_answer = {"client_slug": "", "bill_to": "", "confidence": "low"}
        self.w.mail.add("outlook", "Invoice please", "someone@elsewhere.example", recent(), [],
                        html="<p>Please invoice our customer for the September work, thanks.</p>")
        original = self.fake_extract

        def extract(prompt, input):
            if prompt.startswith("A bookkeeping practice keeps"):
                return self.match_answer
            return original(prompt, input)
        self.w.ai_extract = extract
        run_flow(self.w, AUTOS[OUTLOOK], {"kind": "schedule", "actor_user_id": BOOKKEEPER})
        item = next(i for i in self.w.items.values() if "email-intake" in i["labels"])
        self.assertTrue(item["title"].startswith("Which client is this invoice request from?"))

    def test_bills_and_captured_invoices_are_never_emailed(self):
        # Invoice capture keeps its promise: only a raised invoice can be emailed.
        self.assertNotIn("q_send", json.dumps(next(f for f in __import__("test_flows").FORMS.values() if f["title"] == "Invoice review")))


if __name__ == "__main__":
    unittest.main()
