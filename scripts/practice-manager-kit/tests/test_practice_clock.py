import datetime
import unittest

from fakes import KIT

NS = {}
exec((KIT / "practice_clock.py").read_text(encoding="utf-8"), NS)  # noqa: S102
open_now, due_at, clock_now = NS["practice_open_now"], NS["practice_due_at"], NS["practice_clock_now"]

UTC = datetime.timezone.utc


def ticks(day, minutes=30):
    # Every scheduled tick of one UTC day, as the platform fires them.
    start = datetime.datetime.combine(day, datetime.time(0, 0), UTC)
    return [{"kind": "schedule", "fired_at": (start + datetime.timedelta(minutes=m)).strftime("%Y-%m-%dT%H:%M:%SZ")}
            for m in range(0, 24 * 60, minutes)]


def local_dates_due(tz, hhmm, first, days, weekdays=None):
    # Local date -> how many ticks were "the" run, across a window of UTC days.
    practice = {"timezone": tz}
    seen = {}
    for d in range(days):
        for t in ticks(first + datetime.timedelta(days=d)):
            if due_at(practice, t, hhmm, weekdays):
                local = clock_now(practice, t).date()
                seen[local] = seen.get(local, 0) + 1
    return seen


class DueAt(unittest.TestCase):
    def test_sydney_morning_brief_runs_at_its_own_0730(self):
        sydney = {"timezone": "Australia/Sydney"}  # AEDT, UTC+11 in November
        self.assertTrue(due_at(sydney, {"kind": "schedule", "fired_at": "2026-11-10T20:30:00Z"}, "07:30", [1, 2, 3, 4, 5]))
        self.assertFalse(due_at(sydney, {"kind": "schedule", "fired_at": "2026-11-10T20:00:00Z"}, "07:30", [1, 2, 3, 4, 5]))
        self.assertFalse(due_at(sydney, {"kind": "schedule", "fired_at": "2026-11-10T21:00:00Z"}, "07:30", [1, 2, 3, 4, 5]))

    def test_the_same_tick_is_a_different_hour_for_each_practice(self):
        tick = {"kind": "schedule", "fired_at": "2026-11-10T22:00:00Z"}  # 06:00 Kuala Lumpur, 09:00 Sydney
        self.assertTrue(due_at({"timezone": "Asia/Kuala_Lumpur"}, tick, "06:00"))
        self.assertFalse(due_at({"timezone": "Australia/Sydney"}, tick, "06:00"))

    def test_half_and_three_quarter_hour_offsets_still_run_once(self):
        self.assertTrue(due_at({"timezone": "Australia/Adelaide"}, {"kind": "schedule", "fired_at": "2026-11-10T21:00:00Z"}, "07:30"))
        # Kathmandu is UTC+5:45: ticks land on :15 and :45 local, so 07:00 runs at 07:15.
        kathmandu = {"timezone": "Asia/Kathmandu"}
        self.assertFalse(due_at(kathmandu, {"kind": "schedule", "fired_at": "2026-11-10T01:00:00Z"}, "07:00"))
        self.assertTrue(due_at(kathmandu, {"kind": "schedule", "fired_at": "2026-11-10T01:30:00Z"}, "07:00"))
        self.assertFalse(due_at(kathmandu, {"kind": "schedule", "fired_at": "2026-11-10T02:00:00Z"}, "07:00"))

    def test_exactly_one_run_per_local_day_across_zones_and_dst_changes(self):
        # 2026-04-05 Sydney leaves daylight saving, 2026-10-04 it starts; New York and London change too.
        for tz in ("Australia/Sydney", "Australia/Adelaide", "Australia/Perth", "Pacific/Auckland",
                   "Asia/Kuala_Lumpur", "Asia/Kathmandu", "Europe/London", "America/New_York"):
            for first in (datetime.date(2026, 3, 25), datetime.date(2026, 9, 25), datetime.date(2026, 10, 20)):
                for hhmm in ("06:00", "07:00", "07:30", "15:00", "17:00"):
                    seen = local_dates_due(tz, hhmm, first, 20)
                    inner = {d: n for d, n in seen.items() if first + datetime.timedelta(days=1) < d < first + datetime.timedelta(days=19)}
                    self.assertEqual(len(inner), 17, (tz, first, hhmm))
                    self.assertEqual(set(inner.values()), {1}, (tz, first, hhmm))

    def test_weekdays_are_the_practices_own_weekdays(self):
        # 2026-11-13T20:30Z is Saturday 07:30 in Sydney but still Friday in UTC.
        sydney = {"timezone": "Australia/Sydney"}
        self.assertFalse(due_at(sydney, {"kind": "schedule", "fired_at": "2026-11-13T20:30:00Z"}, "07:30", [1, 2, 3, 4, 5]))
        self.assertTrue(due_at(sydney, {"kind": "schedule", "fired_at": "2026-11-12T20:30:00Z"}, "07:30", [1, 2, 3, 4, 5]))

    def test_manual_and_event_runs_always_go_ahead(self):
        for trig in ({}, {"kind": "manual"}, {"kind": "event"}, None):
            self.assertTrue(due_at({"timezone": "Australia/Sydney"}, trig, "07:30", [1]))
            self.assertTrue(open_now({"timezone": "Australia/Sydney"}, trig, 7, 21))


class OpenNow(unittest.TestCase):
    def test_window_is_seven_to_nine_local_for_each_practice(self):
        for tz in ("Asia/Kuala_Lumpur", "Australia/Sydney", "Asia/Kathmandu", "Europe/London"):
            practice = {"timezone": tz}
            hits = [t for t in ticks(datetime.date(2026, 11, 10), 15) if open_now(practice, t, 7, 21)]
            self.assertEqual(len(hits), 14 * 4, tz)
            hours = {clock_now(practice, t).hour for t in hits}
            self.assertEqual(hours, set(range(7, 21)), tz)


class ZoneFallbacks(unittest.TestCase):
    def test_blank_zone_is_sydney_and_a_bad_one_is_utc(self):
        tick = {"kind": "schedule", "fired_at": "2026-11-10T20:30:00Z"}
        self.assertEqual(clock_now({}, tick).hour, 7)
        self.assertEqual(clock_now({"timezone": "Not/AZone"}, tick).hour, 20)

    def test_without_a_fire_time_it_uses_now(self):
        self.assertIsNotNone(clock_now({"timezone": "Asia/Kuala_Lumpur"}, {"kind": "schedule"}).tzinfo)


if __name__ == "__main__":
    unittest.main()
