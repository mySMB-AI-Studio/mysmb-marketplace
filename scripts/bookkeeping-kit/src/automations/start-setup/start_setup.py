settings = bk_read_json(BK_SETTINGS)
actor = params.get("actor") or ""
assignees = [actor] if actor else None
created = []
# The setup lives in Knowledge (Bookkeeping/settings.json), so it survives removing and installing the extension
# again; "Set up again" sends the form anyway, and submitting it replaces the saved setup.
again = str(params.get("setup_again") or "").strip().lower().startswith("y")


def _saved_line(s):
    """What the saved setup says, for the person deciding whether to replace it."""
    when = str(s.get("updated_at") or "")[:10]
    return ("reviewer " + str(s.get("reviewer_name") or "not set") + ", reviewed bills go to Xero as "
            + ("Approved" if s.get("approved_status") == "AUTHORISED" else "Awaiting approval")
            + (", saved on " + when if when else ""))


if not settings or again:
    item = api.workq.create(
        title="Set up Bookkeeping for Xero" + (" (again)" if settings else ""),
        scope="org",
        description=bk_card(
            "fill in the **Bookkeeping setup** form on this item. When it's saved, this item gets a checklist of the "
            "next steps.",
            [("What it sets", "who reviews bills, who handles exceptions, when a bill needs the client's approval, "
                              "and which mailbox and folders Email intake reads"),
             ("Saved setup", ("it's replaced when you submit the form (now: " + _saved_line(settings) + "); client "
                              "settings are kept") if settings else "")]),
        priority="high",
        assignee_ids=assignees,
        labels=["bookkeeping", "setup"],
    )
    api.workq.attach_form(todo_id=item["id"], form_id=params["setup_form"])
    created.append(item["id"])

names = [n.strip() for n in re.split(r"[\n,;]+", params.get("client_names") or "") if n.strip()]
for name in names:
    item = api.workq.create(
        title="Bookkeeping settings for " + name,
        scope="org",
        description=bk_card(
            "fill in the **Client bookkeeping settings** form for **" + name + "** on this item. Enter its Xero "
            "organisation name exactly as it appears in Xero.",
            [("What it sets", "its Xero organisation, who reviews its bills and when the business owner must "
                              "approve a bill"),
             ("Then", "bills for " + name + " can be dropped into `" + BK_INBOX + "/" + bk_slug(name) + "` in "
                      "Knowledge, and Email intake files them there")]),
        priority="medium",
        assignee_ids=assignees,
        labels=["bookkeeping", "setup", bk_slug(name)],
    )
    api.workq.attach_form(todo_id=item["id"], form_id=params["client_form"])
    created.append(item["id"])

# >>> payroll
for name in [n.strip() for n in re.split(r"[\n,;]+", params.get("payroll_names") or "") if n.strip()]:
    item = api.workq.create(
        title="Payroll settings for " + name,
        scope="org",
        description=(
            "Fill in the **Client payroll settings** form for **" + name + "**: its pay calendar in Xero Payroll, when we "
            "prepare the pay run, where the hours come from, who reviews and approves, and who posts the pay run.\n\n"
            "The business needs its bookkeeping settings first (Run **Bookkeeping: Start setup** with its name)."
        ),
        priority="medium",
        assignee_ids=assignees,
        labels=["bookkeeping", "setup", "payroll", bk_slug(name)],
    )
    api.workq.attach_form(todo_id=item["id"], form_id=params["payroll_form"])
    created.append(item["id"])

# <<< payroll
created_count = len(created)
if created_count == 0:
    summary = ("Nothing to do: Bookkeeping is already set up (" + _saved_line(settings or {}) + ") and no client names "
               "were given. To change the setup, run this again with Set up again: Yes (the saved setup stays in "
               "Knowledge even when the extension is removed and installed again). To add businesses, run it with "
               "their names.")
else:
    summary = "Created " + str(created_count) + " setup item(s) in WorkQ."
