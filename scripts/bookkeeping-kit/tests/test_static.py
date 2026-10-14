"""Static checks on the generated node code that neither marketplace validator runs."""
import ast
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
from harness import ALLOWED  # noqa: E402
from test_flows import AUTOS  # noqa: E402


class StaticTests(unittest.TestCase):
    def nodes(self):
        for name, payload in AUTOS.items():
            for n in payload["flowIr"]["nodes"]:
                if n["kind"] == "python":
                    yield name, n

    def test_imports_are_allow_listed(self):
        for name, n in self.nodes():
            for node in ast.walk(ast.parse(n["code"])):
                mods = []
                if isinstance(node, ast.Import):
                    mods = [a.name for a in node.names]
                elif isinstance(node, ast.ImportFrom):
                    mods = [node.module or ""]
                for m in mods:
                    self.assertIn(m.split(".")[0], ALLOWED, f"{name}/{n['id']} imports {m}")

    def test_api_calls_are_keyword_only(self):
        for name, n in self.nodes():
            for node in ast.walk(ast.parse(n["code"])):
                if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                    base = node.func.value
                    if isinstance(base, ast.Attribute) and isinstance(base.value, ast.Name) and base.value.id == "api" and node.func.attr not in ("scratch_path", "scratch_list"):
                        self.assertEqual(node.args, [], f"{name}/{n['id']}: api.{base.attr}.{node.func.attr} has positional args")

    def test_declared_outputs_are_assigned_at_top_level(self):
        for name, n in self.nodes():
            tree = ast.parse(n["code"])
            assigned = {t.id for s in tree.body for t in ast.walk(s) if isinstance(t, ast.Name) and isinstance(t.ctx, ast.Store)}
            for o in n["outputs"]:
                self.assertIn(o["name"], assigned, f"{name}/{n['id']} never assigns output {o['name']}")

    def test_no_banned_builtins(self):
        for name, n in self.nodes():
            for node in ast.walk(ast.parse(n["code"])):
                if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                    self.assertNotIn(node.func.id, {"eval", "exec", "compile", "input", "globals", "vars"}, f"{name}/{n['id']}")

    def test_every_xero_write_passes_the_tenant(self):
        # xero_call(tool, tenant_id, ...) is the only path to Xero writes; direct invokes are list_connections only.
        for name, n in self.nodes():
            for node in ast.walk(ast.parse(n["code"])):
                if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "invoke":
                    tool = next((k.value for k in node.keywords if k.arg == "tool"), None)
                    if isinstance(tool, ast.Constant):
                        self.assertEqual(tool.value, "list_connections", f"{name}/{n['id']} invokes {tool.value} directly")

    def test_knowledge_paths_respect_folder_depth(self):
        # Knowledge allows at most 2 folder levels.
        for name, n in self.nodes():
            for node in ast.walk(ast.parse(n["code"])):
                if isinstance(node, ast.Constant) and isinstance(node.value, str) and node.value.startswith("Bookkeeping"):
                    self.assertLessEqual(node.value.count("/"), 1, f"{name}/{n['id']}: {node.value}")


if __name__ == "__main__":
    unittest.main()
