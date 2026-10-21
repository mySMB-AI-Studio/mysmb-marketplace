"""The build without payroll (`node gen-ext.js <root> --without-payroll`): Bookkeeping for Xero for a tier that mustn't
have payroll yet. It must hold every accounts payable component, nothing payroll, and pass the AP scenario tests."""
import glob
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

from dryrun import dry_run

KIT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
REPO = os.path.normpath(os.path.join(KIT, "..", ".."))
AP_SUITES = ["test_flows", "test_intake", "test_mail_folders", "test_split", "test_scans", "test_statements",
             "test_requests", "test_sales", "test_checks", "test_static", "test_lint"]


class WithoutPayrollTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = tempfile.mkdtemp(prefix="bk-without-payroll-")
        os.makedirs(os.path.join(cls.root, ".claude-plugin"))
        shutil.copy(os.path.join(REPO, ".claude-plugin", "marketplace.json"), os.path.join(cls.root, ".claude-plugin"))
        subprocess.run(["node", os.path.join(KIT, "gen-ext.js"), cls.root, "--without-payroll"], check=True, capture_output=True)
        cls.plugin = os.path.join(cls.root, "plugins", "bookkeeping-xero")
        cls.default = os.path.join(REPO, "plugins", "bookkeeping-xero")

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.root, ignore_errors=True)

    def payloads(self, plugin, kind):
        out = {}
        for f in glob.glob(os.path.join(plugin, "content", kind, "*.json")):
            with open(f, encoding="utf-8") as fh:
                p = json.load(fh)
            out[p.get("name") or p.get("title")] = p
        return out

    def test_every_accounts_payable_component_and_nothing_payroll(self):
        autos = self.payloads(self.plugin, "automations")
        forms = self.payloads(self.plugin, "forms")
        default_autos = self.payloads(self.default, "automations")
        self.assertEqual((len(autos), len(forms)), (14, 8))
        self.assertEqual(sorted(autos), sorted(n for n in default_autos if "Payroll" not in n and "pay run" not in n.lower()
                                                and n != "Bookkeeping: Apply payroll review"))
        for root, _dirs, files in os.walk(self.plugin):
            for f in files:
                with open(os.path.join(root, f), encoding="utf-8", errors="ignore") as fh:
                    self.assertNotIn("payroll", fh.read().lower(), os.path.join(root, f))

    def test_components_keep_their_identity_and_only_setup_changes(self):
        autos = self.payloads(self.plugin, "automations")
        default_autos = self.payloads(self.default, "automations")
        changed = sorted(n for n, p in autos.items() if p["contentHash"] != default_autos[n]["contentHash"])
        self.assertEqual(changed, ["Bookkeeping: Apply setup (Xero)", "Bookkeeping: Start setup"])
        for n, p in autos.items():
            self.assertEqual(p["originKey"], default_autos[n]["originKey"], n)
        default_forms = self.payloads(self.default, "forms")
        for t, p in self.payloads(self.plugin, "forms").items():
            self.assertEqual(p["contentHash"], default_forms[t]["contentHash"], t)

    def test_every_dependency_is_in_the_bundle(self):
        form_keys = {p["originKey"] for p in self.payloads(self.plugin, "forms").values()}
        for name, p in self.payloads(self.plugin, "automations").items():
            for d in p["dependencies"]:
                self.assertIn(d["originKey"], form_keys, name)

    def test_every_automation_passes_the_publish_practice_run(self):
        for name, p in self.payloads(self.plugin, "automations").items():
            with self.subTest(name):
                dry_run(p)

    def test_the_accounts_payable_scenarios_pass_on_it(self):
        env = dict(os.environ, BK_PLUGIN=self.plugin)
        run = subprocess.run([sys.executable, "-m", "unittest", *AP_SUITES], cwd=os.path.dirname(__file__), env=env,
                             capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr[-3000:])


if __name__ == "__main__":
    unittest.main()
