"""Every automation must pass the Publish "Practice run" (sample event with an empty payload, mock workspace)."""
import glob
import json
import os
import unittest

from dryrun import dry_run
from test_flows import PLUGIN


class PracticeRun(unittest.TestCase):
    def test_every_automation_passes_the_publish_practice_run(self):
        files = sorted(glob.glob(os.path.join(PLUGIN, "content", "automations", "*.json")))
        self.assertEqual(len(files), 17)
        for f in files:
            with open(f, encoding="utf-8") as fh:
                payload = json.load(fh)
            with self.subTest(payload["name"]):
                dry_run(payload)

    def test_empty_form_answers_change_nothing(self):
        for f in glob.glob(os.path.join(PLUGIN, "content", "automations", "*.json")):
            with open(f, encoding="utf-8") as fh:
                payload = json.load(fh)
            if any(t.get("eventType") == "form.response_submitted" for t in payload["flowIr"]["triggers"]):
                with self.subTest(payload["name"]):
                    _, actions = dry_run(payload)
                    self.assertEqual(actions, [])


if __name__ == "__main__":
    unittest.main()
