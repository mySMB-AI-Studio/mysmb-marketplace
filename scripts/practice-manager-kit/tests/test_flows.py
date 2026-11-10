"""Run the changed nodes against a fake workspace: whose clock a scheduled run follows, and who reviews."""
import json
import unittest

from fakes import FakeApi, automation, eval_cond, node, run_node, tick

CA, HP = "cliniko-automations", "healthcare-practice-management"
KL = {"slug": "kl-clinic", "name": "KL Clinic", "cliniko_business_id": "111", "timezone": "Asia/Kuala_Lumpur",
      "email_provider": "outlook", "reviewer_id": "u-kl", "review_group_id": "g-front-desk", "xero_tenant_id": "x-kl"}
SYD = {"slug": "syd-clinic", "name": "Sydney Clinic", "cliniko_business_id": "222", "timezone": "Australia/Sydney",
       "email_provider": "outlook", "reviewer_id": "u-syd", "review_group_id": "", "xero_tenant_id": "x-syd"}
USERS = [{"id": "u-kl", "email": "kl@clinic.example"}, {"id": "u-syd", "email": "syd@clinic.example"}]


def practices(*ps):
    return {"PracticeManager/Practices/" + p["slug"] + ".json": json.dumps(p) for p in ps}


def gate(payload, outputs):
    return eval_cond(node(payload, "gate_settings")["cond"], {"load_context": {"outputs": outputs}})


class ClinikoRunsOnThePracticeClock(unittest.TestCase):
    POLLERS = ("66b8c8fd", "7ec16d16", "b295c808", "f7bfcd57")

    def load_context(self, prefix, trig, practice=KL):
        payload = automation(CA, prefix)
        ns = run_node(node(payload, "load_context")["code"], FakeApi(files=practices(practice)), {"practice_slug": ""}, trig)
        outputs = {o["name"]: ns[o["name"]] for o in node(payload, "load_context")["outputs"]}
        return payload, outputs

    def test_pollers_work_from_7am_to_9pm_kuala_lumpur(self):
        for prefix in self.POLLERS:
            for fired, expected in (("2026-11-10T23:00:00Z", True),   # 07:00 KL
                                    ("2026-11-10T12:45:00Z", True),   # 20:45 KL
                                    ("2026-11-10T13:00:00Z", False),  # 21:00 KL
                                    ("2026-11-10T22:45:00Z", False)):  # 06:45 KL
                payload, out = self.load_context(prefix, tick(fired))
                self.assertEqual(out["problem"], "", prefix)
                self.assertEqual(out["due"], expected, (prefix, fired))
                self.assertEqual(bool(gate(payload, out)), expected, (prefix, fired))

    def test_the_same_tick_follows_a_sydney_practice_instead(self):
        payload, out = self.load_context("7ec16d16", tick("2026-11-10T20:00:00Z"), SYD)  # 07:00 Sydney, 04:00 KL
        self.assertTrue(out["due"])
        payload, out = self.load_context("7ec16d16", tick("2026-11-10T20:00:00Z"), KL)
        self.assertFalse(out["due"])

    def test_daily_checks_run_once_at_their_practice_time(self):
        for prefix, hour in (("b11519bc", 6), ("b3ba3198", 7)):
            hits = []
            for half_hour in range(48):
                fired = "2026-11-10T%02d:%02d:00Z" % (half_hour // 2, 30 * (half_hour % 2))
                payload, out = self.load_context(prefix, tick(fired))
                if gate(payload, out):
                    hits.append(fired)
            # KL is UTC+8: 06:00 local is 22:00 UTC, 07:00 local is 23:00 UTC.
            self.assertEqual(hits, ["2026-11-10T%02d:00:00Z" % ((hour - 8) % 24)], prefix)

    def test_manual_runs_always_go_ahead(self):
        for prefix in self.POLLERS + ("b11519bc", "b3ba3198"):
            payload, out = self.load_context(prefix, {"kind": "manual"})
            self.assertTrue(gate(payload, out), prefix)

    def test_missing_settings_still_stops_the_run(self):
        payload = automation(CA, "7ec16d16")
        ns = run_node(node(payload, "load_context")["code"], FakeApi(), {"practice_slug": ""}, tick("2026-11-10T23:00:00Z"))
        self.assertTrue(ns["problem"])
        self.assertFalse(gate(payload, {"problem": ns["problem"], "due": ns["due"]}))


class ClinikoReviewer(unittest.TestCase):
    REFERRAL = {"patient_name": "Pat Example", "patient_email": "pat@example.com", "referral_type": "Medicare",
                "reasons": ["1 session left"], "case_id": "c1", "patient_id": "p1", "key": "c1"}

    def raise_referral(self, practice, users):
        payload = automation(CA, "b11519bc")
        api = FakeApi(files=practices(practice), users=users)
        run_node(node(payload, "draft_referral")["code"], api,
                 {"slug": practice["slug"], "settings": practice, "referral": self.REFERRAL,
                  "request_form": "02db3452-ad75-4d59-9848-7780467981b0"})
        created = api.calls_to("workq.create")
        self.assertEqual(len(created), 1)
        return created[0]

    def test_review_item_goes_to_the_practices_reviewer(self):
        item = self.raise_referral(KL, USERS)
        self.assertEqual((item["assignee_ids"], item["assigned_group_ids"]), (["u-kl"], None))

    def test_falls_back_to_the_practices_group(self):
        item = self.raise_referral(KL, [u for u in USERS if u["id"] != "u-kl"])
        self.assertEqual((item["assignee_ids"], item["assigned_group_ids"]), (None, ["g-front-desk"]))

    def test_each_practice_has_its_own_reviewer(self):
        item = self.raise_referral(SYD, USERS)
        self.assertEqual((item["assignee_ids"], item["assigned_group_ids"]), (["u-syd"], None))


class HealthcareRunsOnEachPracticesClock(unittest.TestCase):
    def businesses_queried(self, api):
        found = set()
        for kw in api.calls_to("connectors.invoke"):
            q = (kw.get("args") or {}).get("q") or []
            for part in q if isinstance(q, list) else [q]:
                if str(part).startswith("business_id:="):
                    found.add(str(part).split("=", 1)[1])
            if (kw.get("args") or {}).get("business_id"):
                found.add(str(kw["args"]["business_id"]))
        return found

    def run_brief(self, fired):
        payload = automation(HP, "eb41b439")
        api = FakeApi(files=practices(KL, SYD), users=USERS)
        run_node(node(payload, "build_brief")["code"], api, {}, tick(fired))
        return self.businesses_queried(api)

    def test_morning_brief_is_each_clinics_own_0730(self):
        self.assertEqual(self.run_brief("2026-11-10T20:30:00Z"), {"222"})  # Wed 07:30 Sydney
        self.assertEqual(self.run_brief("2026-11-10T23:30:00Z"), {"111"})  # Wed 07:30 Kuala Lumpur
        self.assertEqual(self.run_brief("2026-11-10T21:30:00Z"), set())

    def test_close_out_skips_the_practices_weekend(self):
        payload = automation(HP, "7637bf6e")
        for fired, expected in (("2026-11-13T09:00:00Z", {"111"}),   # Fri 17:00 KL
                                ("2026-11-14T09:00:00Z", set()),     # Sat 17:00 KL
                                ("2026-11-12T06:00:00Z", {"222"})):  # Thu 17:00 Sydney
            api = FakeApi(files=practices(KL, SYD), users=USERS)
            run_node(node(payload, "close_out")["code"], api, {}, tick(fired))
            self.assertEqual(self.businesses_queried(api), expected, fired)

    def test_cancellation_check_only_covers_practices_in_their_day(self):
        payload = automation(HP, "f4b9f0b8")
        api = FakeApi(files=practices(KL, SYD), users=USERS)
        run_node(node(payload, "find_new_cancellations")["code"], api, {}, tick("2026-11-10T23:30:00Z"))  # 07:30 KL, 10:30 Sydney
        self.assertEqual(self.businesses_queried(api), {"111", "222"})
        api = FakeApi(files=practices(KL, SYD), users=USERS)
        run_node(node(payload, "find_new_cancellations")["code"], api, {}, tick("2026-11-10T10:00:00Z"))  # 18:00 KL, 21:00 Sydney
        self.assertEqual(self.businesses_queried(api), {"111"})

    def test_reschedule_replies_follow_the_offers_practice(self):
        payload = automation(HP, "3c7f2c89")
        files = practices(KL, SYD)
        files["PracticeManager/AwaitingReply/t1.json"] = json.dumps({"slug": "kl-clinic", "todo_id": "t1"})
        files["PracticeManager/AwaitingReply/t2.json"] = json.dumps({"slug": "syd-clinic", "todo_id": "t2"})
        ns = run_node(node(payload, "list_waiting")["code"], FakeApi(files=files), {}, tick("2026-11-10T10:00:00Z"))
        self.assertEqual([w["todo_id"] for w in ns["waiting"]], ["t1"])
        ns = run_node(node(payload, "list_waiting")["code"], FakeApi(files=files), {}, {"kind": "manual"})
        self.assertEqual(sorted(w["todo_id"] for w in ns["waiting"]), ["t1", "t2"])

    def test_form_chase_uses_the_practices_tomorrow(self):
        payload = automation(HP, "ee19c078")
        files = practices(KL, SYD)
        # Booked for Thu 12 Nov 09:00 in KL (01:00Z) and Thu 12 Nov 09:00 in Sydney (Wed 22:00Z).
        files["PracticeManager/EnquiryThreads/a.json"] = json.dumps({"slug": "kl-clinic", "status": "booked", "patient_form_id": "f1",
                                                                    "enquirer_email": "a@example.com", "appointment_starts_at": "2026-11-12T01:00:00Z"})
        files["PracticeManager/EnquiryThreads/b.json"] = json.dumps({"slug": "syd-clinic", "status": "booked", "patient_form_id": "f2",
                                                                    "enquirer_email": "b@example.com", "appointment_starts_at": "2026-11-11T22:00:00Z"})
        api = FakeApi(files=files)
        ns = run_node(node(payload, "chase_incomplete_forms")["code"], api, {}, tick("2026-11-10T23:00:00Z"))  # Wed 07:00 KL
        self.assertEqual(ns["chased_count"], 1)
        self.assertEqual([kw["args"]["to"] for kw in api.calls_to("connectors.invoke") if kw["tool"] == "send_email"], [["a@example.com"]])
        api = FakeApi(files=files)
        ns = run_node(node(payload, "chase_incomplete_forms")["code"], api, {}, tick("2026-11-10T20:00:00Z"))  # Wed 07:00 Sydney
        self.assertEqual([kw["args"]["to"] for kw in api.calls_to("connectors.invoke") if kw["tool"] == "send_email"], [["b@example.com"]])


class PracticeSetup(unittest.TestCase):
    BASE = {"q_practice_name": "KL Clinic", "q_cliniko_business_id": "111", "q_email_provider": "Outlook (Microsoft 365)",
            "q_xero_org": "", "q_timezone": "Asia/Kuala_Lumpur", "q_cancellation_window": "24",
            "q_reviewer": {"id": "u-kl", "label": "KL Reviewer"}}
    GROUPS = [{"id": "g-front-desk", "name": "Front Desk"}, {"id": "g-ops", "name": "Operations"}]

    def apply(self, **answers):
        payload = automation(HP, "31677550")
        api = FakeApi(groups=self.GROUPS)
        ns = run_node(node(payload, "apply_setup")["code"], api, {"responses": dict(self.BASE, **answers), "todo_id": "t-setup"})
        saved = api.files_store.get("PracticeManager/Practices/kl-clinic.json")
        return ns["outcome"], (json.loads(saved) if saved else None), api

    def test_saves_time_zone_reviewer_and_group(self):
        outcome, saved, _ = self.apply(q_review_group="front desk")
        self.assertEqual(outcome, "practice_saved")
        self.assertEqual((saved["timezone"], saved["reviewer_id"], saved["review_group_id"]),
                         ("Asia/Kuala_Lumpur", "u-kl", "g-front-desk"))

    def test_group_is_optional(self):
        outcome, saved, _ = self.apply()
        self.assertEqual((outcome, saved["review_group_id"]), ("practice_saved", ""))

    def test_unknown_group_is_sent_back(self):
        outcome, saved, api = self.apply(q_review_group="Reception")
        self.assertEqual((outcome, saved), ("review_group_not_found", None))
        self.assertIn("Front Desk, Operations", api.calls_to("workq.comment")[0]["body"])
        self.assertEqual(api.calls_to("workq.complete"), [])

    def test_unknown_time_zone_is_sent_back(self):
        outcome, saved, api = self.apply(q_timezone="Kuala Lumpur")
        self.assertEqual((outcome, saved), ("timezone_not_found", None))
        self.assertIn("Asia/Kuala_Lumpur", api.calls_to("workq.comment")[0]["body"])

    def test_blank_time_zone_is_sydney(self):
        outcome, saved, _ = self.apply(q_timezone="")
        self.assertEqual((outcome, saved["timezone"]), ("practice_saved", "Australia/Sydney"))


if __name__ == "__main__":
    unittest.main()
