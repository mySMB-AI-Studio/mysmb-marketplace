"""Execute packaged AP Python against synthetic APIs only; no network or live runs."""
import ast
import base64
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "plugins/xero-bookkeeping-ap/content"
CLIENT = "11111111-1111-4111-8111-111111111111"


def scripts():
    for path in (PACKAGE / "automations").glob("*.json"):
        document = json.loads(path.read_text())
        for node in document["flowIr"]["nodes"]:
            if "code" in node:
                yield document, node["code"]


class FakeApi:
    def __init__(self, scratch):
        self.created, self.updated, self.calls = [], [], []
        self.files = SimpleNamespace(get=lambda **kw: "{}", put=lambda **kw: None, scratch_path=lambda name: str(Path(scratch) / name))
        self.extension = SimpleNamespace(settings=lambda: {"start_reading_from": "2026-11-01", "mail_folders": ["Inbox"]})
        self.records = SimpleNamespace(list=self.list_records, create=self.create, update=self.update)
        self.connectors = SimpleNamespace(invoke=self.invoke)
        self.artifacts = SimpleNamespace(put=lambda **kw: {"artifact_id": "artifact-a"}, get=lambda **kw: str(Path(scratch) / "bill.pdf"))
        self.ai = SimpleNamespace(extract=lambda **kw: {"documents": [{"kind": "tax_invoice", "supplier_name": "Supplier", "bill_to_name": "Alpha", "invoice_number": "INV-1", "total": 123.45, "gst": 11.22, "confidence": 90, "currency": "AUD"}]})
        (Path(scratch) / "bill.pdf").write_bytes(b"synthetic PDF")

    def list_records(self, *, type_slug, **kw):
        rows = [{"id": CLIENT, "title": "Alpha", "data": {"ap_enabled": True, "ap_xero_tenant_id": "xero-a", "ap_xero_org_name": "Alpha", "ap_approval_route": "draft_only"}}] if type_slug == "client" else []
        return {"records": rows, "nextCursor": None}

    def create(self, *, type_slug, record):
        if set(record) != {"title", "data", "links"}:
            raise ValueError("strict Records envelope required")
        self.created.append(record)
        return {"id": "bill-a", **record}

    def update(self, *, type_slug, record_id, record):
        if set(record) != {"data"}:
            raise ValueError("strict Records patch envelope required")
        self.updated.append(record)

    def invoke(self, *, server, tool, args):
        self.calls.append((server, tool, args))
        if tool == "list_connections":
            return {"tenants": [{"tenantId": "xero-a", "tenantName": "Alpha"}]}
        if tool == "list_invoices":
            return {"Invoices": [{"InvoiceID": "xero-bill-a", "InvoiceNumber": "INV-1", "UpdatedDateUTC": "2026-11-17T01:00:00Z", "Contact": {"Name": "Supplier"}, "Total": 123.45, "TotalTax": 11.22, "CurrencyCode": "AUD", "Status": "DRAFT"}]}
        if tool in ("list_history", "list_attachments"):
            return []
        if tool == "list_labels":
            return []
        if tool == "list_messages":
            return {"messages": [{"id": "email-a", "internalDate": "2026-11-17T01:00:00Z", "from": "supplier@example.test", "subject": "Invoice", "hasAttachments": True}]}
        if tool == "get_message":
            return {"attachments": [{"attachmentId": "attachment-a", "filename": "bill.pdf", "mimeType": "application/pdf", "size": 500}]}
        if tool == "list_emails":
            return {"emails": [{"id": "email-a", "receivedDateTime": "2026-11-17T01:00:00Z", "from": "supplier@example.test", "subject": "Invoice", "hasAttachments": True}]}
        if tool == "list_email_attachments":
            return {"attachments": [{"id": "attachment-a", "name": "bill.pdf", "contentType": "application/pdf", "size": 500}]}
        if tool in ("get_email_attachment", "get_attachment"):
            return {"name": "bill.pdf", "contentType": "application/pdf", "contentBase64": base64.b64encode(b"synthetic PDF").decode()}
        if tool == "upload_attachment":
            return {}
        raise AssertionError(f"Unexpected synthetic connector call: {server}/{tool}")


class PackagedRecordCalls(unittest.TestCase):
    def test_all_intakes_run_to_strict_create_envelopes(self):
        for document, code in scripts():
            if "api.records.create" not in code:
                continue
            with self.subTest(automation=document["name"]), tempfile.TemporaryDirectory() as scratch:
                api = FakeApi(scratch)
                namespace = {"api": api}
                exec(compile(code, document["name"], "exec"), namespace)
                self.assertEqual(namespace["problems"], "")
                self.assertEqual(len(api.created), 1)
                record = api.created[0]
                self.assertEqual(record["title"], "Supplier · INV-1")
                self.assertEqual(record["links"], {"client": [CLIENT]})
                self.assertEqual(record["data"]["approval_route"], "draft_only")
                self.assertEqual(record["data"]["total"], 12345)
                self.assertEqual(record["data"]["gst"], 1122)
                self.assertIs(type(record["data"]["total"]), int)
                self.assertNotIn("bill_name", record["data"])
                self.assertNotIn("client", record["data"])
                self.assertTrue(all(args.get("xero_tenant_id") == "xero-a" for server, tool, args in api.calls if server == "xero-accounting" and tool != "list_connections"))

    def test_unmatched_mail_bill_has_no_client_relation_or_title_in_data(self):
        document, code = next((doc, code) for doc, code in scripts() if "(Outlook)" in doc["name"])
        with tempfile.TemporaryDirectory() as scratch:
            api = FakeApi(scratch)
            api.records.list = lambda **kw: {"records": [], "nextCursor": None}
            namespace = {"api": api}
            exec(compile(code, document["name"], "exec"), namespace)
            self.assertEqual(namespace["problems"], "")
            self.assertEqual(len(api.created), 1)
            self.assertEqual(api.created[0]["links"], {})
            self.assertNotIn("client", api.created[0]["data"])
            self.assertNotIn("bill_name", api.created[0]["data"])

    def test_attach_pdf_uses_strict_patch_and_tenant_bound_connector_calls(self):
        document, code = next((doc, code) for doc, code in scripts() if "Attach bill PDFs" in doc["name"])
        with tempfile.TemporaryDirectory() as scratch:
            api = FakeApi(scratch)
            api.records.list = lambda **kw: {"records": [{"id": "bill-a", "data": {"document_artifact_id": "artifact-a", "xero_tenant_id": "xero-a", "invoice_number": "INV-1", "supplier_name": "Supplier"}}], "nextCursor": None}
            namespace = {"api": api}
            exec(compile(code, document["name"], "exec"), namespace)
            self.assertEqual(namespace["problems"], "")
            self.assertEqual(api.updated, [{"data": {"pdf_attached": True, "xero_bill_id": "xero-bill-a"}}])

    def test_all_intakes_use_minor_units_and_read_projected_extension_fields(self):
        for document, code in scripts():
            if "api.records.create" not in code:
                continue
            with self.subTest(automation=document["name"]):
                # Load actual pure helpers without executing a mailbox or ledger loop.
                tree = ast.parse(code)
                tree.body = [node for node in tree.body if isinstance(node, (ast.Import, ast.ImportFrom, ast.FunctionDef))]
                namespace = {}
                exec(compile(tree, document["name"], "exec"), namespace)
                self.assertEqual(namespace["minor_units"]("1.005"), 101)
                self.assertEqual(namespace["minor_units"]("0"), 0)
                self.assertEqual(namespace["minor_units"](None), None)
                self.assertEqual(namespace["minor_units"]("not money"), None)
                self.assertEqual(namespace["minor_units"]("NaN"), None)
                self.assertIs(namespace["field"]({"data": {"ap_enabled": False}, "ap_enabled": True}, "ap_enabled"), False)
                self.assertEqual(namespace["field"]({"data": {"ap_xero_tenant_id": "xero-a"}}, "ap_xero_tenant_id"), "xero-a")


if __name__ == "__main__":
    unittest.main()
