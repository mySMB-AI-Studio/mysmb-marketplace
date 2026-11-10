import unittest

from fakes import KIT, FakeApi


def assignment(practice, api):
    ns = {"api": api}
    exec((KIT / "practice_reviewer.py").read_text(encoding="utf-8"), ns)  # noqa: S102
    return ns["practice_review_assignment"](practice)


USERS = [{"id": "u-1", "email": "reviewer@clinic.example"}, {"id": "u-2", "email": "other@clinic.example"}]


class ReviewAssignment(unittest.TestCase):
    def test_reviewer_from_the_settings_file(self):
        got = assignment({"reviewer_id": "u-2", "review_group_id": "g-1"}, FakeApi(users=USERS))
        self.assertEqual(got, {"assignee_ids": ["u-2"], "assigned_group_ids": None})

    def test_group_when_the_reviewer_is_no_longer_a_user(self):
        got = assignment({"reviewer_id": "u-gone", "review_group_id": "g-1"}, FakeApi(users=USERS))
        self.assertEqual(got, {"assignee_ids": None, "assigned_group_ids": ["g-1"]})

    def test_group_when_no_reviewer_is_set(self):
        got = assignment({"reviewer_id": "", "review_group_id": "g-1"}, FakeApi(users=USERS))
        self.assertEqual(got, {"assignee_ids": None, "assigned_group_ids": ["g-1"]})

    def test_unassigned_with_neither(self):
        for practice in ({}, {"reviewer_id": "u-gone"}, None):
            self.assertEqual(assignment(practice, FakeApi(users=USERS)), {"assignee_ids": None, "assigned_group_ids": None})

    def test_trusts_the_reviewer_when_users_cannot_be_read(self):
        api = FakeApi(users=USERS)
        api.handlers["users.list"] = lambda **_: (_ for _ in ()).throw(RuntimeError("users:read denied"))
        self.assertEqual(assignment({"reviewer_id": "u-9"}, api), {"assignee_ids": ["u-9"], "assigned_group_ids": None})


if __name__ == "__main__":
    unittest.main()
