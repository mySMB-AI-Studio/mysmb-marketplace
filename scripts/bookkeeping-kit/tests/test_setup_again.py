"""Set up again: the setup lives in Knowledge, so it survives removing and installing the extension again; Start setup
says so, and with "Set up again: Yes" it sends the Bookkeeping setup form anyway. Submitting it replaces the setup."""
import json
import unittest

from harness import run_flow
from test_flows import AUTOS, BOOKKEEPER, REVIEWER, Base

START = "Bookkeeping: Start setup"
APPLY = "Bookkeeping: Apply setup (Xero)"
OTHER = {"id": "user-other", "label": "Olive Other"}


class SetupAgainTests(Base):
    def start(self, **params):
        return run_flow(self.w, AUTOS[START], {"kind": "manual", "actor_user_id": BOOKKEEPER}, params)

    def setup_items(self):
        return [i for i in self.w.items.values() if i["title"].startswith("Set up Bookkeeping for Xero")]

    def test_without_set_up_again_it_says_what_is_saved_and_how_to_change_it(self):
        self.setup_practice()
        before = len(self.setup_items())
        out = self.start()["start_setup"]["outputs"]
        self.assertEqual(out["created_count"], 0)
        self.assertIn("reviewer Rhea Reviewer", out["summary"])
        self.assertIn("Set up again: Yes", out["summary"])
        self.assertIn("removed and installed again", out["summary"])
        self.assertEqual(len(self.setup_items()), before)

    def test_set_up_again_sends_the_form_and_submitting_it_replaces_the_setup(self):
        self.setup_practice()
        out = self.start(setup_again="yes")["start_setup"]["outputs"]
        self.assertEqual(out["created_count"], 1)
        item = next(i for i in self.setup_items() if i["title"] == "Set up Bookkeeping for Xero (again)")
        self.assertTrue(item["description"].startswith("**What to do:** fill in the **Bookkeeping setup** form"))
        self.assertIn("it's replaced when you submit the form (now: reviewer Rhea Reviewer", item["description"])
        self.assertIn("client settings are kept", item["description"])
        self.submit(APPLY, "Bookkeeping setup", item["id"], {
            "q_mode": "Practice: we keep the books for many client businesses", "q_timezone": "Australia/Sydney",
            "q_reviewer": OTHER, "q_approved_status": "Approved"})
        s = json.loads(self.w.files["Bookkeeping/settings.json"])
        self.assertEqual((s["reviewer_name"], s["approved_status"]), ("Olive Other", "AUTHORISED"))
        self.assertIn("Bookkeeping/Clients/acme-plumbing.json", self.w.files)

    def test_the_first_run_is_unchanged(self):
        out = self.start()["start_setup"]["outputs"]
        self.assertEqual(out["created_count"], 1)
        [item] = self.setup_items()
        self.assertEqual(item["title"], "Set up Bookkeeping for Xero")
        self.assertNotIn("Saved setup", item["description"])


if __name__ == "__main__":
    unittest.main()
