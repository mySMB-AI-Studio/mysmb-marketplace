# Practice manager kit: shared helpers and tests

Shared Python helpers and tests for two hand-written extensions in this repo: `plugins/cliniko-automations` (Cliniko Automations) and `plugins/healthcare-practice-management` (Healthcare Practice Management). Neither has a generator, so the automation JSON is edited directly. Only the helpers below are generated, copied in from this folder.

## Practice time and reviewer

Both extensions read each practice's settings from `PracticeManager/Practices/<slug>.json`, which **Apply practice setup** writes.

- **`timezone`** (IANA) is the practice's clock. Every schedule ticks in UTC (`*/15` or `*/30`). On each tick a node checks whether it is the practice's own time: `practice_open_now(practice, trigger, 7, 21)` for a window, `practice_due_at(practice, trigger, "07:30", [1, 2, 3, 4, 5])` for a once-a-day run. Ticks are 30 minutes apart, so a once-a-day run fires exactly once on each local day in any time zone, including ones with :30 or :45 offsets and across daylight saving changes. A manual or event run always goes ahead.
- **`reviewer_id`**, then **`review_group_id`**, decide who gets a Cliniko review item. `practice_review_assignment(practice)` returns the reviewer while they are still a workspace user, otherwise the practice's WorkQ group, otherwise nobody (the item stays unassigned and visible to the whole workspace).

## Layout

| Path | What |
|---|---|
| `practice_clock.py`, `practice_reviewer.py` | The canonical helpers. Each one is copied into every node that uses it, between `# >>> name` and `# <<< name` markers. |
| `kit.py`, `sync.py` | `python sync.py` rewrites every marked copy from the canonical file and refreshes each component's `contentHash`. |
| `check.mts` | Runs myHubV2's own schemas over both extensions: Flow IR shape and semantics, form schema and contentHash. It uses the copies in `../bookkeeping-kit/.myhub`. |
| `tests/` | `test_practice_clock.py` and `test_reviewer.py` test the helpers. `test_flows.py` runs the changed nodes against a fake workspace (`fakes.py`). `test_static.py` checks the copies, the triggers and that no reviewer is hard-coded. `test_code_safety.py` runs the platform's AST lint. |

## Commands

Run these from this folder after `npm ci` in `../bookkeeping-kit`, which supplies tsx, zod and pyright:

```bash
python sync.py                                   # after editing a canonical helper
python -m unittest discover -s tests             # the tests
../bookkeeping-kit/node_modules/.bin/tsx check.mts                       # platform schemas, semantics, contentHash
(cd ../bookkeeping-kit && npx tsx pycheck.mts ../.. cliniko-automations && npx tsx pycheck.mts ../.. healthcare-practice-management)  # pyright stage
cd ../.. && npx tsx scripts/validate.ts          # the repo gate
```

After hand-editing any automation or form JSON, run `python sync.py` so its `contentHash` is refreshed.

## What the tests don't prove

The fake workspace is not the Pyodide sandbox, and the fake connectors return nothing. On QA, confirm that:

- a scheduled run's `trigger` carries `kind: "schedule"` and `fired_at`. If it doesn't, the helpers fall back to the current time, which is still correct to within the tick.
- `api.groups.list` returns the groups that WorkQ shows.
- a WorkQ item created with only `assigned_group_ids` shows up in that group's queue.
