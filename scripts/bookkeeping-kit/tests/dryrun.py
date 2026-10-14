"""Replicates the Publish "Practice run" (myHubV2 validation stage 4) for every generated automation.

Mirrors apps/web/src/lib/automations/validation/pipeline.ts (sampleTriggerFor / sampleParamsFor),
runtime/executor.ts (resolveParams: a `required` input that resolves to nothing fails the run) and
bridge/mock-bridge.ts (reads return small fixed datasets, mutations return fakes, anything else None).
"""
import copy
import json
import os
import tempfile

from harness import NODE_BUILTINS, resolve

ZERO = "00000000-0000-4000-8000-000000000000"
SUBJECT = {  # packages/shared/src/events/catalog.ts
    "form.response_submitted": [("form_id", "uuid"), ("response_id", "uuid"), ("portal_id", "uuid"), ("todo_id", "uuid")],
    "knowledge.file_created": [("path", "string"), ("scope", "string")],
}
MOCK_TODO = {"id": "00000000-0000-4000-8000-00000000t001", "title": "Sample WorkQ item", "status": "not_started",
             "priority": "medium", "scope": "org", "assigneeIds": ["00000000-0000-4000-8000-000000000002"],
             "dueDate": "2026-07-10", "labels": ["sample"]}


def _mock_pdf(scratch):
    from fpdf import FPDF
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=11)
    pdf.cell(0, 8, "Mock template", new_x="LMARGIN", new_y="NEXT")
    path = os.path.join(scratch, "in", "mock-template.pdf")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pdf.output(path)
    return path


class _Ns:
    def __init__(self, ns, mock):
        self._ns, self._mock = ns, mock

    def __getattr__(self, method):
        if self._ns == "files" and method in ("scratch_path", "scratch_list"):
            return getattr(self._mock, method)

        def call(*args, **kwargs):
            if args:
                raise TypeError(f"api.{self._ns}.{method} takes keyword arguments only")
            return self._mock.call(self._ns, method, kwargs)
        return call


class MockApi:
    READS = {"workq.get", "workq.list", "files.list", "files.read", "files.get", "ai.generate", "ai.extract"}

    def __init__(self):
        self.scratch = tempfile.mkdtemp(prefix="bk-dry-")
        self.actions = []
        self.counter = 0

    def __getattr__(self, ns):
        return _Ns(ns, self)

    def scratch_path(self, name):
        path = os.path.join(self.scratch, name.replace("\\", "/").lstrip("/"))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        return path

    def _id(self, prefix):
        self.counter += 1
        return f"{prefix}-mock-{self.counter:04d}"

    def call(self, ns, method, args):
        key = f"{ns}.{method}"
        if key == "workq.get":
            return {**MOCK_TODO, "id": args.get("todo_id") or MOCK_TODO["id"]}
        if key == "workq.list":
            return [dict(MOCK_TODO), {**MOCK_TODO, "id": "t002", "title": "Item due today"},
                    {**MOCK_TODO, "id": "t003", "status": "in_progress", "title": "Overdue urgent item"}]
        if key == "files.list":
            return [{"name": "handbook.md", "kind": "file", "path": "handbook.md", "size": 2048}]
        if key == "files.read":
            return "# Handbook\n\nSample knowledge content."
        if key == "files.get":
            return _mock_pdf(self.scratch)
        if key == "ai.generate":
            return "[AI-generated text for: " + str(args.get("prompt", ""))[:60] + "]"
        if key == "ai.extract":
            return {"_mock": True, "note": "AI extraction placeholder"}
        self.actions.append(key)
        if key == "workq.create":
            return {**MOCK_TODO, "id": self._id("todo"), "title": args.get("title") or MOCK_TODO["title"]}
        if key in ("workq.update", "workq.set_status", "workq.assign", "workq.complete"):
            return {**MOCK_TODO, "id": args.get("todo_id") or MOCK_TODO["id"], "status": args.get("status") or "done"}
        if key == "workq.comment":
            return {"id": self._id("comment"), "todoId": args.get("todo_id"), "body": args.get("body")}
        if key == "workq.attach_form":
            return {**MOCK_TODO, "id": args.get("todo_id") or MOCK_TODO["id"], "formId": args.get("form_id")}
        if key == "files.put":
            return {"saved": True, "file": args.get("file")}
        if key == "files.delete":
            return {"deleted": True}
        if key == "notify.send":
            return {"sent": max(len(args.get("user_ids") or []) + len(args.get("group_ids") or []), 1)}
        if key == "connectors.invoke":
            return {"ok": True, "mock": True, "tool": args.get("tool")}
        return {"ok": True}


def sample_trigger(ir):
    ev = next((t for t in ir["triggers"] if t["kind"] == "event"), None)
    if not ev:
        return {"kind": "manual", "actor_user_id": ZERO}
    subject = {n: (ZERO if t == "uuid" else f"sample {n}") for n, t in SUBJECT[ev["eventType"]]}
    subject.update(ev.get("filter") or {})
    return {"kind": "event", "event": {"eventType": ev["eventType"], "subject": subject, "payload": {}}, "actor_user_id": ZERO}


def sample_params(ir):
    out = {}
    for p in ir.get("params", []):
        if "value" in p:
            out[p["name"]] = p["value"]
        elif p.get("options"):
            out[p["name"]] = p["options"][0]["value"]
        else:
            out[p["name"]] = {"str": "sample", "int": 1, "float": 1.0, "bool": True}.get(p["type"], "sample")
    return out


def dry_run(payload):
    ir = payload["flowIr"]
    nodes = {n["id"]: n for n in ir["nodes"]}
    trigger, params, steps = sample_trigger(ir), sample_params(ir), {}
    ctx = {"trigger": trigger, "params": params, "steps": steps}
    api = MockApi()

    def run(ids):
        for nid in ids:
            n = nodes[nid]
            if n["kind"] == "if":
                ok = eval(n["cond"], {"__builtins__": {}}, {"steps": steps, "trigger": trigger, "params": params})  # noqa: S307
                run(n["then"] if ok else n.get("else", []))
                continue
            node_params = {}
            for p in n.get("params", []):
                val = resolve(p["binding"], ctx) if "binding" in p else p.get("value")
                if p.get("required") and val is None:
                    raise RuntimeError(f'{nid}: Required input "{p["name"]}" was empty (binding {p.get("binding")})')
                node_params[p["name"]] = val
            env = {"__name__": "__node__", "__builtins__": NODE_BUILTINS, "api": api, "params": node_params, "trigger": trigger}
            try:
                exec(compile(n["code"], f"<{payload['name']}:{nid}>", "exec"), env)  # noqa: S102
            except Exception as exc:
                raise RuntimeError(f"{nid}: {type(exc).__name__}: {exc}") from exc
            outs = {}
            for o in n.get("outputs", []):
                if o["name"] not in env:
                    raise RuntimeError(f"{nid}: declared output {o['name']} was not assigned")
                outs[o["name"]] = json.loads(json.dumps(env[o["name"]]))
            steps[nid] = {"outputs": copy.deepcopy(outs)}

    run(ir["rootOrder"])
    return steps, api.actions
