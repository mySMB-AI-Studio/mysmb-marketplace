import ast
import unittest

from fakes import PLUGINS, component_files, load
from kit import block_re, sync_code

ALWAYS_ON = {"350ac9ef", "4f49f9c6", "98724256"}  # pollers with no time of day: nothing to localise
CLOCK_FNS = ("practice_open_now(", "practice_due_at(", "practice_clock_now(")


def automations():
    for plugin in PLUGINS:
        for path in component_files(plugin):
            payload = load(path)[0]
            if payload.get("kind") == "automation":
                yield plugin, path, payload


def python_nodes(payload):
    return [n for n in payload["flowIr"]["nodes"] if n["kind"] == "python"]


class Static(unittest.TestCase):
    def test_every_helper_copy_matches_its_canonical_file(self):
        for _, path, payload in automations():
            for n in python_nodes(payload):
                self.assertEqual(n["code"], sync_code(n["code"]), "%s %s: run sync.py" % (path.name, n["id"]))

    def test_helpers_are_present_wherever_they_are_called(self):
        for _, path, payload in automations():
            for n in python_nodes(payload):
                code = n["code"]
                calls_clock = any(fn in code.replace("def " + fn, "") for fn in CLOCK_FNS)
                self.assertEqual(calls_clock, bool(block_re("practice-clock").search(code)), "%s %s" % (path.name, n["id"]))
                calls_reviewer = "practice_review_assignment(" in code.replace("def practice_review_assignment(", "")
                self.assertEqual(calls_reviewer, bool(block_re("practice-reviewer").search(code)), "%s %s" % (path.name, n["id"]))

    def test_node_code_compiles(self):
        for _, path, payload in automations():
            for n in python_nodes(payload):
                compile(n["code"], "%s:%s" % (path.name, n["id"]), "exec")

    def test_schedules_tick_in_utc_and_every_timed_one_checks_the_practice_clock(self):
        for _, path, payload in automations():
            schedules = [t for t in payload["flowIr"]["triggers"] if t["kind"] == "schedule"]
            if not schedules:
                continue
            for t in schedules:
                self.assertEqual(t["timezone"], "UTC", path.name)
                self.assertIn(t["cron"], ("*/15 * * * *", "*/30 * * * *"), path.name)
            if path.name[:8] in ALWAYS_ON:
                continue
            text = "".join(n["code"] for n in python_nodes(payload))
            self.assertRegex(text, r"(?<!def )practice_(open_now|due_at)\(", path.name)

    def test_cliniko_has_no_fixed_reviewer(self):
        for plugin, path, payload in automations():
            if plugin != "cliniko-automations":
                continue
            for n in python_nodes(payload):
                self.assertNotRegex(n["code"], r"[\w.+-]+@[\w-]+\.[\w.]+", "%s %s" % (path.name, n["id"]))
                self.assertNotIn("assignee_ids=assignee_ids", n["code"])
                for call in ast.walk(ast.parse(n["code"])):
                    if isinstance(call, ast.Call) and ast.unparse(call.func) == "api.workq.create":
                        kw = {k.arg: ast.unparse(k.value) for k in call.keywords}
                        self.assertEqual(kw.get("assignee_ids"), "review['assignee_ids']", "%s %s" % (path.name, n["id"]))
                        self.assertEqual(kw.get("assigned_group_ids"), "review['assigned_group_ids']", "%s %s" % (path.name, n["id"]))

    def test_cliniko_runs_are_gated_on_the_practice_clock(self):
        for plugin, path, payload in automations():
            if plugin != "cliniko-automations" or not any(t["kind"] == "schedule" for t in payload["flowIr"]["triggers"]):
                continue
            gate = next(n for n in payload["flowIr"]["nodes"] if n["id"] == "gate_settings")
            self.assertIn('steps["load_context"]["outputs"]["due"]', gate["cond"], path.name)
            load_context = next(n for n in payload["flowIr"]["nodes"] if n["id"] == "load_context")
            self.assertIn("due", [o["name"] for o in load_context["outputs"]], path.name)

    def test_apply_setup_may_read_groups(self):
        for plugin, path, payload in automations():
            if "practice_setup" in str(payload["flowIr"]).replace(" ", "_").lower() and "api.groups.list(" in str(payload["flowIr"]):
                self.assertIn("groups:read", payload["declaredScopes"], path.name)


if __name__ == "__main__":
    unittest.main()
