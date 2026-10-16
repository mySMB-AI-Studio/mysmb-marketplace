"""A PDF holding several invoices (or statements) is split into one PDF each; File split documents moves each part into
the client's inbox folder, where Process bill takes it like any other PDF."""
import io
import unittest

from harness import run_flow
from test_flows import AUTOS, BOOKKEEPER, T_ACME, Base, sparky_invoice
from test_scans import blank_pages
from test_statements import bank_statement

PROCESS = "Bookkeeping: Process bill, invoice or statement (Xero)"
RELAY = "Bookkeeping: File split documents"


def pages_pdf(texts):
    """One page per entry, each page a list of lines."""
    from fpdf import FPDF
    pdf = FPDF()
    pdf.set_font("Helvetica", size=11)
    for lines in texts:
        pdf.add_page()
        for line in lines:
            pdf.cell(0, 8, line, new_x="LMARGIN", new_y="NEXT")
    return bytes(pdf.output())


def page_count(data):
    from pypdf import PdfReader
    return len(PdfReader(io.BytesIO(data)).pages)


class SplitTests(Base):
    def setUp(self):
        super().setUp()
        self.setup_practice()
        self.add_supplier(T_ACME, history_code="449")
        self.split_answer = {"documents": [{"first_page": 1, "last_page": 1, "number": "INV-1"},
                                           {"first_page": 2, "last_page": 2, "number": "INV-2"},
                                           {"first_page": 3, "last_page": 3, "number": "INV-3"}]}
        self.split_inputs = []

    def fake_extract(self, prompt, input):
        if prompt.startswith("This PDF holds several separate documents"):
            self.split_inputs.append(input)
            return self.split_answer
        return super().fake_extract(prompt, input)

    def three_invoices(self):
        return pages_pdf([["TAX INVOICE INV-" + str(i), "Sparky Electrical", "Total 110.00"] for i in (1, 2, 3)])

    def parts(self):
        return sorted(p for p in self.w.files if p.startswith("Bookkeeping Split/"))

    def relay(self, path):
        trigger = {"kind": "event", "actor_user_id": BOOKKEEPER,
                   "event": {"eventType": "knowledge.file_created", "subject": {"path": path, "scope": "org"}, "payload": {}}}
        return run_flow(self.w, AUTOS[RELAY], trigger)["relay"]["outputs"]["moved_to"]

    def test_three_invoices_in_one_pdf_become_three_bills(self):
        self.invoice = sparky_invoice(invoice_count=3)
        steps = self.drop(name="Sparky October.pdf", data=self.three_invoices())
        self.assertEqual(steps["read_invoice"]["outputs"]["split_into"], 3)
        self.assertNotIn("route_review", steps)
        self.assertNotIn("check_and_code", steps)
        self.assertEqual(self.parts(), ["Bookkeeping Split/acme-plumbing/Sparky October (part 1 of 3, INV-1).pdf",
                                        "Bookkeeping Split/acme-plumbing/Sparky October (part 2 of 3, INV-2).pdf",
                                        "Bookkeeping Split/acme-plumbing/Sparky October (part 3 of 3, INV-3).pdf"])
        self.assertTrue(all(page_count(self.w.files[p]) == 1 for p in self.parts()))
        self.assertIn("Bookkeeping Processed/acme-plumbing/Sparky October.pdf", self.w.files)
        self.assertNotIn("Bookkeeping Inbox/acme-plumbing/Sparky October.pdf", self.w.files)
        self.assertFalse(any("bill-exception" in i["labels"] for i in self.w.items.values()))
        self.assertIn("=== Page 3 ===", self.split_inputs[0])
        # Each part reaches the inbox (File split documents) and is processed as one bill.
        self.invoice = sparky_invoice()
        for part in self.parts():
            moved = self.relay(part)
            self.assertTrue(moved.startswith("Bookkeeping Inbox/acme-plumbing/"))
        self.assertEqual(self.parts(), [])
        steps = self.drop(name="Sparky October (part 1 of 3, INV-1).pdf", data=self.w.files[
            "Bookkeeping Inbox/acme-plumbing/Sparky October (part 1 of 3, INV-1).pdf"])
        self.assertEqual(steps["route_review"]["outputs"]["outcome"], "review")

    def test_a_two_page_invoice_stays_together(self):
        self.invoice = sparky_invoice(invoice_count=2)
        self.split_answer = {"documents": [{"first_page": 1, "last_page": 2}, {"first_page": 3, "last_page": 3}]}
        self.drop(name="two.pdf", data=self.three_invoices())
        self.assertEqual([page_count(self.w.files[p]) for p in self.parts()], [2, 1])
        self.assertEqual([p.split("/")[-1] for p in self.parts()], ["two (part 1 of 2).pdf", "two (part 2 of 2).pdf"])

    def test_a_scan_is_split_from_the_page_images(self):
        self.invoice = sparky_invoice(invoice_count=3)
        self.drop(name="scan.pdf", data=blank_pages(3))
        self.assertEqual(len(self.parts()), 3)
        self.assertEqual(self.split_inputs, [""])  # read from the images, not text
        self.assertTrue(any(f.endswith("scan.pdf") for f in self.w.ai_files))

    def test_page_ranges_that_dont_make_sense_fall_back_to_asking_for_a_split(self):
        self.invoice = sparky_invoice(invoice_count=3)
        self.split_answer = {"documents": [{"first_page": 1, "last_page": 2}, {"first_page": 2, "last_page": 3}]}
        steps = self.drop(name="overlap.pdf", data=self.three_invoices())
        self.assertEqual(steps["route_review"]["outputs"]["outcome"], "exception")
        self.assertEqual(self.parts(), [])
        item = next(i for i in self.w.items.values() if "bill-exception" in i["labels"])
        self.assertIn("contains 3 invoices. Split it into one PDF per invoice", item["description"])

    def test_more_than_twenty_pages_is_not_split(self):
        self.invoice = sparky_invoice(invoice_count=2)
        steps = self.drop(name="long.pdf", data=pages_pdf([["Page " + str(i)] for i in range(25)]))
        self.assertEqual(steps["route_review"]["outputs"]["outcome"], "exception")
        self.assertEqual(self.split_inputs, [])

    def test_two_statements_in_one_pdf_are_split_too(self):
        self.invoice = {"document_type": "bank statement", "invoice_count": 1}
        statement = bank_statement(statement_count=2)

        def extract(prompt, input):
            if prompt.startswith("You read statements"):
                return statement
            return self.fake_extract(prompt, input)
        self.w.ai_extract = extract
        self.split_answer = {"documents": [{"first_page": 1, "last_page": 2}, {"first_page": 3, "last_page": 3}]}
        steps = self.drop(name="Westpac.pdf", data=self.three_invoices())
        self.assertEqual(steps["read_invoice"]["outputs"]["split_into"], 2)
        self.assertNotIn("file_statement", steps)

    def test_file_split_documents_ignores_everything_else(self):
        self.w.files["Bookkeeping Inbox/acme-plumbing/INV-9.pdf"] = b"%PDF-1.7"
        self.assertEqual(self.relay("Bookkeeping Inbox/acme-plumbing/INV-9.pdf"), "")
        self.w.files["Bookkeeping Split/acme-plumbing/_README.txt"] = "x"
        self.assertEqual(self.relay("Bookkeeping Split/acme-plumbing/_README.txt"), "")
        self.assertIn("Bookkeeping Inbox/acme-plumbing/INV-9.pdf", self.w.files)


if __name__ == "__main__":
    unittest.main()
