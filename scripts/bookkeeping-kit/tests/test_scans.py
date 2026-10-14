"""Scans and photos: a bill with no text layer is read by AI from the image itself (myHubV2 api.ai scratch_file), a
photo becomes a PDF so it's filed and attached in Xero like any other, and anything read from an image is reviewed."""
import io
import json
import os
import random
import unittest

from harness import run_flow
from test_flows import AUTOS, BOOKKEEPER, REVIEWER, T_ACME, T_BETA, Base, blank_pdf, make_pdf
from test_statements import bank_statement

PROCESS = "Bookkeeping: Process bill, invoice or statement (Xero)"
OUTLOOK = "Bookkeeping: Email intake (Outlook)"


def photo(kind="JPEG", noisy=False):
    """A phone photo of a bill. Noise makes it big enough (over 30 KB) to count as a photo attachment in email."""
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (900, 1200), "white")
    draw = ImageDraw.Draw(img)
    draw.rectangle((60, 60, 840, 300), outline="black", width=4)
    draw.text((80, 80), "TAX INVOICE  Sparky Electrical  INV-1001  Total 440.00", fill="black")
    if noisy:
        rng = random.Random(7)
        img.putdata([(rng.randrange(256), rng.randrange(256), rng.randrange(256)) for _ in range(900 * 1200)])
    out = io.BytesIO()
    img.save(out, kind, quality=90) if kind == "JPEG" else img.save(out, kind)
    return out.getvalue()


def blank_pages(n):
    from fpdf import FPDF
    pdf = FPDF()
    for _ in range(n):
        pdf.add_page()
        pdf.rect(20, 20, 150, 200)
    return bytes(pdf.output())


class ScanTests(Base):
    def setUp(self):
        super().setUp()
        self.match = {"client_slug": "acme-plumbing", "addressed_to": "Acme Plumbing Pty Ltd", "bill_to": "Acme Plumbing Pty Ltd",
                      "confidence": "high"}

    def fake_extract(self, prompt, input):
        if prompt.startswith("A bookkeeping practice keeps"):
            return self.match
        return super().fake_extract(prompt, input)

    def add_second_client(self):
        self.w.files["Bookkeeping/Clients/beta-cafe.json"] = json.dumps(
            {"name": "Beta Cafe", "slug": "beta-cafe", "xero_tenant_id": T_BETA, "xero_org_name": "Beta Cafe"})

    def review_items(self):
        return [i for i in self.w.items.values() if "bill-review" in i["labels"]]

    def test_a_scanned_bill_is_read_from_the_image_and_always_reviewed(self):
        # Small, confident bills from known suppliers may skip review; one read from a scan never does.
        self.setup_practice(auto_below="1000", approved="Approved")
        self.add_supplier(T_ACME, history_code="449")
        steps = self.drop(data=blank_pdf())
        self.assertEqual(len(self.w.ai_files), 1)
        self.assertEqual(steps["read_invoice"]["outputs"]["invoice"]["read_from"], "scan")
        self.assertEqual(steps["route_review"]["outputs"]["outcome"], "review")
        [item] = self.review_items()
        self.assertIn("read by AI from a scan or a photo", item["description"])
        [bill] = [b for b in self.acme_bills() if b["InvoiceID"] != "old-1"]
        self.assertEqual(bill["Status"], "DRAFT")
        self.assertIn(("Invoices", bill["InvoiceID"], "INV-1001.pdf"), self.w.xero.orgs[T_ACME]["attachment_hosts"])

    def test_only_the_first_ten_pages_of_a_long_scan_are_sent(self):
        self.setup_practice()
        self.drop(data=blank_pages(25))
        from pypdf import PdfReader
        self.assertEqual(len(PdfReader(self.w.ai_files[0]).pages), 10)

    def test_a_photo_becomes_a_pdf_and_is_processed_like_one(self):
        self.setup_practice()
        self.add_supplier(T_ACME, history_code="449")
        steps = self.drop(name="IMG_0412.jpg", data=photo())
        self.assertEqual(steps["resolve_file"]["outputs"]["path"], "Bookkeeping Inbox/acme-plumbing/IMG_0412 (photo).pdf")
        self.assertEqual(steps["route_review"]["outputs"]["outcome"], "review")
        self.assertNotIn("Bookkeeping Inbox/acme-plumbing/IMG_0412.jpg", self.w.files)
        filed = self.w.files["Bookkeeping Processed/acme-plumbing/IMG_0412 (photo).pdf"]
        self.assertEqual(filed[:5], b"%PDF-")
        [bill] = [b for b in self.acme_bills() if b["InvoiceID"] != "old-1"]
        self.assertIn(("Invoices", bill["InvoiceID"], "IMG_0412 (photo).pdf"), self.w.xero.orgs[T_ACME]["attachment_hosts"])
        self.assertIn("read by AI from a scan or a photo", self.review_items()[0]["description"])

    def test_a_png_photo_works_too_and_other_images_are_ignored(self):
        self.setup_practice()
        steps = self.drop(name="receipt.PNG", data=photo("PNG"))
        self.assertTrue(steps["resolve_file"]["outputs"]["should_process"])
        steps = self.drop(name="receipt.heic", data=b"heic")
        self.assertEqual(steps["resolve_file"]["outputs"]["skip_reason"], "not a PDF or a photo of a bill")

    def test_a_photo_that_is_not_an_image_is_an_exception(self):
        self.setup_practice()
        steps = self.drop(name="bill.jpg", data=b"not really a jpeg")
        self.assertEqual(steps["route_review"]["outputs"]["outcome"], "exception")
        item = next(i for i in self.w.items.values() if "bill-exception" in i["labels"])
        self.assertIn("The photo couldn't be opened", item["description"])
        self.assertIn("Bookkeeping Failed/acme-plumbing/bill.jpg", self.w.files)

    def test_a_photo_dropped_into_the_inbox_itself_is_matched_from_the_image(self):
        self.setup_practice()
        self.add_second_client()
        self.match = {"client_slug": "beta-cafe", "addressed_to": "Beta Cafe", "confidence": "high"}
        path = "Bookkeeping Inbox/IMG_0413.jpg"
        self.w.files[path] = photo()
        trigger = {"kind": "event", "actor_user_id": BOOKKEEPER,
                   "event": {"eventType": "knowledge.file_created", "subject": {"path": path, "scope": "org"}, "payload": {}}}
        steps = run_flow(self.w, AUTOS[PROCESS], trigger)
        out = steps["resolve_file"]["outputs"]
        self.assertEqual((out["client_folder"], out["path"]), ("beta-cafe", "Bookkeeping Inbox/IMG_0413 (photo).pdf"))
        self.assertIn("Bookkeeping Processed/beta-cafe/IMG_0413 (photo).pdf", self.w.files)

    def test_a_scanned_bank_statement_is_read_page_by_page_from_the_images(self):
        self.setup_practice()
        self.w.xero.orgs[T_ACME]["bank_balances"]["BANK1"] = 0
        statement = bank_statement(opening_balance=0.0, closing_balance=250.0)
        pages = {"page-1.pdf": [["2026-09-02", "Customer payment", None, 400.0, 400.0]],
                 "page-2.pdf": [["2026-09-15", "Officeworks", None, -150.0, 250.0]]}

        def extract(prompt, input):
            if prompt.startswith("You read supplier invoices"):
                return {"document_type": "bank statement", "invoice_count": 1}
            if prompt.startswith("You read statements"):
                return statement
            if prompt.startswith("You list the transactions"):
                return {"lines": pages[os.path.basename(self.w.ai_files[-1])]}
            raise AssertionError(prompt[:40])
        self.w.ai_extract = extract
        steps = self.drop(name="Westpac September scan.pdf", data=blank_pages(2))
        out = steps["file_statement"]["outputs"]
        self.assertEqual(out["outcome"], "ready_to_import")
        self.assertEqual(self.w.files[out["csv_path"]].split("\r\n")[1:3],
                         ["02/09/2026,400.00,Customer payment,Customer payment,,", "15/09/2026,-150.00,Officeworks,Officeworks,,"])
        item = next(i for i in self.w.items.values() if "statement-import" in i["labels"])
        self.assertIn("This statement is a scan", item["description"])


class EmailPhotoTests(Base):
    def setUp(self):
        super().setUp()
        self.match = {"client_slug": "beta-cafe", "bill_to": "Beta Cafe", "confidence": "high"}
        self.setup_practice()

    def fake_extract(self, prompt, input):
        if prompt.startswith("You triage"):
            return [{"index": e["index"], "kind": "supplier bill", "capture": True, "reason": "Bill"} for e in json.loads(input)]
        if prompt.startswith("A bookkeeping practice keeps"):
            return self.match
        return super().fake_extract(prompt, input)

    def run_intake(self):
        return run_flow(self.w, AUTOS[OUTLOOK], {"kind": "schedule", "actor_user_id": BOOKKEEPER})

    def test_a_photographed_bill_is_filed_and_placed_from_the_image(self):
        from test_intake import recent
        self.w.files["Bookkeeping/Clients/beta-cafe.json"] = json.dumps(
            {"name": "Beta Cafe", "slug": "beta-cafe", "xero_tenant_id": T_BETA, "xero_org_name": "Beta Cafe"})
        self.w.mail.add("outlook", "Fuel receipt", "tom@beta.example", recent(),
                        [{"id": "a1", "name": "IMG_2231.JPG", "type": "image/jpeg", "bytes": photo(noisy=True)}])
        steps = self.run_intake()
        self.assertEqual(steps["file_bills"]["outputs"]["filed"], 1)
        [path] = [p for p in self.w.files if p.startswith("Bookkeeping Inbox/beta-cafe/")]
        self.assertTrue(path.endswith("IMG_2231.JPG"))
        self.assertTrue(self.w.ai_files[0].endswith("IMG_2231.JPG"))

    def test_an_email_with_a_pdf_keeps_its_photos_and_logos_out(self):
        from test_intake import pdf, recent
        self.w.mail.add("outlook", "Invoice INV-1001", "accounts@sparky.example", recent(),
                        [pdf(), {"id": "a2", "name": "site.jpg", "type": "image/jpeg", "bytes": photo(noisy=True)}])
        self.w.mail.add("outlook", "Thanks!", "alex@acme.example", recent(),
                        [{"id": "a3", "name": "logo.png", "type": "image/png", "bytes": photo("PNG")}])
        steps = self.run_intake()
        self.assertEqual(steps["file_bills"]["outputs"]["filed"], 1)
        filed = [p for p in self.w.files if p.startswith("Bookkeeping Inbox/") and not p.split("/")[-1].startswith("_")]
        self.assertEqual([p.endswith("INV-1001.pdf") for p in filed], [True])


if __name__ == "__main__":
    unittest.main()
