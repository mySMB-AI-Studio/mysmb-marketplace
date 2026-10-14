"""Publish stage 2 ("Code safety"): the platform's own AST lint, run on every generated node.

Loads myHubV2's apps/web/src/lib/automations/runtime/ast-lint.py (copied into .myhub/) with the import allowlists
from sandbox-bootstrap.py, exactly as the worker does.
"""
import glob
import json
import os
import unittest

from test_flows import PLUGIN

KIT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINT = os.path.join(KIT, ".myhub", "apps", "web", "src", "lib", "automations", "runtime", "ast-lint.py")
BOOTSTRAP = {  # apps/web/src/lib/automations/runtime/sandbox-bootstrap.py
    "ALLOWED_STDLIB": {
        "abc", "base64", "bisect", "calendar", "collections", "contextlib", "copy", "csv", "dataclasses", "datetime",
        "decimal", "difflib", "enum", "fractions", "functools", "hashlib", "heapq", "html", "io", "itertools", "json",
        "math", "numbers", "operator", "pathlib", "random", "re", "secrets", "statistics", "string", "textwrap", "time",
        "types", "typing", "unicodedata", "uuid", "zoneinfo",
    },
    "PURE_WHEEL_ROOTS": {"docx": "", "openpyxl": "", "et_xmlfile": "", "pptx": "", "xlsxwriter": "", "fpdf": "",
                         "defusedxml": "", "fontTools": "", "markdown": "", "typing_extensions": "", "jinja2": "", "pypdf": ""},
    "BINARY_ROOTS": {"lxml", "PIL", "markupsafe"},
}


def lint_flow():
    ns = dict(BOOTSTRAP)
    with open(LINT, encoding="utf-8") as fh:
        exec(compile(fh.read(), LINT, "exec"), ns)  # noqa: S102
    return ns["lint_flow"]


class CodeSafety(unittest.TestCase):
    def test_every_node_passes_the_platform_lint(self):
        lint = lint_flow()
        files = sorted(glob.glob(os.path.join(PLUGIN, "content", "automations", "*.json")))
        self.assertTrue(files)
        for f in files:
            with open(f, encoding="utf-8") as fh:
                payload = json.load(fh)
            nodes = [{"id": n["id"], "code": n["code"], "declaredOutputs": [o["name"] for o in n.get("outputs", [])],
                      "paramNames": [p["name"] for p in n.get("params", [])]}
                     for n in payload["flowIr"]["nodes"] if n["kind"] == "python"]
            with self.subTest(payload["name"]):
                self.assertEqual(json.loads(lint(json.dumps(nodes))), [])


if __name__ == "__main__":
    unittest.main()
