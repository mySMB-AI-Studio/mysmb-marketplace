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

SPLIT_PROMPT = (
    "This PDF holds several separate documents one after another: invoices, bills, receipts or statements. List each "
    "one with its first and last page (pages count from 1; in text they are marked '=== Page N ==='). Leave out pages "
    "that belong to no document, such as a cover letter, a remittance slip or a blank page. For each, give its type, "
    "number and who issued it."
)
SPLIT_HINT = '{"documents": [{"first_page": 1, "last_page": 2, "type": "tax invoice", "number": "INV-1001", "issuer": ""}]}'
# The most pages a PDF can have to be split (an AI step reads at most 20 pages of a scan).
SPLIT_PAGES = 20
# Process bill can't start itself, so the parts go here and Bookkeeping: File split documents moves each into the
# client's inbox folder, where each one is processed like any other PDF.
BK_SPLIT = "Bookkeeping Split"


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

def _ranges(got, total):
    """[(first, last, doc)] from the AI's answer: whole pages within the PDF, in order, not overlapping; [] otherwise."""
    docs = got.get("documents") if isinstance(got, dict) else got
    out = []
    for d in docs if isinstance(docs, list) else []:
        if not isinstance(d, dict):
            return []
        first = d.get("first_page")
        last = d.get("last_page")
        if not isinstance(first, (int, float)) or not isinstance(last, (int, float)):
            return []
        first, last = int(first), int(last)
        if first < 1 or last < first or last > total:
            return []
        out.append((first, last, d))
    out.sort(key=lambda r: r[0])
    for a, b in zip(out, out[1:]):
        if b[0] <= a[1]:
            return []
    return out


def _split(count, what):
    """Split a PDF holding `count` documents into one PDF each (in Bookkeeping Split, from where they reach the
    client's inbox folder) and file the original. Returns how many parts, or 0 with the problem to report."""
    pdf = reader
    total = len(pdf.pages) if pdf is not None else 0
    fallback = ("This PDF contains " + str(int(count)) + " " + what + ". Split it into one PDF per " + what.rstrip("s")
                + " and drop them in again.")
    if pdf is None or total < 2 or total > SPLIT_PAGES or not folder:
        return 0, fallback
    exc = None  # the platform lint wants names bound before `except ... as`
    try:
        if scanned:
            got = api.ai.extract(prompt=SPLIT_PROMPT, schema_hint=SPLIT_HINT, scratch_file=local)
        else:
            every = [(page.extract_text() or "") for page in pdf.pages]
            got = api.ai.extract(prompt=SPLIT_PROMPT, schema_hint=SPLIT_HINT,
                                 input="\n".join("=== Page " + str(i + 1) + " ===\n" + t for i, t in enumerate(every))[:28000])
    except Exception as exc:
        return 0, fallback
    ranges = _ranges(got, total)
    if len(ranges) < 2:
        return 0, fallback
    name = params["path"].split("/")[-1]
    base = name.rsplit(".", 1)[0]
    # Each part came from the same email as the whole, so its review item can say so.
    came_from = bk_origin(name)
    for i, (first, last, doc) in enumerate(ranges):
        writer = PdfWriter()
        for page in pdf.pages[first - 1:last]:
            writer.add_page(page)
        number = re.sub(r"[^A-Za-z0-9 -]+", "", str(doc.get("number") or "")).strip()[:30]
        part = (base[:70] + " (part " + str(i + 1) + " of " + str(len(ranges)) + (", " + number if number else "") + ").pdf")
        out = api.files.scratch_path(part)
        writer.write(out)
        if came_from:
            bk_note_origin(part, dict(came_from, split_from=name))
        api.files.put(file=BK_SPLIT + "/" + folder + "/" + part, scratch_file=out)
    bk_move(params["path"], BK_PROCESSED + "/" + folder + "/" + name)
    return len(ranges), ""


problem = params.get("problem") or ""
folder = params.get("folder") or ""
invoice = {}
statement = {}
split_into = 0
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
        if params["path"].lower().endswith((".heic", ".heif")):
            problem = ("This is an iPhone photo in Apple's HEIC format, which can't be opened here. Email it to the "
                       "bookkeeping inbox instead (Email intake converts it), or save it as a JPEG (on an iPhone: Settings, "
                       "Camera, Formats, Most Compatible) and drop it in again.")
        else:
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
                    split_into, problem = _split(read["statement_count"], "statements")
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
                split_into, problem = _split(count, "invoices")
            else:
                invoice = result
                invoice["paid_mark"] = paid_mark
