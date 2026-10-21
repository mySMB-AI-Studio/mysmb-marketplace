"""Fake MYOB and QuickBooks Online connectors for the checks packs, shaped like myhub-mcp-servers returns them.

MYOB: src/integrations/myob-accounting (api/methods.ts): list tools return {Count, Items}; the line lists flatten each
document's lines with its number, date, status, card and tax-inclusive flag; a failed call comes back as data,
{"__error": message}. QuickBooks: src/integrations/quickbooks-accounting: list_<entity> runs a query and returns
{QueryResponse: {<Entity>: [...]}}; reports are Intuit's JSON (Rows.Row with ColData, sections with Summary).
"""
import copy
import re
import hashlib
import datetime


class FakeMyob:
    READS = ("list_", "get_")

    def __init__(self):
        self.files = {}  # company file id -> dict
        self.calls = []
        self.errors = {}  # tool -> message, returned as {"__error": ...}

    def add_file(self, fid, name):
        self.files[fid] = {
            "name": name, "cards": [], "suppliers": [], "docs": [], "spend": [], "payments": [], "receipts": [], "quotes": [], "orders": [], "lock": None, "old_connector": False, "journals": [], "statement": [],
            "tax_codes": [{"UID": "tc-gst", "Code": "GST", "Rate": 10.0}, {"UID": "tc-fre", "Code": "FRE", "Rate": 0.0},
                          {"UID": "tc-nt", "Code": "N-T", "Rate": 0.0}],
            "accounts": [
                {"UID": "a-bank", "DisplayID": "1-1110", "Name": "Business Cheque Account", "Classification": "Asset", "Type": "Bank", "IsHeader": False, "IsActive": True},
                {"UID": "a-head", "DisplayID": "4-0000", "Name": "Income", "Classification": "Income", "Type": "Income", "IsHeader": True, "IsActive": True},
                {"UID": "a-sales", "DisplayID": "4-1000", "Name": "Sales", "Classification": "Income", "Type": "Income", "IsHeader": False, "IsActive": True, "TaxCode": {"Code": "GST"}},
                {"UID": "a-repairs", "DisplayID": "6-1000", "Name": "Repairs and Maintenance", "Classification": "Expense", "Type": "Expense", "IsHeader": False, "IsActive": True, "TaxCode": {"Code": "GST"}},
                {"UID": "a-fees", "DisplayID": "6-2000", "Name": "Bank Fees", "Classification": "Expense", "Type": "Expense", "IsHeader": False, "IsActive": True, "TaxCode": {"Code": "FRE"}},
                {"UID": "a-supplies", "DisplayID": "6-3000", "Name": "Supplies", "Classification": "Expense", "Type": "Expense", "IsHeader": False, "IsActive": True, "TaxCode": {"Code": "GST"}},
            ],
            "balance_sheets": {},  # date -> {account UID: total}; any other date: empty
            "pl": {"a-sales": 50000.0, "a-repairs": 100.0, "a-fees": 10.0, "a-supplies": 20.0},
        }
        return self.files[fid]

    @staticmethod
    def ref(card):
        return {"UID": card["UID"], "Name": card.get("CompanyName") or card.get("FirstName", ""), "DisplayID": "*None"}

    def call(self, tool, args):
        self.calls.append((tool, dict(args)))
        assert tool.startswith(self.READS), "the checks only read MYOB: " + tool
        if tool == "list_company_files":
            assert "myob_company_file_id" not in args
            return [{"Id": fid, "Name": f["name"], "LibraryPath": f["name"]} for fid, f in self.files.items()]
        fid = args.get("myob_company_file_id")
        assert fid in self.files, "no company file " + str(fid)
        if tool in self.errors:
            return {"__error": self.errors[tool]}
        f = self.files[fid]
        frm, to = args.get("from_date") or "0000-00-00", args.get("to_date") or "9999-99-99"
        if tool == "list_tax_codes":
            return {"Count": len(f["tax_codes"]), "Items": copy.deepcopy(f["tax_codes"])}
        if tool == "list_contacts":
            size, page = args.get("page_size") or 100, args.get("page_index") or 0
            rows = f["cards"][page * size:(page + 1) * size]
            return {"Count": len(f["cards"]), "Items": copy.deepcopy(rows)}
        if tool == "list_suppliers":
            rows = [{"UID": c["UID"], "Name": c.get("CompanyName"), "ABN": c.get("_abn") or None, "IsActive": True}
                    for c in f["cards"] if c["Type"] == "Supplier"]
            # #819: a keyed fingerprint of the bank account (card "_bank"), never the details.
            if args.get("bank_fingerprint_key") and not f["old_connector"]:
                for r, c in zip(rows, [c for c in f["cards"] if c["Type"] == "Supplier"]):
                    bank = re.sub(r"\D", "", c.get("_bank") or "")
                    r["BankFingerprint"] = (hashlib.sha256((args["bank_fingerprint_key"] + "|" + bank).encode()).hexdigest()[:16]
                                            if bank else None)
            return {"Count": len(rows), "Items": rows}
        if tool in ("list_quotes", "list_purchase_orders", "get_lock_period") and f["old_connector"]:
            raise RuntimeError("tool_error: unknown tool " + tool)
        if tool == "list_quotes":
            rows = [q for q in f["quotes"] if frm <= q["Date"][:10] <= to]
            return {"Count": len(rows), "Items": copy.deepcopy(rows)}
        if tool == "list_purchase_orders":
            rows = [o for o in f["orders"] if args.get("status") in (None, "All") or o["Status"] == args["status"]]
            return {"Count": len(rows), "Items": copy.deepcopy(rows)}
        if tool == "get_lock_period":
            return {"LockPeriodPriorTo": (f["lock"] + "T00:00:00") if f["lock"] else None,
                    "TransactionsCannotBeChangedMustBeReversed": False}
        if tool in ("list_invoices", "list_bills"):
            kind = "invoice" if tool == "list_invoices" else "bill"
            assert args.get("status") == "Open"
            rows = []
            for d in f["docs"]:
                if d["kind"] == kind and d["Status"] in ("Open", "Credit"):
                    who = "Customer" if kind == "invoice" else "Supplier"
                    rows.append({"UID": d["UID"], "Number": d["Number"], "Date": d["Date"] + "T00:00:00", "Status": d["Status"],
                                 who: self.ref(d["card"]), "TotalAmount": d["Total"], "TotalTax": d["TotalTax"],
                                 "BalanceDueAmount": d["Balance"], "Terms": {"DueDate": (d.get("Due") or d["Date"]) + "T00:00:00"},
                                 "InvoiceDeliveryStatus": d.get("Delivery", "Nothing")})
            return {"Count": len(rows), "Items": rows}
        if tool in ("list_invoice_lines", "list_bill_lines"):
            kind = "invoice" if tool == "list_invoice_lines" else "bill"
            who = "Customer" if kind == "invoice" else "Supplier"
            rows = []
            for d in f["docs"]:
                if d["kind"] == kind and frm <= d["Date"] <= to:
                    for ln in d["Lines"]:
                        rows.append({"DocumentUID": d["UID"], "Number": d["Number"], "Date": d["Date"] + "T00:00:00", "Layout": "Service",
                                     "Status": d["Status"], "IsTaxInclusive": d.get("IsTaxInclusive", True), who: self.ref(d["card"]),
                                     "Total": ln["Total"], "TaxCode": {"UID": "x", "Code": ln["TaxCode"]},
                                     "Account": {"UID": ln["Account"], "DisplayID": self.code(f, ln["Account"]), "Name": ""}})
            cap = args.get("max_lines") or 5000
            return {"Count": min(len(rows), cap), "Items": rows[:cap], "Truncated": len(rows) > cap, "Documents": {"Service": len(rows)}}
        if tool == "list_supplier_payments":
            size, page = args.get("page_size") or 100, args.get("page_index") or 0
            rows = [p for p in f["payments"] if frm <= p["Date"][:10] <= to][page * size:(page + 1) * size]
            return {"Count": len(rows), "Items": copy.deepcopy(rows)}
        if tool == "list_payments":
            size, page = args.get("page_size") or 100, args.get("page_index") or 0
            rows = [p for p in f["receipts"] if frm <= p["Date"][:10] <= to][page * size:(page + 1) * size]
            return {"Count": len(rows), "Items": copy.deepcopy(rows)}
        if tool == "list_spend_money":
            rows = [s for s in f["spend"] if frm <= s["Date"][:10] <= to]
            return {"Count": len(rows), "Items": copy.deepcopy(rows)}
        if tool == "list_accounts":
            return {"Count": len(f["accounts"]), "Items": copy.deepcopy(f["accounts"])}
        if tool == "list_bank_statement_lines":
            rows = [x for x in f["statement"] if frm <= x["Date"][:10] <= to]
            return {"Count": len(rows), "Items": copy.deepcopy(rows)}
        if tool == "list_journal_transactions":
            rows = [j for j in f["journals"] if frm <= j["DateOccurred"][:10] <= to]
            return {"Count": len(rows), "Items": copy.deepcopy(rows)}
        if tool == "get_balance_sheet":
            totals = f["balance_sheets"].get(args["date"], {})
            return {"AccountsBreakdown": [{"Account": {"UID": k, "DisplayID": self.code(f, k)}, "AccountTotal": v} for k, v in totals.items()]}
        if tool == "get_profit_and_loss_3m":
            return {"AccountsBreakdown": [{"Account": {"UID": k, "DisplayID": self.code(f, k)}, "AccountTotal": v} for k, v in f["pl"].items()]}
        raise RuntimeError("fake MYOB has no tool " + tool)

    @staticmethod
    def code(f, uid):
        return next((a["DisplayID"] for a in f["accounts"] if a["UID"] == uid), "")


class FakeQbo:
    """One connected QuickBooks Online company."""

    def __init__(self, name="Acme Plumbing Pty Ltd"):
        self.name = name
        self.calls = []
        self.vendors, self.invoices, self.bills, self.purchases, self.payments = [], [], [], [], []
        self.customer_payments = []
        self.estimates, self.purchase_orders = [], []
        self.attachables, self.journals = [], []
        self.close_date = ""
        self.tax_rates = [{"Id": "r-gst-p", "Name": "GST (purchases)", "RateValue": 10}, {"Id": "r-gst-s", "Name": "GST (sales)", "RateValue": 10},
                          {"Id": "r-free", "Name": "GST free", "RateValue": 0}]
        self.tax_codes = [
            {"Id": "4", "Name": "GST", "SalesTaxRateList": {"TaxRateDetail": [{"TaxRateRef": {"value": "r-gst-s"}}]},
             "PurchaseTaxRateList": {"TaxRateDetail": [{"TaxRateRef": {"value": "r-gst-p"}}]}},
            {"Id": "6", "Name": "FRE", "SalesTaxRateList": {"TaxRateDetail": [{"TaxRateRef": {"value": "r-free"}}]},
             "PurchaseTaxRateList": {"TaxRateDetail": [{"TaxRateRef": {"value": "r-free"}}]}},
        ]
        self.accounts = [
            {"Id": "35", "Name": "Business Cheque", "AccountType": "Bank", "Classification": "Asset", "Active": True},
            {"Id": "79", "Name": "Sales", "AcctNum": "4000", "AccountType": "Income", "Classification": "Revenue", "Active": True, "TaxCodeRef": {"value": "4"}},
            {"Id": "57", "Name": "Repairs and Maintenance", "AccountType": "Expense", "Classification": "Expense", "Active": True, "TaxCodeRef": {"value": "4"}},
            {"Id": "58", "Name": "Bank Fees", "AccountType": "Expense", "Classification": "Expense", "Active": True, "TaxCodeRef": {"value": "6"}},
        ]
        self.trial_balances = {}  # date -> {account id: (debit, credit)}
        self.pl = {"79": 50000.0, "57": 100.0, "58": 10.0}

    @staticmethod
    def match(row, where):
        if not where:
            return True
        for part in where.split(" AND "):
            field, op, value = part.split(" ", 2)
            value = value.strip("'")
            have = row.get(field)
            if field == "Active":
                ok = have is (value == "true")
            elif op == ">=":
                ok = str(have or "") >= value
            elif op == ">":
                ok = float(have or 0) > float(value)
            else:
                raise AssertionError("fake QuickBooks can't filter " + part)
            if not ok:
                return False
        return True

    def call(self, tool, args):
        self.calls.append((tool, dict(args)))
        assert tool.startswith(("list_", "get_", "qbo_query")), "the checks only read QuickBooks: " + tool
        if tool == "get_company_info":
            return {"CompanyInfo": {"Id": "1", "CompanyName": self.name, "LegalName": self.name}}
        if tool == "get_preferences":
            return {"Preferences": {"AccountingInfoPrefs": {"BookCloseDate": self.close_date} if self.close_date else {}}}
        if tool == "get_report_trial_balance":
            tb = self.trial_balances.get(args["end_date"], {})
            return {"Rows": {"Row": [{"type": "Data", "ColData": [{"value": k, "id": k}, {"value": str(d)}, {"value": str(c)}]}
                                     for k, (d, c) in tb.items()]}}
        if tool == "get_report_profit_and_loss":
            income = [k for k in self.pl if k == "79"]
            return {"Rows": {"Row": [
                {"type": "Section", "group": "Income", "Header": {"ColData": [{"value": "Income"}, {"value": ""}]},
                 "Rows": {"Row": [{"type": "Data", "ColData": [{"value": "Sales", "id": k}, {"value": str(self.pl[k])}]} for k in income]},
                 "Summary": {"ColData": [{"value": "Total Income"}, {"value": str(sum(self.pl[k] for k in income))}]}},
                {"type": "Section", "group": "Expenses", "Header": {"ColData": [{"value": "Expenses"}, {"value": ""}]},
                 "Rows": {"Row": [{"type": "Data", "ColData": [{"value": "x", "id": k}, {"value": str(v)}]} for k, v in self.pl.items() if k not in income]},
                 "Summary": {"ColData": [{"value": "Total Expenses"}, {"value": "0"}]}}]}}
        entity, rows = {
            "list_vendor": ("Vendor", self.vendors), "list_invoice": ("Invoice", self.invoices), "list_bill": ("Bill", self.bills),
            "list_purchase": ("Purchase", self.purchases), "list_bill_payment": ("BillPayment", self.payments),
            "list_payment": ("Payment", self.customer_payments),
            "list_estimate": ("Estimate", self.estimates), "list_purchase_order": ("PurchaseOrder", self.purchase_orders),
            "list_attachable": ("Attachable", self.attachables), "list_journal_entry": ("JournalEntry", self.journals),
            "list_account": ("Account", self.accounts), "list_tax_code": ("TaxCode", self.tax_codes), "list_tax_rate": ("TaxRate", self.tax_rates),
        }.get(tool, (None, None))
        if entity is None:
            raise RuntimeError("fake QuickBooks has no tool " + tool)
        hit = [r for r in rows if self.match(r, args.get("where") or "")]
        if tool == "list_attachable":
            hit.sort(key=lambda a: a["MetaData"]["LastUpdatedTime"], reverse=True)
        start, size = (args.get("startPosition") or 1) - 1, args.get("maxResults") or 100
        return {"QueryResponse": {entity: copy.deepcopy(hit[start:start + size]), "startPosition": start + 1, "maxResults": size},
                "time": datetime.datetime.now().isoformat()}
