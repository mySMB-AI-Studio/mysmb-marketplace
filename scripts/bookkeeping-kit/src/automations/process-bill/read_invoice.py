from pypdf import PdfReader, PdfWriter

EXTRACT_PROMPT = (
    "You read supplier invoices for an Australian bookkeeper. From the document text, extract the invoice exactly as "
    "printed. Never guess: use null for anything not in the text. Dates as YYYY-MM-DD (Australian documents are "
    "day/month/year). Amounts as plain numbers without currency symbols. amounts_include_tax is true when line amounts "
    "already include GST. document_type is one of: tax invoice, invoice, credit note, bank statement (a bank or credit "
    "card statement), statement (a statement of account), receipt, quote, remittance, other. invoice_count is how many separate invoices the text contains. For each field group give a "
    "confidence of high, medium or low. supplier_name and supplier_abn are the business that issued the document "
    "(its letterhead); bill_to and bill_to_abn are the business it is addressed to. amount_due is the balance still "
    "owing as printed; paid is true only when the document says it has been paid. abns_printed lists every ABN printed "
    "anywhere on the document, as 11 digits. pay_bsb and pay_account are the bank details the document asks to be paid "
    "into (BSB as 6 digits, account number digits only); null when none are printed."
)
SCHEMA_HINT = (
    '{"document_type": "tax invoice", "invoice_count": 1, "supplier_name": "", "supplier_abn": "", '
    '"invoice_number": "", "issue_date": "YYYY-MM-DD", "due_date": "YYYY-MM-DD or null", "currency": "AUD", '
    '"reference": "", "bill_to": "", "bill_to_abn": "", "amount_due": 0, "paid": false, "amounts_include_tax": false, '
    '"abns_printed": [], "pay_bsb": null, "pay_account": null, '
    '"lines": [{"description": "", "quantity": 1, "unit_amount": 0, "line_amount": 0, "tax_amount": 0}], '
    '"subtotal": 0, "tax_total": 0, "total": 0, '
    '"confidence": {"supplier": "high", "invoice_number": "high", "dates": "high", "amounts": "high"}}'
)

STATEMENT_PROMPT = (
    "You read statements for an Australian bookkeeper. kind is 'bank' for a bank or credit card statement, 'supplier' "
    "for a statement of account from a supplier, 'customer' for a statement of account the business sent to its "
    "customer. Extract exactly as printed; null for anything that isn't there. Dates as YYYY-MM-DD (day/month/year). "
    "Amounts as plain numbers. closing_balance is the balance at the end of the statement: for a credit card or a "
    "statement of account, the amount owing, as a positive number. party_name is the supplier or customer on a statement "
    "of account; addressed_to is the account holder or the business the statement is addressed to. invoices lists the "
    "invoices a statement of account shows as open. statement_count is how many separate statements (accounts or "
    "periods) the text contains."
)
STATEMENT_HINT = (
    '{"kind": "bank", "institution": "", "account_name": "", "bsb": "", "account_number": "", "card_last4": "", '
    '"party_name": "", "party_abn": "", "addressed_to": "", "period_start": "YYYY-MM-DD", "period_end": "YYYY-MM-DD", '
    '"opening_balance": 0, "closing_balance": 0, "currency": "AUD", '
    '"invoices": [{"number": "", "date": "YYYY-MM-DD", "amount": 0}], "statement_count": 1}'
)

LINES_PROMPT = (
    "You list the transactions on a bank or credit card statement for an Australian bookkeeper: one row per "
    "transaction line, in the order printed. The text may be one page, or part of a page, of a longer statement. Skip "
    "opening and closing balance rows, totals and page headers. Each row is [date, description, reference, amount, "
    "balance]: date as YYYY-MM-DD (day/month/year); description as printed (merchant or narrative); reference is a "
    "reference or cheque number printed in its own column, else null; amount is from the account holder's side: money "
    "into the account (deposits, credits, card payments, refunds) positive, money out (withdrawals, debits, purchases, "
    "fees, interest charged) negative; balance is the running balance printed on that line, or null."
)
LINES_HINT = '{"lines": [["YYYY-MM-DD", "description", null, -12.5, 1234.56]]}'
# Statement pages whose transactions are read (one AI call per page).
STATEMENT_PAGES = 15


def _rows(got):
    rows = got.get("lines") if isinstance(got, dict) else got
    out = []
    for r in rows if isinstance(rows, list) else []:
        if isinstance(r, (list, tuple)) and len(r) >= 4:
            r = {"date": r[0], "description": r[1], "reference": r[2], "amount": r[3], "balance": r[4] if len(r) > 4 else None}
        if isinstance(r, dict):
            out.append(r)
    return out


def _lines_of(chunk, depth=0):
    """The transactions in one page's text. An AI answer holds about 40 rows, so a page whose answer is cut off is read
    again in halves (twice at most); anything still missing shows up when the lines don't add up to the closing balance."""
    if not chunk.strip():
        return []
    try:
        return _rows(api.ai.extract(prompt=LINES_PROMPT, input=chunk[:28000], schema_hint=LINES_HINT))
    except Exception:
        text_rows = chunk.splitlines()
        if depth >= 2 or len(text_rows) < 6:
            return []
        mid = len(text_rows) // 2
        return _lines_of("\n".join(text_rows[:mid]), depth + 1) + _lines_of("\n".join(text_rows[mid:]), depth + 1)


# A scan or a photo has no text layer, so the AI reads the pages themselves (an AI step reads at most 20).
SCAN_PAGES = 10


def _pages_pdf(first, count, name):
    """A scratch PDF of `count` pages from page `first` (the file itself when that's all of it)."""
    if reader is None or (first == 0 and len(reader.pages) <= count):
        return local
    writer = PdfWriter()
    for page in reader.pages[first:first + count]:
        writer.add_page(page)
    out = api.files.scratch_path(name)
    writer.write(out)
    return out


def _read(prompt, hint):
    """One AI read of the document, from its text or, for a scan, its first pages: (result, error text)."""
    exc = None  # the platform lint wants names bound before `except ... as`
    if not scanned:
        return api.ai.extract(prompt=prompt, input=text[:28000], schema_hint=hint), ""
    try:
        return api.ai.extract(prompt=prompt, schema_hint=hint, scratch_file=_pages_pdf(0, SCAN_PAGES, "scan.pdf")), ""
    except Exception as exc:
        return None, str(exc)[:200]


def _scan_lines(i):
    """The transactions on page i of a scanned statement, read from the page image."""
    try:
        return _rows(api.ai.extract(prompt=LINES_PROMPT, schema_hint=LINES_HINT,
                                    scratch_file=_pages_pdf(i, 1, "page-" + str(i + 1) + ".pdf")))
    except Exception:
        return []


# What a paid invoice prints. Checked on the text itself, so the flag doesn't depend on the AI noticing.
PAID_MARKS = [r"(?i)\bpaid in full\b", r"(?i)\bpaid\s+(on\s+)?\d{1,2}[/.-]\d{1,2}", r"(?<![A-Za-z])PAID(?![A-Za-z])",
              r"(?i)\b(amount|balance)\s+(due|owing|outstanding)\W{0,3}(aud)?\s*\$?\s*0(\.00)?(?![\d.])"]

problem = params.get("problem") or ""
invoice = {}
statement = {}
if not problem:
    text = ""
    pages = []
    local = ""
    reader = None
    try:
        local = api.files.get(file=params["path"])
        reader = PdfReader(local)
        pages = [(page.extract_text() or "") for page in reader.pages[:STATEMENT_PAGES]]
        text = "\n".join(pages[:10])
    except Exception as exc:
        problem = (("The PDF" if params["path"].lower().endswith(".pdf") else "The photo") + " couldn't be opened ("
                   + str(exc)[:200] + ").")
    scanned = not problem and len(text.strip()) < 40
    if not problem:
        result, error = _read(EXTRACT_PROMPT, SCHEMA_HINT)
        if error:
            problem = ("This PDF has no readable text (it's a scan or a photo), and the AI couldn't read the image "
                       "either (" + error + "). Key this bill by hand.")
        elif not isinstance(result, dict):
            problem = "The AI couldn't read this invoice's details."
        else:
            doc_type = str(result.get("document_type") or "").lower()
            count = result.get("invoice_count") or 1
            paid_mark = ""
            for pattern in PAID_MARKS:
                m = re.search(pattern, text)
                if m:
                    paid_mark = re.sub(r"\s+", " ", m.group(0)).strip()
                    break
            if scanned:
                result["read_from"] = "scan"
            if (doc_type == "receipt" and (paid_mark or (scanned and result.get("paid"))) and result.get("invoice_number")
                    and (scanned or re.search(r"(?i)\b(tax\s+)?invoice\b", text))):
                # A tax invoice stamped PAID is still an invoice to record, just one that's already paid.
                doc_type = "tax invoice"
                result["document_type"] = doc_type
            if doc_type in ("bank statement", "statement"):
                read, error = _read(STATEMENT_PROMPT, STATEMENT_HINT)
                if not isinstance(read, dict):
                    problem = "The AI couldn't read this statement."
                elif isinstance(read.get("statement_count"), (int, float)) and read["statement_count"] > 1:
                    problem = ("This PDF contains " + str(int(read["statement_count"])) + " statements. Split it into one PDF "
                               "per statement and drop them in again.")
                else:
                    statement = read
                    if scanned:
                        statement["read_from"] = "scan"
                    if doc_type == "bank statement" and not read.get("kind"):
                        statement["kind"] = "bank"
                    if str(statement.get("kind") or "").lower() in ("bank", "credit card", "credit_card", "card"):
                        # The transactions too, page by page, so the statement can become a CSV that Xero's
                        # statement import accepts.
                        rows = []
                        if scanned:
                            for i in range(len(pages)):
                                rows.extend(_scan_lines(i))
                        else:
                            for page_text in pages:
                                rows.extend(_lines_of(page_text))
                        statement["lines"] = rows
            elif doc_type not in ("tax invoice", "invoice"):
                problem = "This document looks like a " + (doc_type or "non-invoice") + ", not an invoice, so it wasn't posted."
            elif isinstance(count, (int, float)) and count > 1:
                problem = "This PDF contains " + str(int(count)) + " invoices. Split it into one PDF per invoice and drop them in again."
            else:
                invoice = result
                invoice["paid_mark"] = paid_mark
