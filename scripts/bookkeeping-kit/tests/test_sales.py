"""Invoice capture: a sales invoice the client issued, dropped in the same inbox, is recorded as awaiting payment."""
import json
import unittest

from test_flows import AUTOS, T_ACME, Base, source_id

ACME_ABN = "56204915377"
PROCESS = "Bookkeeping: Process bill, invoice or statement (Xero)"
REVIEW = "Bookkeeping: Apply bill or invoice review (Xero)"


def bayview_invoice(**over):
    inv = {"document_type": "tax invoice", "invoice_count": 1, "supplier_name": "Acme Plumbing Pty Ltd",
           "supplier_abn": "56 204 915 377", "bill_to": "Bayview Hospitality Group", "bill_to_abn": "",
           "invoice_number": "AP-2045", "issue_date": "2026-09-30", "due_date": "2026-10-14", "currency": "AUD",
           "reference": "", "amounts_include_tax": False, "amount_due": 2376.0, "paid": False,
           "lines": [{"description": "Plumbing maintenance, September", "quantity": 12, "unit_amount": 180.0, "line_amount": 2160.0}],
           "subtotal": 2160.0, "tax_total": 216.0, "total": 2376.0,
           "confidence": {"supplier": "high", "invoice_number": "high", "dates": "high", "amounts": "high"}}
    inv.update(over)
    return inv


class SalesTests(Base):
    def setUp(self):
        super().setUp()
        self.w.xero.orgs[T_ACME]["abn"] = ACME_ABN
        self.invoice = bayview_invoice()
        self.coding = [{"index": 0, "account_code": "200", "tax_type": "OUTPUT", "reason": "Plumbing services income", "confidence": "high"}]
        self.coding_input = None

    def fake_extract(self, prompt, input):
        if prompt.startswith("You code sales invoice lines"):
            self.coding_input = json.loads(input)
            return self.coding
        return super().fake_extract(prompt, input)

    def invoice_item(self):
        return next(i for i in self.w.items.values() if "invoice-review" in i["labels"])

    def approve(self, item, **answers):
        answers.setdefault("q_decision", "Approve")
        return self.submit(REVIEW, "Invoice review", item["id"], answers)

    def sales(self):
        return [i for i in self.acme_bills() if i["Type"] == "ACCREC" and i["InvoiceID"] != "old-s"]

    def add_customer(self, history_code=None):
        c = {"ContactID": "contact-bayview", "Name": "Bayview Hospitality Group", "TaxNumber": ""}
        self.w.xero.orgs[T_ACME]["contacts"].append(c)
        if history_code:
            self.w.xero.orgs[T_ACME]["invoices"].append({"InvoiceID": "old-s", "Type": "ACCREC", "Status": "PAID", "InvoiceNumber": "AP-1990",
                                                          "Contact": dict(c), "LineItems": [{"AccountCode": history_code, "TaxType": "OUTPUT"}]})
        return c

    def test_new_customer_invoice_is_reviewed_then_awaiting_payment_without_emailing(self):
        self.setup_practice()
        steps = self.drop(name="AP-2045.pdf")
        self.assertEqual(steps["post_draft"]["outputs"]["bill_id"], "")
        item = self.invoice_item()
        self.assertTrue(item["title"].startswith("Review sales invoice: Bayview Hospitality Group AP-2045"))
        self.assertEqual(item["formId"], source_id(PROCESS, "Invoice review"))
        self.assertIn("**Sales invoice** from Acme Plumbing to **Bayview Hospitality Group** (new customer)", item["description"])
        self.assertIn("New customer", item["description"])
        self.assertFalse(any("bill-review" in i["labels"] for i in self.w.items.values()))
        self.approve(item)
        [inv] = self.sales()
        self.assertEqual(inv["Type"], "ACCREC")
        self.assertEqual(inv["Status"], "AUTHORISED")
        self.assertEqual(inv["InvoiceNumber"], "AP-2045")
        self.assertEqual(inv["Contact"]["Name"], "Bayview Hospitality Group")
        self.assertEqual(inv["LineItems"][0]["AccountCode"], "200")
        self.assertEqual(len(self.w.xero.orgs[T_ACME]["attachments"]), 1)
        self.assertIn("Awaiting payment", self.w.items[item["id"]]["comments"][-1])
        self.assertIn("Nothing was emailed", self.w.items[item["id"]]["comments"][-1])
        self.assertNotIn("email_invoice", [t for t, _ in self.w.xero.writes])

    def test_captured_invoices_are_remembered_so_ledger_checks_dont_call_them_unsent(self):
        self.setup_practice()
        self.drop(name="AP-2045.pdf")
        self.approve(self.invoice_item())
        index = json.loads(self.w.files["Bookkeeping/Checks/acme-plumbing-intake.json"])
        self.assertEqual(index["captured"], [self.sales()[0]["InvoiceID"]], "a new customer's invoice is created on approval")
        self.add_customer(history_code="200")
        self.invoice.update(invoice_number="AP-2046")
        self.drop(name="AP-2046.pdf")
        index = json.loads(self.w.files["Bookkeeping/Checks/acme-plumbing-intake.json"])
        self.assertEqual(len(index["captured"]), 2, "an existing customer's draft is remembered at intake")

    def test_existing_customer_gets_a_draft_coded_from_its_invoice_history(self):
        self.setup_practice()
        self.add_customer(history_code="260")
        steps = self.drop(name="AP-2045.pdf")
        self.assertNotEqual(steps["post_draft"]["outputs"]["bill_id"], "")
        [inv] = self.sales()
        self.assertEqual((inv["Status"], inv["LineItems"][0]["AccountCode"]), ("DRAFT", "260"))
        self.assertIn("this customer's recent invoices", self.invoice_item()["description"])
        self.approve(self.invoice_item())
        self.assertEqual(self.sales()[0]["Status"], "AUTHORISED")

    def test_the_client_abn_marks_a_sales_invoice_even_under_a_trading_name(self):
        self.invoice = bayview_invoice(supplier_name="Acme Plumbing & Gas")
        self.setup_practice()
        self.drop(name="AP-2045.pdf")
        self.assertTrue(self.invoice_item())

    def test_ai_codes_sales_lines_against_revenue_accounts_and_gst_on_income(self):
        self.setup_practice()
        self.drop(name="AP-2045.pdf")
        self.assertEqual({a["type"] for a in self.coding_input["accounts"]}, {"REVENUE", "OTHERINCOME"})
        taxes = {t["type"] for t in self.coding_input["tax_rates"]}
        self.assertIn("OUTPUT", taxes)
        self.assertNotIn("INPUT", taxes)
        self.assertEqual(self.coding_input["customer"], "Bayview Hospitality Group")

    def test_a_sales_invoice_number_already_in_xero_is_a_duplicate(self):
        self.setup_practice()
        self.w.xero.orgs[T_ACME]["invoices"].append({"InvoiceID": "x1", "Type": "ACCREC", "Status": "AUTHORISED", "InvoiceNumber": "AP-2045",
                                                      "Contact": {"ContactID": "c9", "Name": "Someone Else"}, "LineItems": []})
        steps = self.drop(name="AP-2045.pdf")
        self.assertEqual(steps["route_review"]["outputs"]["outcome"], "exception")
        item = next(i for i in self.w.items.values() if "bill-exception" in i["labels"])
        self.assertIn("Duplicate: sales invoice AP-2045", item["description"])

    def test_a_paid_invoice_is_flagged_for_reconciliation(self):
        self.invoice = bayview_invoice(paid=True, amount_due=0)
        self.setup_practice()
        self.drop(name="AP-2045.pdf")
        self.assertIn("looks paid already", self.invoice_item()["description"])

    def test_paid_stamp_on_the_pdf_is_flagged_even_when_the_ai_misses_it(self):
        from test_flows import make_pdf
        self.invoice = bayview_invoice(paid=False, amount_due=2376.0)
        self.setup_practice()
        self.drop(name="AP-2045.pdf", data=make_pdf(["TAX INVOICE", "Acme Plumbing Pty Ltd", "Invoice AP-2045",
                                                     "Amount due $0.00  PAID 28/09/2026", "PAID IN FULL. Thank you."]))
        self.assertIn('looks paid already (the PDF says "PAID IN FULL")', self.invoice_item()["description"])

    def test_a_paid_tax_invoice_read_as_a_receipt_is_still_captured(self):
        from test_flows import make_pdf
        self.invoice = bayview_invoice(document_type="receipt", paid=False)
        self.setup_practice()
        steps = self.drop(name="AP-2045.pdf", data=make_pdf(["TAX INVOICE", "Acme Plumbing Pty Ltd", "Invoice number AP-2045",
                                                             "Amount due $0.00", "PAID IN FULL on 28/09/2026"]))
        self.assertEqual(steps["route_review"]["outputs"]["outcome"], "review")
        self.assertIn("looks paid already", self.invoice_item()["description"])

    def test_an_unpaid_invoice_is_not_flagged(self):
        from test_flows import make_pdf
        self.setup_practice()
        self.drop(name="AP-2045.pdf", data=make_pdf(["TAX INVOICE", "Acme Plumbing Pty Ltd", "Invoice AP-2045",
                                                     "Amount due $2,376.00", "UNPAID balances attract interest"]))
        self.assertNotIn("looks paid", self.invoice_item()["description"])

    def test_the_client_approval_limit_does_not_apply_to_sales(self):
        self.setup_practice(client_above="100")
        self.drop(name="AP-2045.pdf")
        steps = self.approve(self.invoice_item())
        self.assertEqual(steps["apply_decision"]["outputs"]["outcome"], "approved")
        self.assertEqual(self.sales()[0]["Status"], "AUTHORISED")

    def test_remembered_coding_is_kept_per_customer(self):
        self.setup_practice()
        self.drop(name="AP-2045.pdf")
        self.approve(self.invoice_item(), q_remember=True)
        rules = json.loads(self.w.files["Bookkeeping/Rules/acme-plumbing.json"])
        self.assertIn("name:bayview hospitality group", rules["customers"])
        self.assertEqual(rules["suppliers"], {})

    def test_missing_due_date_uses_the_sales_terms(self):
        self.invoice = bayview_invoice(due_date="")
        self.setup_practice()
        self.w.xero.orgs[T_ACME]["sales_terms"] = {"Day": 7, "Type": "DAYSAFTERBILLDATE"}
        self.drop(name="AP-2045.pdf")
        self.assertIn("due 2026-10-07", self.invoice_item()["description"])

    def test_a_bill_to_someone_else_is_treated_as_a_bill_with_a_warning(self):
        self.invoice = bayview_invoice(supplier_name="Sparky Electrical Pty Ltd", supplier_abn="51 824 753 556",
                                       bill_to="Gamma Holdings")
        self.setup_practice()
        self.drop(name="AP-2045.pdf")
        item = self.review_item()
        self.assertIn("neither looks like", item["description"])

    def test_bills_still_go_to_bill_review(self):
        self.invoice = bayview_invoice(supplier_name="Sparky Electrical Pty Ltd", supplier_abn="51 824 753 556",
                                       bill_to="Acme Plumbing Pty Ltd")
        self.coding = []
        self.setup_practice()
        self.add_supplier(T_ACME, history_code="449")
        self.drop(name="AP-2045.pdf")
        self.assertTrue(self.review_item()["title"].startswith("Review bill: Sparky Electrical"))
        self.assertFalse(any("invoice-review" in i["labels"] for i in self.w.items.values()))


if __name__ == "__main__":
    unittest.main()
