"""Publish stage 2 ("Code safety"): the platform's own AST lint over every node of both extensions.

Uses the copy of myHubV2's ast-lint.py that the bookkeeping kit keeps in `.myhub/`, with the
sandbox-bootstrap import allowlists, the same way scripts/bookkeeping-kit/tests/test_lint.py does.
"""
import json
import pathlib
import unittest

from fakes import PLUGINS, component_files, load

KIT = pathlib.Path(__file__).resolve().parent.parent
LINT = str(KIT.parent / "bookkeeping-kit" / ".myhub" / "apps" / "web" / "src" / "lib" / "automations" / "runtime" / "ast-lint.py")
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


class CodeSafety(unittest.TestCase):
    def test_every_node_passes_the_platform_lint(self):
        ns = dict(BOOTSTRAP)
        exec(compile(pathlib.Path(LINT).read_text(encoding="utf-8"), LINT, "exec"), ns)  # noqa: S102
        lint = ns["lint_flow"]
        for plugin in PLUGINS:
            for path in component_files(plugin):
                payload = load(path)[0]
                if payload.get("kind") != "automation":
                    continue
                nodes = [{"id": n["id"], "code": n["code"], "declaredOutputs": [o["name"] for o in n.get("outputs", [])],
                          "paramNames": [p["name"] for p in n.get("params", [])]}
                         for n in payload["flowIr"]["nodes"] if n["kind"] == "python"]
                with self.subTest(payload["name"]):
                    self.assertEqual(json.loads(lint(json.dumps(nodes))), [])


if __name__ == "__main__":
    unittest.main()
