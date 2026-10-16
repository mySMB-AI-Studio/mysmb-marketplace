responses = params.get("responses") or {}
todo_id = params.get("todo_id") or ""
actor = params.get("actor") or ""
outcome = "ignored"


def _note(body, done=True):
    if not todo_id:
        return
    api.workq.comment(todo_id=todo_id, body=body)
    if done:
        api.workq.complete(todo_id=todo_id)


if not responses:
    # No answers: the Publish practice run sends a sample event with an empty payload.
    outcome = "ignored"
else:
    settings = bk_read_json(BK_SETTINGS) or {}
    name = str(bk_answer(responses, "q_client_name") or "").strip()
    slug = bk_slug(name)
    client = bk_client_for(settings, slug)
    if not client:
        outcome = "payroll_client_missing"
        _note("There are no bookkeeping settings for **" + (name or "this business") + "** yet. Run **Bookkeeping: Start setup** "
              "with its name, submit its Client bookkeeping settings form, then submit this form again.", done=False)
    else:
        source = str(bk_answer(responses, "q_timesheets") or "").lower()
        officer = bk_answer(responses, "q_officer")
        reviewer = bk_answer(responses, "q_reviewer")
        payroll = {
            "version": 1,
            "slug": slug,
            "name": client.get("name") or name,
            "calendar": str(bk_answer(responses, "q_calendar") or "").strip(),
            "prep_day": str(bk_answer(responses, "q_prep_day") or "Monday"),
            "prep_time": str(bk_answer(responses, "q_prep_time") or "").strip() or "09:00",
            "states": [s.strip().upper() for s in re.split(r"[,;/ ]+", str(bk_answer(responses, "q_states") or "")) if s.strip()],
            "timesheets": ("deputy" if source.startswith("deputy") else "xero" if "xero" in source
                           else "emailed" if source.startswith("emailed") else "none"),
            "ts_owner": str(bk_answer(responses, "q_ts_owner") or "").strip(),
            "ts_email": str(bk_answer(responses, "q_ts_email") or "").strip(),
            "chase_after_minutes": int(bk_money(bk_answer(responses, "q_chase_after")) or 60),
            "officer_id": bk_lookup_id(officer),
            "officer_name": bk_lookup_label(officer),
            "reviewer_id": bk_lookup_id(reviewer),
            "reviewer_name": bk_lookup_label(reviewer),
            "approvers": str(bk_answer(responses, "q_approvers") or "").strip(),
            "who_posts": "practice" if str(bk_answer(responses, "q_who_posts") or "").lower().startswith("our") else "client",
            "notes": str(bk_answer(responses, "q_notes") or "").strip(),
            "updated_by": actor,
            "updated_at": bk_now_iso(settings),
        }
        bk_write_json(BK_PAYROLL + "/" + slug + ".json", payroll)
        folder = BK_PAYROLL_FILES + "/" + slug
        guide = folder + "/pay-guide.xlsx"
        # Never overwrite a pay guide the officer has filled in.
        if not any(f.get("path") == guide for f in api.files.list(path=folder)):
            pay_guide_template(guide, payroll["name"])
        outcome = "payroll_saved"
        _note(
            "Saved payroll settings for **" + payroll["name"] + "** (pay calendar *" + payroll["calendar"] + "*, prepared on "
            + payroll["prep_day"] + "s from " + payroll["prep_time"] + ").\n\n**Next steps**\n\n"
            "1. Fill in the pay guide `" + guide + "` in Knowledge: the award rates by classification, employment type, age "
            "and band, the penalty rules, each employee's award and classification, special arrangements, public holidays "
            "and how your Xero pay items map to the bands. Replace the EXAMPLE rows.\n"
            "2. Drop each period's reimbursement file (a spreadsheet with *expense* or *reimburs* in its name) into `" + folder + "`.\n"
            "3. Publish *Start pay runs*, *Check pay run* (the Deputy version if the hours come from Deputy), *Build payroll "
            "review pack* and *Apply payroll review*. The pay run item opens on the preparation day."
        )
