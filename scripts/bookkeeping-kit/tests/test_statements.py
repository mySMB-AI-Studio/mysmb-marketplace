"""Statements: bank and card statements are attached to their bank account in Xero, statements of account to the
supplier or customer; balances and listed invoices are compared with Xero, and only differences reach WorkQ."""
import json
import unittest

from harness import run_flow
from test_flows import AUTOS, BOOKKEEPER, T_ACME, Base, make_pdf

PROCESS = "Bookkeeping: Process bill, invoice or statement (Xero)"
STATEMENT_TEXT = ["Westpac Business One", "Account: Business Cheque Account  BSB 062-000  Account 1234 5678",
                  "Statement period 01/09/2026 to 30/09/2026", "Opening balance 10,000.00", "Closing balance 12,840.55"]


def bank_statement(**over):
    st = {"kind": "bank", "institution": "Westpac", "account_name": "Business One", "bsb": "062-000",
          "account_number": "1234 5678", "card_last4": None, "party_name": None, "party_abn": None,
          "addressed_to": "Acme Plumbing Pty Ltd", "period_start": "2026-09-01", "period_end": "2026-09-30",
          "opening_balance": 10000.0, "closing_balance": 12840.55, "currency": "AUD", "invoices": [], "statement_count": 1}
    st.update(over)
    return st


class StatementTests(Base):
    def setUp(self):
        super().setUp()
        self.doc = {"document_type": "bank statement", "invoice_count": 1}
        self.statement = bank_statement()
        self.lines_fake = None
        self.setup_practice()

    def fake_extract(self, prompt, input):
        if prompt.startswith("You read supplier invoices"):
            return self.doc if self.doc is not None else self.invoice
        if prompt.startswith("You read statements"):
            return self.statement
        if prompt.startswith("You list the transactions"):
            if self.lines_fake:
                return self.lines_fake(input)
            return {"lines": self.statement.get("lines") or []}
        return super().fake_extract(prompt, input)

    def drop_statement(self, name="Westpac September.pdf"):
        return self.drop(name=name, data=make_pdf(STATEMENT_TEXT))

    def hosts(self):
        return self.w.xero.orgs[T_ACME]["attachment_hosts"]

    def items(self):
        return [i for i in self.w.items.values() if "statement-check" in i["labels"] or "bill-exception" in i["labels"]]

    def test_a_bank_statement_is_attached_to_its_bank_account_quietly(self):
        steps = self.drop_statement()
        self.assertEqual(steps["file_statement"]["outputs"]["outcome"], "filed")
        self.assertEqual(self.hosts(), [("Accounts", "BANK1", "Business Cheque Account statement 2026-09-30.pdf")])
        self.assertEqual(self.items(), [])
        self.assertIn("Bookkeeping Processed/acme-plumbing/Westpac September.pdf", self.w.files)
        log = json.loads(self.w.files["Bookkeeping/Statements/acme-plumbing.json"])["statements"]
        self.assertEqual((log[-1]["filed_to"], log[-1]["issues"]), ("bank account Business Cheque Account", []))
        self.assertNotIn("check_and_code", steps)
        self.assertEqual(self.acme_bills(), [])

    def test_a_statement_not_in_xero_whose_lines_cannot_be_read_is_flagged(self):
        self.statement = bank_statement(closing_balance=13000.00)
        steps = self.drop_statement()
        self.assertEqual(steps["file_statement"]["outputs"]["outcome"], "filed_with_issues")
        self.assertEqual(steps["file_statement"]["outputs"]["csv_path"], "")
        [item] = self.items()
        self.assertIn("statement-check", item["labels"])
        self.assertIn("13,000.00", item["description"])
        self.assertIn("12,840.55", item["description"])
        self.assertIn("no usable transaction lines", item["description"])
        self.assertEqual(len(self.hosts()), 1)

    def test_lines_that_do_not_add_up_make_no_import_file(self):
        self.w.xero.orgs[T_ACME]["bank_balances"]["BANK1"] = 0
        self.statement = bank_statement(opening_balance=0.0, closing_balance=250.0, lines=[
            {"date": "2026-09-02", "description": "Transfer from savings", "amount": 400.0}])
        steps = self.drop_statement()
        self.assertEqual(steps["file_statement"]["outputs"]["outcome"], "filed_with_issues")
        [item] = self.items()
        self.assertIn("1 lines moving 400.00, the statement moves 250.00", item["description"])
        self.assertFalse(any(p.endswith(".csv") for p in self.w.files))

    def import_items(self):
        return [i for i in self.w.items.values() if "statement-import" in i["labels"]]

    def test_a_statement_not_yet_in_xero_becomes_a_csv_for_the_statement_import(self):
        self.w.xero.orgs[T_ACME]["bank_balances"]["BANK1"] = 0
        self.statement = bank_statement(opening_balance=0.0, closing_balance=250.0, lines=[
            {"date": "2026-09-02", "description": "Transfer from savings", "reference": None, "amount": 400.0, "balance": 400.0},
            {"date": "2026-09-15", "description": 'Officeworks, Sydney "store 12"', "reference": "C123", "amount": -150.0, "balance": 250.0}])
        steps = self.drop_statement()
        out = steps["file_statement"]["outputs"]
        self.assertEqual(out["outcome"], "ready_to_import")
        self.assertEqual(out["csv_path"], "Bookkeeping Processed/acme-plumbing/Business Cheque Account 2026-09-30 for Xero import.csv")
        csv_text = self.w.files[out["csv_path"]]
        self.assertEqual(csv_text.split("\r\n"), [
            "*Date,*Amount,Payee,Description,Reference,Check Number",
            "02/09/2026,400.00,Transfer from savings,Transfer from savings,,",
            '15/09/2026,-150.00,"Officeworks, Sydney ""store 12""","Officeworks, Sydney ""store 12""",C123,', ""])
        self.assertEqual([h[2] for h in self.hosts()], ["Business Cheque Account statement 2026-09-30.pdf",
                                                         "Business Cheque Account 2026-09-30 for Xero import.csv"])
        [item] = self.import_items()
        self.assertTrue(item["title"].startswith("Import statement into Xero: Business Cheque Account"))
        self.assertIn("**2 transactions**", item["description"])
        self.assertIn("dd/mm/yyyy", item["description"])
        self.assertNotIn("earlier statement may be missing", item["description"])
        self.assertEqual(self.items(), [])
        log = json.loads(self.w.files["Bookkeeping/Statements/acme-plumbing.json"])["statements"]
        self.assertEqual((log[-1]["import_file"], log[-1]["lines"]), (out["csv_path"], 2))

    def test_a_long_statement_is_read_page_by_page_and_a_cut_off_page_in_halves(self):
        # 60 transactions over two pages. An AI answer holds about 40 rows, so the fake cuts off any answer over 20.
        self.w.xero.orgs[T_ACME]["bank_balances"]["BANK1"] = 0
        rows = [["2026-09-%02d" % (i % 28 + 1), "Card purchase #%03d" % i, None, -10.0, 1000.0 - 10 * i] for i in range(1, 61)]
        text = (STATEMENT_TEXT[:3] + ["Opening balance 1,000.00"]
                + ["%s  Card purchase #%03d  10.00" % (r[0], i) for i, r in enumerate(rows, 1)] + ["Closing balance 400.00"])
        self.statement = bank_statement(opening_balance=1000.0, closing_balance=400.0)
        calls = []

        def lines(input):
            calls.append(input)
            mine = [r for r in rows if r[1] in input]
            if len(mine) > 20:
                raise RuntimeError("api.ai.extract: unterminated JSON in model response (stop_reason=max_tokens)")
            return {"lines": mine}
        self.lines_fake = lines
        steps = self.drop(name="Westpac September.pdf", data=make_pdf(text))
        out = steps["file_statement"]["outputs"]
        self.assertEqual(out["outcome"], "ready_to_import")
        self.assertEqual(len(self.w.files[out["csv_path"]].split("\r\n")), 62)
        self.assertEqual(len(calls), 6)  # two pages, each cut off and read again in halves

    def test_a_statement_that_does_not_follow_on_from_xero_warns_before_importing(self):
        self.w.xero.orgs[T_ACME]["bank_balances"]["BANK1"] = 0
        self.statement = bank_statement(opening_balance=100.0, closing_balance=350.0, lines=[
            {"date": "2026-09-02", "description": "Customer payment", "amount": 250.0}])
        steps = self.drop_statement()
        self.assertEqual(steps["file_statement"]["outputs"]["outcome"], "ready_to_import")
        [item] = self.import_items()
        self.assertIn("Xero shows 0.00 in Business Cheque Account at the start of the period, but the statement opens at 100.00",
                      item["description"])

    def test_a_statement_sent_again_warns_it_already_has_an_import_file(self):
        self.w.xero.orgs[T_ACME]["bank_balances"]["BANK1"] = 0
        self.statement = bank_statement(opening_balance=0.0, closing_balance=250.0, lines=[
            {"date": "2026-09-02", "description": "Customer payment", "amount": 250.0}])
        self.drop_statement()
        self.assertNotIn("already became an import file", self.import_items()[0]["description"])
        self.drop_statement(name="Westpac September again.pdf")
        second = [i for i in self.import_items() if "already became an import file" in i["description"]]
        self.assertEqual(len(second), 1)
        self.assertIn("Business Cheque Account 2026-09-30 for Xero import.csv", second[0]["description"])

    def test_a_card_statement_not_in_xero_imports_purchases_as_money_out(self):
        org = self.w.xero.orgs[T_ACME]
        org["bank_openings"]["CARD1"] = -1520.10
        self.statement = bank_statement(account_name="Visa Business", account_number=None, bsb=None, card_last4="4321",
                                        opening_balance=1520.10, closing_balance=1700.10, lines=[
                                            {"date": "2026-09-03", "description": "Qantas", "amount": -250.0},
                                            {"date": "2026-09-20", "description": "Payment, thank you", "amount": 70.0}])
        steps = self.drop_statement(name="Visa September.pdf")
        out = steps["file_statement"]["outputs"]
        self.assertEqual(out["outcome"], "ready_to_import")
        self.assertIn("03/09/2026,-250.00,Qantas", self.w.files[out["csv_path"]])
        self.assertNotIn("earlier statement", self.import_items()[0]["description"])

    def test_a_credit_card_statement_matches_on_the_last_four_digits(self):
        self.statement = bank_statement(account_name="Visa Business", account_number=None, bsb=None, card_last4="4321",
                                        closing_balance=1520.10)
        steps = self.drop_statement(name="Visa September.pdf")
        self.assertEqual(steps["file_statement"]["outputs"]["outcome"], "filed")
        self.assertEqual(self.hosts()[0][:2], ("Accounts", "CARD1"))

    def test_an_unknown_account_becomes_an_exception(self):
        self.statement = bank_statement(account_name="Savings", institution="NAB", account_number="9999 0000", bsb="083-000")
        steps = self.drop_statement()
        self.assertEqual(steps["file_statement"]["outputs"]["outcome"], "exception")
        [item] = self.items()
        self.assertIn("Business Cheque Account", item["description"])
        self.assertIn("Bookkeeping Failed/acme-plumbing/Westpac September.pdf", self.w.files)
        self.assertEqual(self.hosts(), [])

    def test_a_supplier_statement_that_agrees_with_xero_is_filed_on_the_contact(self):
        c = self.add_supplier(T_ACME)
        self.w.xero.orgs[T_ACME]["invoices"].append({"InvoiceID": "b1", "Type": "ACCPAY", "Status": "AUTHORISED", "InvoiceNumber": "INV-1001",
                                                      "AmountDue": 440.0, "Contact": dict(c), "LineItems": []})
        self.doc = {"document_type": "statement"}
        self.statement = bank_statement(kind="supplier", party_name="Sparky Electrical Pty Ltd", party_abn="51 824 753 556",
                                        closing_balance=440.0, invoices=[{"number": "INV-1001", "date": "2026-09-01", "amount": 440.0}])
        steps = self.drop_statement(name="Sparky statement.pdf")
        self.assertEqual(steps["file_statement"]["outputs"]["outcome"], "filed")
        self.assertEqual(self.hosts()[0][:2], ("Contacts", c["ContactID"]))

    def test_a_supplier_statement_with_a_bill_missing_from_xero_is_flagged(self):
        c = self.add_supplier(T_ACME)
        self.w.xero.orgs[T_ACME]["invoices"].append({"InvoiceID": "b1", "Type": "ACCPAY", "Status": "AUTHORISED", "InvoiceNumber": "INV-1001",
                                                      "AmountDue": 440.0, "Contact": dict(c), "LineItems": []})
        self.doc = {"document_type": "statement"}
        self.statement = bank_statement(kind="supplier", party_name="Sparky Electrical Pty Ltd", closing_balance=990.0,
                                        invoices=[{"number": "INV-1001", "amount": 440.0}, {"number": "INV-1044", "amount": 550.0}])
        steps = self.drop_statement(name="Sparky statement.pdf")
        self.assertEqual(steps["file_statement"]["outputs"]["outcome"], "filed_with_issues")
        [item] = self.items()
        self.assertIn("On the statement but not in Xero: INV-1044 (550.00)", item["description"])
        self.assertIn("990.00", item["description"])

    def test_two_statements_in_one_pdf_must_be_split(self):
        self.statement = bank_statement(statement_count=2)
        steps = self.drop_statement()
        self.assertEqual(steps["route_review"]["outputs"]["outcome"], "exception")
        self.assertIn("contains 2 statements", next(i for i in self.items())["description"])

    def test_bills_still_go_through_review(self):
        self.doc = None
        steps = self.drop()
        self.assertNotIn("file_statement", steps)
        self.assertEqual(steps["route_review"]["outputs"]["outcome"], "review")

    def test_a_bank_statement_by_email_is_filed_under_the_client(self):
        from test_intake import pdf, recent
        self.w.mail.add("outlook", "Your September statement is ready", "statements@westpac.example", recent(),
                        [pdf(name="Statement September.pdf", lines=STATEMENT_TEXT)])
        original = self.fake_extract

        def extract(prompt, input):
            if prompt.startswith("You triage"):
                return [{"index": 0, "kind": "bank statement", "capture": True, "reason": "Bank statement attached"}]
            return original(prompt, input)
        self.w.ai_extract = extract
        steps = run_flow(self.w, AUTOS["Bookkeeping: Email intake (Outlook)"], {"kind": "schedule", "actor_user_id": BOOKKEEPER})
        self.assertEqual(steps["file_bills"]["outputs"]["filed"], 1)
        self.assertIn("bank statement filed for **acme-plumbing**", steps["file_bills"]["outputs"]["summary"])


if __name__ == "__main__":
    unittest.main()
