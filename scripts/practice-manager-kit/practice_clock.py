# >>> practice-clock (canonical copy: scripts/practice-manager-kit/practice_clock.py; every copy must match it)
# Scheduled runs fire on a UTC clock; each practice decides from its own settings
# file ("timezone") whether this run is one of its own. Manual and event runs
# always count, so a person can still run an automation by hand at any time.
import datetime as _pm_datetime
from zoneinfo import ZoneInfo as _PmZoneInfo

PRACTICE_DEFAULT_TIMEZONE = "Australia/Sydney"
PRACTICE_SLOT_MINUTES = 30


def practice_clock_tz(practice):
    name = str((practice or {}).get("timezone") or "").strip() or PRACTICE_DEFAULT_TIMEZONE
    try:
        return _PmZoneInfo(name)
    except Exception:
        return _pm_datetime.timezone.utc


def practice_clock_now(practice, trig=None):
    # The run's scheduled time (not when the sandbox got to it), in the practice's time zone.
    fired = None
    if isinstance(trig, dict) and trig.get("fired_at"):
        try:
            fired = _pm_datetime.datetime.fromisoformat(str(trig.get("fired_at")).replace("Z", "+00:00"))
        except Exception:
            fired = None
    if fired is None or fired.tzinfo is None:
        fired = _pm_datetime.datetime.now(_pm_datetime.timezone.utc)
    return fired.astimezone(practice_clock_tz(practice))


def practice_open_now(practice, trig, start_hour, end_hour, weekdays=None):
    # True when a scheduled run falls inside [start_hour, end_hour) practice time
    # (weekdays: ISO numbers, 1 = Monday).
    if not (isinstance(trig, dict) and trig.get("kind") == "schedule"):
        return True
    local = practice_clock_now(practice, trig)
    if weekdays and local.isoweekday() not in weekdays:
        return False
    return start_hour <= local.hour < end_hour


def practice_due_at(practice, trig, hhmm, weekdays=None):
    # True for the one scheduled run that is the practice's own HH:MM run: the
    # first tick at or after HH:MM practice time (ticks are 30 minutes apart, so
    # a time zone with a :45 offset runs 15 minutes late rather than never).
    if not (isinstance(trig, dict) and trig.get("kind") == "schedule"):
        return True
    local = practice_clock_now(practice, trig)
    if weekdays and local.isoweekday() not in weekdays:
        return False
    hour, minute = (int(x) for x in str(hhmm).split(":"))
    target = hour * 60 + minute
    return target <= local.hour * 60 + local.minute < target + PRACTICE_SLOT_MINUTES
# <<< practice-clock
