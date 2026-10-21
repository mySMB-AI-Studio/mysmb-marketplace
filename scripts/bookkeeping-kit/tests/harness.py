"""Run the GENERATED automations (content/automations/*.json) against a fake workspace + fake Xero.

This mirrors the parts of the myHubV2 executor the flows rely on: {{ … ?? … }} bindings over
trigger/params/steps, python/if nodes, declared outputs only, the import allowlist, keyword-only
api calls and the per-run scratch space. It is not the real sandbox — the Developer Instance dry run
and the QA tenant are still the final word.
"""
import base64
import builtins
import datetime
import copy
import json
import os
import re
import tempfile
import uuid

from fakes_ledgers import FakeMyob, FakeQbo

ALLOWED = {
    "abc", "base64", "bisect", "calendar", "collections", "contextlib", "copy", "csv", "dataclasses", "datetime",
    "decimal", "difflib", "enum", "fractions", "functools", "hashlib", "heapq", "html", "io", "itertools", "json",
    "math", "numbers", "operator", "pathlib", "random", "re", "secrets", "statistics", "string", "textwrap", "time",
    "types", "typing", "unicodedata", "uuid", "zoneinfo",
    "docx", "openpyxl", "pptx", "xlsxwriter", "fpdf", "pypdf", "markdown", "jinja2", "lxml", "PIL",
}
_real_import = builtins.__import__


def _guarded_import(name, globals=None, locals=None, fromlist=(), level=0):
    caller = (globals or {}).get("__name__", "")
    if caller == "__node__" and name.split(".")[0] not in ALLOWED:
        raise ImportError(f'import of "{name}" is not allowed in automation nodes')
    return _real_import(name, globals, locals, fromlist, level)


BANNED = {"eval", "exec", "compile", "input", "breakpoint", "globals", "vars"}
NODE_BUILTINS = {k: v for k, v in vars(builtins).items() if k not in BANNED}
NODE_BUILTINS["__import__"] = _guarded_import


# ── fake workspace ──────────────────────────────────────────────────────────
class KwOnly:
    """Namespace whose methods only accept keyword arguments (like the real proxy)."""

    def __init__(self, impl, ns):
        self._impl, self._ns = impl, ns

    def __getattr__(self, method):
        fn = getattr(self._impl, method)
        if method in ("scratch_path", "scratch_list"):
            return fn  # sandbox-local helpers, plain positional functions in the real _Files class

        def call(*args, **kwargs):
            if args:
                raise TypeError(f"api.{self._ns}.{method} takes keyword arguments only")
            self._impl.world.calls.append((self._ns, method, copy.deepcopy(kwargs)))
            return fn(**kwargs)

        return call


class Files:
    def __init__(self, world):
        self.world = world

    def read(self, file, scope=None, scope_id=None):
        if file not in self.world.files:
            raise FileNotFoundError(file)
        data = self.world.files[file]
        return data.decode("utf-8") if isinstance(data, bytes) else data

    def get(self, file, scope=None, scope_id=None):
        if file not in self.world.files:
            raise FileNotFoundError(file)
        data = self.world.files[file]
        path = os.path.join(self.world.scratch, "in", file.split("/")[-1])
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as fh:
            fh.write(data if isinstance(data, bytes) else data.encode("utf-8"))
        return path

    def put(self, file, content=None, scratch_file=None, scope=None, scope_id=None):
        depth = len(file.split("/")) - 1
        if depth > 2:
            raise ValueError("Files cannot be deeper than 2 folder levels: " + file)
        if scratch_file:
            with open(scratch_file, "rb") as fh:
                self.world.files[file] = fh.read()
        else:
            self.world.files[file] = content
        self.world.events.append(("knowledge.file_created", file))
        return {"saved": True, "file": file}

    def delete(self, file, scope=None, scope_id=None):
        self.world.files.pop(file, None)
        return {"deleted": True}

    def list(self, path=None, scope=None, scope_id=None):
        prefix = (path or "").rstrip("/") + "/"
        out = []
        for p in sorted(self.world.files):
            if p.startswith(prefix) and "/" not in p[len(prefix):]:
                out.append({"kind": "file", "name": p.split("/")[-1], "path": p, "size": 1})
        return out

    def scratch_path(self, name):
        path = os.path.join(self.world.scratch, name.replace("\\", "/").lstrip("/"))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        return path


class WorkQ:
    def __init__(self, world):
        self.world = world

    def create(self, title, scope="me", description=None, priority="medium", due_date=None, labels=None,
               assignee_ids=None, assigned_group_ids=None, activity_type=None):
        tid = str(uuid.uuid4())
        item = {"id": tid, "title": title, "scope": scope, "description": description or "", "priority": priority,
                "dueDate": due_date, "labels": labels or [], "assigneeIds": assignee_ids or [], "status": "not_started",
                "formId": None, "comments": []}
        self.world.items[tid] = item
        return dict(item)

    def attach_form(self, todo_id, form_id):
        self.world.items[todo_id]["formId"] = form_id
        return dict(self.world.items[todo_id])

    def comment(self, todo_id, body):
        self.world.items[todo_id]["comments"].append(body)
        return {"ok": True}

    def complete(self, todo_id):
        self.world.items[todo_id]["status"] = "done"
        return dict(self.world.items[todo_id])

    def set_status(self, todo_id, status):
        self.world.items[todo_id]["status"] = status
        return dict(self.world.items[todo_id])

    def list(self, status=None, scope=None, priority=None, search=None):
        return [dict(i) for i in self.world.items.values() if (status is None or i["status"] == status)
                and (not search or str(search).lower() in i["title"].lower())]

    def get(self, todo_id):
        if todo_id not in self.world.items:
            raise RuntimeError("Todo not found: " + todo_id)
        return dict(self.world.items[todo_id])

    def update(self, todo_id, title=None, description=None, status=None, priority=None, due_date=None,
               assignee_ids=None, assigned_group_ids=None, labels=None):
        item = self.world.items[todo_id]
        for key, value in (("title", title), ("description", description), ("status", status), ("priority", priority),
                           ("dueDate", due_date), ("assigneeIds", assignee_ids), ("labels", labels)):
            if value is not None:
                item[key] = value
        return dict(item)


class Connectors:
    def __init__(self, world):
        self.world = world

    def invoke(self, server, tool, args=None):
        if server == "xero-payroll-au":
            return self.world.payroll.call(tool, dict(args or {}))
        if server == "deputy":
            return self.world.deputy.call(tool, dict(args or {}))
        if server == "abr":
            return self.world.abr.call(tool, dict(args or {}))
        if server == "xero-assets":
            return self.world.assets.call(tool, dict(args or {}))
        if server == "myob-accounting":
            return self.world.myob.call(tool, dict(args or {}))
        if server == "quickbooks-accounting":
            return self.world.qbo.call(tool, dict(args or {}))
        if server in FakeMail.SERVERS:
            return self.world.mail.call(server, tool, dict(args or {}))
        if server != "xero-accounting":
            raise RuntimeError("unknown connector " + server)
        return self.world.xero.call(tool, dict(args or {}))


class AI:
    def __init__(self, world):
        self.world = world

    def _file(self, scratch_file):
        """Like the platform (myHubV2 api.ai scratch_file): a PDF of at most 20 pages, or a PNG/JPEG image."""
        with open(scratch_file, "rb") as fh:
            data = fh.read()
        if b"%PDF-" in data[:1024]:
            from pypdf import PdfReader
            pages = len(PdfReader(scratch_file).pages)
            if pages > 20:
                raise RuntimeError("api.ai.extract: the PDF has %d pages; the most an AI step reads is 20" % pages)
        elif not (data[:3] == b"\xff\xd8\xff" or data[:4] == b"\x89PNG"):
            raise RuntimeError("api.ai.extract: scratch_file must be a PDF or a PNG, JPEG, GIF or WebP image")
        elif len(data) > 5 * 1024 * 1024:
            raise RuntimeError("api.ai.extract: the image is over 5 MB")
        self.world.ai_files.append(scratch_file)

    def extract(self, prompt, input=None, schema_hint=None, scratch_file=None):
        if scratch_file is not None:
            self._file(scratch_file)
        elif not input:
            raise RuntimeError('api call requires string argument "input"')
        self.world.ai_calls.append(("extract", prompt[:40], input))
        return copy.deepcopy(self.world.ai_extract(prompt, input or ""))

    def generate(self, prompt, input=None, system=None, scratch_file=None):
        if scratch_file is not None:
            self._file(scratch_file)
        self.world.ai_calls.append(("generate", prompt[:40], input))
        return self.world.ai_generate(prompt, input)


class Artifacts:
    def __init__(self, world):
        self.world = world

    def put(self, title, content=None, scratch_file=None, file_name=None, description=None, kind=None,
            visibility=None, mime_type=None, tags=None):
        self.world.artifacts.append({"title": title, "content": content, "file_name": file_name})
        return {"artifact_id": "a1", "url": "https://workspace.example/artifacts/a1"}


class Notify:
    def __init__(self, world):
        self.world = world

    def send(self, title, body=None, user_ids=None, group_ids=None):
        self.world.notifications.append({"title": title, "body": body, "user_ids": user_ids})
        return {"sent": True}


class Api:
    def __init__(self, world):
        self.files = KwOnly(Files(world), "files")
        self.workq = KwOnly(WorkQ(world), "workq")
        self.connectors = KwOnly(Connectors(world), "connectors")
        self.ai = KwOnly(AI(world), "ai")
        self.artifacts = KwOnly(Artifacts(world), "artifacts")
        self.notify = KwOnly(Notify(world), "notify")
        for impl in (self.files, self.workq, self.connectors, self.ai, self.artifacts, self.notify):
            impl._impl.world = world


# ── fake Xero (three organisations; T1 is the connection's default) ────────
class FakeXero:
    WRITE = {"create_invoice", "update_invoice", "upload_attachment", "create_contact", "email_invoice"}

    def __init__(self):
        self.orgs = {}
        self.default = None
        self.writes = []

    def add_org(self, tenant_id, name, default=False, abn=""):
        self.orgs[tenant_id] = {"name": name, "abn": abn, "contacts": [], "invoices": [], "attachments": [], "items": [],
                                "emailed": [], "next_number": 1001,
                                "bill_terms": None, "sales_terms": None, "attachment_hosts": [],
                                "banks": [{"AccountID": "BANK1", "Code": "090", "Name": "Business Cheque Account", "Type": "BANK",
                                           "BankAccountNumber": "062-000 1234 5678", "BankAccountType": "BANK", "Status": "ACTIVE"},
                                          {"AccountID": "CARD1", "Code": "091", "Name": "Company Visa", "Type": "BANK",
                                           "BankAccountNumber": "4111 1111 1111 4321", "BankAccountType": "CREDITCARD", "Status": "ACTIVE"}],
                                "bank_balances": {"BANK1": 12840.55, "CARD1": -1520.10}, "bank_openings": {},
                                "accounts": [
                                    {"Code": "400", "Name": "Advertising", "Type": "EXPENSE", "Status": "ACTIVE"},
                                    {"Code": "429", "Name": "General Expenses", "Type": "EXPENSE", "Status": "ACTIVE"},
                                    {"Code": "449", "Name": "Repairs and Maintenance", "Type": "EXPENSE", "Status": "ACTIVE"},
                                    {"Code": "489", "Name": "Telephone & Internet", "Type": "EXPENSE", "Status": "ACTIVE"},
                                    {"Code": "200", "Name": "Sales", "Type": "REVENUE", "Status": "ACTIVE"},
                                    {"Code": "260", "Name": "Other Revenue", "Type": "OTHERINCOME", "Status": "ACTIVE"},
                                ],
                                "tax_rates": [
                                    {"TaxType": "INPUT", "Name": "GST on Expenses", "Status": "ACTIVE", "CanApplyToExpenses": True, "CanApplyToRevenue": False, "EffectiveRate": 10},
                                    {"TaxType": "OUTPUT", "Name": "GST on Income", "Status": "ACTIVE", "CanApplyToExpenses": False, "CanApplyToRevenue": True, "EffectiveRate": 10},
                                    {"TaxType": "EXEMPTOUTPUT", "Name": "GST Free Income", "Status": "ACTIVE", "CanApplyToExpenses": False, "CanApplyToRevenue": True, "EffectiveRate": 0},
                                    {"TaxType": "EXEMPTEXPENSES", "Name": "GST Free Expenses", "Status": "ACTIVE", "CanApplyToExpenses": True, "EffectiveRate": 0},
                                    {"TaxType": "BASEXCLUDED", "Name": "BAS Excluded", "Status": "ACTIVE", "CanApplyToExpenses": True, "EffectiveRate": 0},
                                ]}
        if default:
            self.default = tenant_id

    @staticmethod
    def validation_error(message):
        """The connector's error text for a Xero 400: a long echo of the document, then the messages."""
        body = {"ErrorNumber": 10, "Type": "ValidationException", "Message": "A validation exception occurred",
                "Elements": [{"Type": "ACCPAY", "LineItems": [{"Description": "x" * 300}], "Prepayments": [], "Overpayments": [],
                              "ValidationErrors": [{"Message": message}]}]}
        return "tool_error: Xero API POST https://api.xero.com/api.xro/2.0/Invoices 400: " + json.dumps(body, indent=2)

    def org(self, args):
        tid = args.pop("xero_tenant_id", None) or self.default
        if tid not in self.orgs:
            raise RuntimeError("xero_tenant_id " + str(tid) + " is not in the user's authorized Xero organisations")
        return tid, self.orgs[tid]

    def call(self, tool, args):
        if tool == "list_connections":
            return [{"tenantId": t, "tenantName": o["name"], "tenantType": "ORGANISATION"} for t, o in self.orgs.items()]
        tid, org = self.org(args)
        if tool in self.WRITE:
            self.writes.append((tool, tid))
        if tool == "list_contacts":
            term = str(args.get("searchTerm") or "").lower()
            return {"Contacts": [c for c in org["contacts"] if term in c["Name"].lower()]}
        if tool == "get_organisation":
            terms = {}
            if org["bill_terms"]:
                terms["Bills"] = org["bill_terms"]
            if org["sales_terms"]:
                terms["Sales"] = org["sales_terms"]
            return {"Organisations": [{"Name": org["name"], "LegalName": org["name"], "TaxNumber": org["abn"], "PaymentTerms": terms, "ShortCode": org.get("short_code"),
                                       "PeriodLockDate": org.get("lock_date"), "EndOfYearLockDate": org.get("eoy_lock_date")}]}
        if tool in ("list_bank_transactions", "list_credit_notes", "list_manual_journals"):
            key = {"list_bank_transactions": "BankTransactions", "list_credit_notes": "CreditNotes",
                   "list_manual_journals": "ManualJournals"}[tool]
            return {key: [] if args.get("page", 1) > 1 else copy.deepcopy(org.get(key) or [])}
        if tool in ("list_quotes", "list_purchase_orders", "list_batch_payments"):
            # Quotes and purchase orders filter on status; a list set to None stands for one the connection can't read.
            key = {"list_quotes": "Quotes", "list_purchase_orders": "PurchaseOrders", "list_batch_payments": "BatchPayments"}[tool]
            if key in org and org[key] is None:
                raise RuntimeError("tool_error: Xero API 403: the connection has no access to " + key)
            rows = [r for r in org.get(key) or [] if not args.get("status") or r.get("Status") == args["status"]]
            return {key: [] if args.get("page", 1) > 1 else copy.deepcopy(rows)}
        if tool == "get_trial_balance":
            # {date: {AccountID: balance}}; a missing date is an empty trial balance.
            rows = [{"RowType": "Row", "Cells": [{"Value": aid, "Attributes": [{"Id": "account", "Value": aid}]}, {"Value": ""},
                                                 {"Value": ""}, {"Value": "%.2f" % max(bal, 0)}, {"Value": "%.2f" % max(-bal, 0)}]}
                    for aid, bal in (org.get("trial_balance") or {}).get(args.get("date"), {}).items()]
            return {"Reports": [{"ReportID": "TrialBalance", "Rows": [{"RowType": "Section", "Title": "Assets", "Rows": rows}]}]}
        if tool == "get_profit_and_loss":
            # {"income": {AccountID: amount}, "expenses": {AccountID: amount}} over the period asked for.
            pl = org.get("profit_and_loss") or {}
            def section(title, values):
                return {"RowType": "Section", "Title": title, "Rows": [
                    {"RowType": "Row", "Cells": [{"Value": aid, "Attributes": [{"Id": "account", "Value": aid}]}, {"Value": "%.2f" % v}]}
                    for aid, v in values.items()]}
            return {"Reports": [{"ReportID": "ProfitAndLoss", "Rows": [section("Income", pl.get("income") or {}),
                                                                         section("Operating Expenses", pl.get("expenses") or {})]}]}
        if tool == "create_contact":
            c = dict(args["contact"])
            if any(x["Name"].lower() == c["Name"].lower() for x in org["contacts"]):
                # Real Xero: contact names are unique across active contacts.
                raise RuntimeError(self.validation_error("The contact name " + c["Name"] + " is already assigned to another contact."))
            c["ContactID"] = str(uuid.uuid4())
            org["contacts"].append(c)
            return {"Contacts": [c]}
        if tool == "list_accounts":
            if 'Type=="BANK"' in str(args.get("where") or ""):
                return {"Accounts": copy.deepcopy(org["banks"])}
            return {"Accounts": org["accounts"]}
        if tool == "get_bank_summary":
            rows = [{"RowType": "Row", "Cells": [{"Value": a["Name"], "Attributes": [{"Id": "accountID", "Value": a["AccountID"]}]},
                                                 {"Value": "%.2f" % org["bank_openings"].get(a["AccountID"], 0)}, {"Value": "0.00"}, {"Value": "0.00"},
                                                 {"Value": "%.2f" % org["bank_balances"].get(a["AccountID"], 0)}]} for a in org["banks"]]
            return {"Reports": [{"ReportID": "BankSummary", "Rows": [{"RowType": "Header", "Cells": [{"Value": "Bank Accounts"}]},
                                                                      {"RowType": "Section", "Rows": rows}]}]}
        if tool == "list_tax_rates":
            return {"TaxRates": org["tax_rates"]}
        if tool == "list_invoices":
            if args.get("page", 1) > 1:
                return {"Invoices": []}
            where = args.get("where") or ""
            if where and args.get("statuses"):
                # Real Xero quirk (myhub-mcp-servers #560): where + statuses together silently return nothing.
                return {"Invoices": []}
            rows = org["invoices"]
            m = re.search(r'Status=="([A-Z]+)"', where)
            if m:
                rows = [r for r in rows if r["Status"] == m.group(1)]
            m = re.search(r'Contact\.ContactID==guid\("([^"]+)"\)', where)
            if m:
                rows = [r for r in rows if r["Contact"]["ContactID"] == m.group(1)]
            m = re.search(r'InvoiceNumber=="([^"]+)"', where)
            if m:
                rows = [r for r in rows if r.get("InvoiceNumber") == m.group(1)]
            for kind in ("ACCPAY", "ACCREC"):
                if 'Type=="' + kind + '"' in where:
                    rows = [r for r in rows if r["Type"] == kind]
            if args.get("statuses"):
                wanted = set(args["statuses"].split(","))
                rows = [r for r in rows if r["Status"] in wanted]
            return {"Invoices": copy.deepcopy(rows)}
        if tool == "create_invoice":
            inv = copy.deepcopy(args["invoice"])
            assert inv.get("Contact", {}).get("ContactID"), "bill without ContactID"
            assert any(c["ContactID"] == inv["Contact"]["ContactID"] for c in org["contacts"]), "contact not in this org"
            if inv.get("Status") in ("SUBMITTED", "AUTHORISED") and not inv.get("DueDate"):
                # Real Xero: only a draft bill may have no due date.
                raise RuntimeError(self.validation_error("Due Date is mandatory for invoices that are not draft."))
            inv["InvoiceID"] = str(uuid.uuid4())
            inv.setdefault("Status", "DRAFT")
            if inv["Type"] == "ACCREC" and not inv.get("InvoiceNumber"):
                inv["InvoiceNumber"] = "INV-" + str(org["next_number"])
                org["next_number"] += 1
            inv["Contact"] = next(dict(c) for c in org["contacts"] if c["ContactID"] == inv["Contact"]["ContactID"])
            total = sum(li["Quantity"] * li["UnitAmount"] for li in inv["LineItems"])
            inv["Total"] = inv["AmountDue"] = round(total * (1.1 if inv.get("LineAmountTypes") == "Exclusive" else 1), 2)
            org["invoices"].append(inv)
            return {"Invoices": [copy.deepcopy(inv)]}
        if tool == "update_invoice":
            inv = next(i for i in org["invoices"] if i["InvoiceID"] == args["invoiceId"])
            inv.update(copy.deepcopy(args["patch"]))
            return {"Invoices": [copy.deepcopy(inv)]}
        if tool == "list_items":
            return {"Items": copy.deepcopy(org["items"])}
        if tool == "email_invoice":
            inv = next(i for i in org["invoices"] if i["InvoiceID"] == args["invoiceId"])
            if inv["Status"] not in ("AUTHORISED", "SUBMITTED"):
                raise RuntimeError(self.validation_error("Only approved invoices can be emailed."))
            contact = next(c for c in org["contacts"] if c["ContactID"] == inv["Contact"]["ContactID"])
            if not contact.get("EmailAddress"):
                raise RuntimeError(self.validation_error("The contact does not have an email address."))
            org["emailed"].append((inv["InvoiceID"], contact["EmailAddress"]))
            return {}
        if tool == "upload_attachment":
            assert args["base64Content"], "empty attachment"
            org["attachments"].append((args["hostId"], args["fileName"]))
            org["attachment_hosts"].append((args["hostType"], args["hostId"], args["fileName"]))
            return {"Attachments": [{"FileName": args["fileName"]}]}
        raise RuntimeError("fake Xero has no tool " + tool)


class FakeMail:
    """The owner's Outlook, Hotmail and Gmail mailboxes and a shared Outlook mailbox, shaped like m365-mail-read,
    hotmail-mail, m365-mail-shared and google-workspace-gmail return them. Messages live in folders (Gmail: labels).
    With old_connector, list_emails ignores receivedAfter/oldestFirst, list_messages ignores pageToken and heicToJpeg
    is ignored: the connectors as they were before folders, cursors and HEIC (production until it is updated)."""
    SERVERS = {"m365-mail-read": "outlook", "m365-mail-shared": "outlook-shared", "hotmail-mail": "hotmail",
               "google-workspace-gmail": "gmail"}
    MAX = 15 * 1024 * 1024
    GMAIL_LABELS = {"Label_bills": "Bills", "Label_acme": "Clients/Acme"}

    def __init__(self):
        self.boxes = {"outlook": [], "outlook-shared": [], "hotmail": [], "gmail": []}
        self.calls = []
        self.fail_download = 0
        self.old_connector = False
        self.shared_mailbox = "accounts@practice.example"

    def add(self, provider, subject, sender, received, attachments, preview="", html="", folder="inbox"):
        mid = provider[:1] + ("s" if provider == "outlook-shared" else "") + "-" + str(len(self.boxes[provider]) + 1)
        self.boxes[provider].insert(0, {"id": mid, "subject": subject, "from": sender, "received": received,
                                        "preview": preview, "attachments": attachments, "html": html, "folder": folder})
        return mid

    def find(self, provider, mid):
        return next(m for m in self.boxes[provider] if m["id"] == mid)

    @staticmethod
    def at(value):
        return datetime.datetime.fromisoformat(str(value).replace("Z", "+00:00"))

    def attachment(self, provider, args):
        a = next(x for x in self.find(provider, args["messageId"])["attachments"] if x["id"] == args["attachmentId"])
        data, name, ctype, extra = a["bytes"], a["name"], a["type"], {}
        if a.get("heic") and args.get("heicToJpeg") and not self.old_connector:
            data, name, ctype = a["jpeg"], re.sub(r"\.(heic|heif)$", "", name, flags=re.I) + ".jpg", "image/jpeg"
            extra = {"convertedFrom": "image/heic"}
        return data, name, ctype, extra

    def call(self, server, tool, args):
        provider = self.SERVERS[server]
        self.calls.append((provider, tool, dict(args)))
        box = self.boxes[provider]
        if provider == "outlook-shared":
            assert args.pop("mailbox", None) == self.shared_mailbox, "shared mailbox calls must name the mailbox"
        if provider == "hotmail":
            # hotmail-mail has no shared mailboxes, so it has no `mailbox` argument either.
            assert "mailbox" not in args, "hotmail-mail has no mailbox argument"
        if provider in ("outlook", "outlook-shared", "hotmail"):
            if tool == "list_emails":
                folder = str(args.get("folder") or "").lower()
                if folder and folder != "inbox" and not any(m["folder"].lower() == folder for m in box):
                    raise RuntimeError("tool_error: Mail folder \"" + args["folder"] + "\" wasn't found. Use list_mail_folders to see the folder paths.")
                rows = [m for m in box if not folder or m["folder"].lower() == folder]
                rows = sorted(rows, key=lambda m: self.at(m["received"]), reverse=True)
                if not self.old_connector:
                    if args.get("receivedAfter"):
                        rows = [m for m in rows if self.at(m["received"]) > self.at(args["receivedAfter"])]
                    if args.get("oldestFirst"):
                        rows = rows[::-1]
                return [{"id": m["id"], "subject": m["subject"], "bodyPreview": m["preview"],
                         "from": {"emailAddress": {"name": m["from"].split("@")[0], "address": m["from"]}},
                         "receivedDateTime": m["received"], "isRead": False, "hasAttachments": bool(m["attachments"])}
                        for m in rows[: args.get("limit", 10)]]
            if tool == "list_email_attachments":
                return [{"id": a["id"], "name": a["name"], "contentType": a["type"], "size": len(a["bytes"]),
                         "isInline": a.get("inline", False), "kind": a.get("kind", "file")}
                        for a in self.find(provider, args["id"])["attachments"]]
            if tool == "get_email":
                m = self.find(provider, args["id"])
                return {"id": m["id"], "subject": m["subject"], "hasAttachments": bool(m["attachments"]),
                        "body": {"contentType": "html", "content": m.get("html") or "<p>" + m["preview"] + "</p>"}}
            if tool == "get_email_attachment":
                if self.fail_download:
                    self.fail_download -= 1
                    raise RuntimeError("tool_error: Graph 503 Service Unavailable")
                data, name, ctype, extra = self.attachment(provider, args)
                return dict({"id": args["attachmentId"], "name": name, "contentType": ctype, "size": len(data),
                             "contentBase64": base64.b64encode(data).decode("ascii")}, **extra)
        else:
            if tool == "list_labels":
                return [{"id": "INBOX", "name": "INBOX"}] + [{"id": k, "name": v} for k, v in self.GMAIL_LABELS.items()]
            if tool == "list_messages":
                [label] = args.get("labelIds")
                name = "inbox" if label == "INBOX" else self.GMAIL_LABELS[label].lower()
                rows = sorted([m for m in box if m["folder"].lower() == name], key=lambda m: self.at(m["received"]), reverse=True)
                q = str(args.get("q") or "")
                if q.startswith("after:"):
                    after = int(q.split(":", 1)[1])
                    rows = [m for m in rows if self.at(m["received"]).timestamp() >= after]
                size = args.get("maxResults", 20)
                start = 0 if self.old_connector else int(args.get("pageToken") or 0)
                page = rows[start:start + size]
                out = {"messages": [{"id": m["id"], "threadId": m["id"], "subject": m["subject"], "from": m["from"],
                                     "snippet": m["preview"], "internalDate": str(int(self.at(m["received"]).timestamp() * 1000))}
                                    for m in page]}
                if not self.old_connector and start + size < len(rows):
                    out["nextPageToken"] = str(start + size)
                return out
            if tool == "get_message":
                m = self.find(provider, args["id"])
                return {"id": m["id"], "subject": m["subject"], "from": m["from"], "snippet": m["preview"],
                        "attachments": [{"attachmentId": a["id"], "filename": a["name"], "mimeType": a["type"],
                                         "size": len(a["bytes"])} for a in m["attachments"]]}
            if tool == "get_attachment":
                data, _name, ctype, extra = self.attachment(provider, args)
                out = {"attachmentId": args["attachmentId"], "size": len(data), "contentBase64": base64.b64encode(data).decode("ascii")}
                if extra:
                    out.update(extra, contentType=ctype)
                return out
        raise RuntimeError("fake " + provider + " has no tool " + tool)


def xero_ms_date(d):
    """A date as Xero Payroll AU sends it: /Date(ms+0000)/."""
    return "/Date(%d+0000)/" % int(datetime.datetime(d.year, d.month, d.day, tzinfo=datetime.timezone.utc).timestamp() * 1000)


class FakePayroll:
    """Xero Payroll AU per organisation: calendars, employees, pay items, timesheets and pay runs (read tools only)."""
    WRITES = {"create_employee", "update_employee", "create_timesheet", "update_timesheet", "create_pay_run",
              "update_pay_run", "create_leave_application"}

    def __init__(self):
        self.orgs = {}
        self.calls = []

    def org(self, tenant):
        return self.orgs.setdefault(tenant, {"calendars": [], "employees": [], "earnings": [], "leave_types": [], "timesheets": [],
                                             "pay_runs": [], "payslips": {}, "accounts": None})

    def call(self, tool, args):
        self.calls.append((tool, dict(args)))
        assert tool not in self.WRITES, "payroll phase 1 must never write to Xero Payroll: " + tool
        tenant = args.pop("xero_tenant_id", None)
        assert tenant in self.orgs, "payroll call without the client's xero_tenant_id: " + tool
        o = self.orgs[tenant]
        where = str(args.get("where") or "")
        if tool == "list_payroll_calendars":
            return {"PayrollCalendars": copy.deepcopy(o["calendars"])}
        if tool == "list_employees":
            if args.get("page", 1) > 1:
                return {"Employees": []}
            m = re.search(r'Status=="(\w+)"', where)
            rows = [e for e in o["employees"] if not m or e.get("Status", "ACTIVE") == m.group(1)]
            return {"Employees": [{k: e[k] for k in ("EmployeeID", "FirstName", "LastName", "Status", "PayrollCalendarID", "TerminationDate")
                                   if k in e} for e in rows]}
        if tool == "get_employee":
            return {"Employees": [copy.deepcopy(next(e for e in o["employees"] if e["EmployeeID"] == args["employeeId"]))]}
        if tool == "list_pay_items":
            return {"PayItems": {"EarningsRates": copy.deepcopy(o["earnings"]), "LeaveTypes": copy.deepcopy(o["leave_types"])}}
        if tool == "list_timesheets":
            m = re.search(r"StartDate>=DateTime\((\d+),(\d+),(\d+)\) AND EndDate<=DateTime\((\d+),(\d+),(\d+)\)", where)
            assert m, where
            lo = datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            hi = datetime.date(int(m.group(4)), int(m.group(5)), int(m.group(6)))
            def day(v):
                return datetime.datetime.fromtimestamp(int(re.match(r"/Date\((\d+)", v).group(1)) / 1000, datetime.timezone.utc).date()
            return {"Timesheets": [copy.deepcopy(t) for t in o["timesheets"] if lo <= day(t["StartDate"]) and day(t["EndDate"]) <= hi]}
        if tool == "list_pay_runs":
            m = re.search(r'PayrollCalendarID==Guid\("([^"]+)"\)', where)
            st = re.search(r'PayRunStatus=="(\w+)"', where)
            rows = [r for r in o["pay_runs"] if (not m or r["PayrollCalendarID"] == m.group(1))
                    and (not st or r["PayRunStatus"] == st.group(1))]
            return {"PayRuns": [{k: v for k, v in r.items() if k != "Payslips"} for r in rows]}
        if tool == "get_pay_run":
            return {"PayRuns": [copy.deepcopy(next(r for r in o["pay_runs"] if r["PayRunID"] == args["payRunId"]))]}
        if tool == "get_payslip":
            # The full payslip when one is set up (o["payslips"][PayslipID]), else the pay run's summary of it.
            full = o["payslips"].get(args["payslipId"])
            if full is None:
                full = next(s for r in o["pay_runs"] for s in r.get("Payslips") or [] if s.get("PayslipID") == args["payslipId"])
            return {"Payslip": copy.deepcopy(full)}
        if tool == "get_payroll_settings" and o["accounts"] is not None:
            return {"Settings": {"Accounts": copy.deepcopy(o["accounts"])}}
        raise RuntimeError("fake Xero Payroll has no tool " + tool)


class FakeDeputy:
    def __init__(self):
        self.employees = []
        self.timesheets = []
        self.calls = []

    def call(self, tool, args):
        self.calls.append((tool, dict(args)))
        start, size = int(args.get("start") or 0), int(args.get("max") or 100)
        if tool == "list_employees":
            rows = self.employees
        elif tool == "list_timesheets":
            rows = [t for t in self.timesheets if (not args.get("date_from") or t["Date"][:10] >= args["date_from"])
                    and (not args.get("date_to") or t["Date"][:10] <= args["date_to"])]
        else:
            raise RuntimeError("fake Deputy has no tool " + tool)
        return copy.deepcopy(rows[start:start + size])


class FakeAbr:
    """The ABR Lookup connector: register records by ABN and names to search, shaped like the abr server returns."""

    def __init__(self):
        self.records = {}  # abn -> dict of compact-row fields
        self.names = {}    # search text (lower) -> list of {abn, name, score}
        self.calls = []

    def call(self, tool, args):
        self.calls.append((tool, dict(args)))
        if tool == "abr_lookup_abns":
            assert len(args["abns"]) <= 100
            rows = []
            for abn in args["abns"]:
                rec = self.records.get(abn)
                rows.append(dict({"abn": abn, "valid_checksum": True, "found": True, "error": None}, **rec) if rec
                            else {"abn": abn, "valid_checksum": True, "found": False, "error": "No records found"})
            return {"summary": {"requested": len(rows)}, "results": rows}
        if tool == "abr_search_by_name":
            return {"number_of_records": 0, "results": [dict(r, abn_status="Active", name_type="mainName")
                                                        for r in self.names.get(args["name"].lower(), [])]}
        raise RuntimeError("fake ABR has no tool " + tool)


class FakeXeroAssets:
    """The Xero Assets connector, shaped like the Xero Assets API: assets as {pagination, items}, asset types as a list."""

    def __init__(self):
        self.assets = {}  # tenant -> [asset dicts]
        self.types = {}   # tenant -> [asset type dicts]
        self.calls = []

    def call(self, tool, args):
        self.calls.append((tool, dict(args)))
        tid = args.get("xero_tenant_id")
        if tool == "list_assets":
            rows = [a for a in self.assets.get(tid, []) if not args.get("status") or a.get("assetStatus") == args["status"]]
            return {"pagination": {"page": 1, "pageSize": args.get("pageSize") or 10, "itemCount": len(rows)}, "items": copy.deepcopy(rows)}
        if tool == "list_asset_types":
            return copy.deepcopy(self.types.get(tid, []))
        raise RuntimeError("fake Xero Assets has no tool " + tool)


class World:
    def __init__(self):
        self.files, self.items, self.calls, self.events = {}, {}, [], []
        self.ai_calls, self.artifacts, self.notifications = [], [], []
        self.ai_files = []  # scratch files an api.ai call read (scans and photos)
        self.scratch = tempfile.mkdtemp(prefix="bk-scratch-")
        self.xero = FakeXero()
        self.mail = FakeMail()
        self.payroll = FakePayroll()
        self.deputy = FakeDeputy()
        self.abr = FakeAbr()
        self.assets = FakeXeroAssets()
        self.myob = FakeMyob()
        self.qbo = FakeQbo()
        self.ai_extract = lambda prompt, input: {}
        self.ai_generate = lambda prompt, input: "Hi there,\n\nCould you please confirm this bill?\n\nThanks,\nThe bookkeeping team"
        self.api = Api(self)


# ── executor ────────────────────────────────────────────────────────────────
def _path_get(root, parts):
    cur = root
    for p in parts:
        if isinstance(cur, dict) and p in cur:
            cur = cur[p]
        else:
            return None
    return cur


def resolve(binding, ctx):
    inner = binding.strip()
    assert inner.startswith("{{") and inner.endswith("}}"), binding
    for alt in inner[2:-2].split("??"):
        parts = alt.strip().split(".")
        val = _path_get(ctx, parts)
        if val is not None:
            return val
    return None


def run_flow(world, payload, trigger, auto_params=None):
    ir = payload["flowIr"]
    nodes = {n["id"]: n for n in ir["nodes"]}
    params = {p["name"]: p.get("value") for p in ir.get("params", [])}
    params.update(auto_params or {})
    steps = {}
    ctx = {"trigger": trigger, "params": params, "steps": steps}

    def run(ids):
        for nid in ids:
            n = nodes[nid]
            if n["kind"] == "if":
                ok = eval(n["cond"], {"__builtins__": {}}, {"steps": steps, "trigger": trigger, "params": params})  # noqa: S307
                run(n["then"] if ok else n.get("else", []))
                continue
            node_params = {}
            for p in n.get("params", []):
                node_params[p["name"]] = resolve(p["binding"], ctx) if "binding" in p else p.get("value")
            env = {"__name__": "__node__", "__builtins__": NODE_BUILTINS, "api": world.api, "params": node_params, "trigger": trigger}
            exec(compile(n["code"], f"<{payload['name']}:{nid}>", "exec"), env)  # noqa: S102
            outs = {}
            for o in n.get("outputs", []):
                assert o["name"] in env, f"{nid}: declared output {o['name']} was not assigned"
                outs[o["name"]] = json.loads(json.dumps(env[o["name"]]))  # outputs must be JSON
            steps[nid] = {"outputs": outs}

    run(ir["rootOrder"])
    return steps
