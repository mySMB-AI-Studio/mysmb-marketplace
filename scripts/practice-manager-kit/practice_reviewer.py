# >>> practice-reviewer (canonical copy: scripts/practice-manager-kit/practice_reviewer.py; every copy must match it)
def practice_review_assignment(practice):
    # Who a practice's review items go to, from its settings file: the reviewer
    # ("reviewer_id") while they are still a workspace user, otherwise the
    # practice's WorkQ group ("review_group_id"). With neither, the item is left
    # unassigned (visible to the whole workspace) rather than sent to a guess.
    reviewer = str((practice or {}).get("reviewer_id") or "").strip()
    group = str((practice or {}).get("review_group_id") or "").strip()
    if reviewer:
        try:
            known = {str(u.get("id")) for u in (api.users.list() or []) if isinstance(u, dict)}
        except Exception:
            known = {reviewer}
        if reviewer in known:
            return {"assignee_ids": [reviewer], "assigned_group_ids": None}
    if group:
        return {"assignee_ids": None, "assigned_group_ids": [group]}
    return {"assignee_ids": None, "assigned_group_ids": None}
# <<< practice-reviewer
