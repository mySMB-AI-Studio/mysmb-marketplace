settings = bk_read_json(BK_SETTINGS)
actor = params.get("actor") or ""
assignees = [actor] if actor else None
created = []

if not settings:
    item = api.workq.create(
        title="Set up Bookkeeping for Xero",
        scope="org",
        description=(
            "Fill in the **Bookkeeping setup** form attached to this item. It tells the bookkeeping "
            "automations who reviews bills, who handles exceptions and when a bill needs the client's approval.\n\n"
            "When it's saved, this item gets a checklist of the next steps."
        ),
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
        description=(
            "Fill in the **Client bookkeeping settings** form for **" + name + "**: its Xero organisation, "
            "who reviews its bills and when the business owner must approve a bill.\n\n"
            "When it's saved, bills for this business can be dropped into the `" + BK_INBOX + "/" + bk_slug(name)
            + "` folder in Knowledge."
        ),
        priority="medium",
        assignee_ids=assignees,
        labels=["bookkeeping", "setup", bk_slug(name)],
    )
    api.workq.attach_form(todo_id=item["id"], form_id=params["client_form"])
    created.append(item["id"])

created_count = len(created)
if created_count == 0:
    summary = "Nothing to do: Bookkeeping is already set up and no client names were given. Run again with client names to add businesses."
else:
    summary = "Created " + str(created_count) + " setup item(s) in WorkQ."
