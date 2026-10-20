settings = bk_read_json(BK_SETTINGS)
where, _key, file_word, _name = bk_ledger_info(params.get("ledger"))
actor = params.get("actor") or ""
assignees = [actor] if actor else None
created = []

# Bookkeeping for Xero's setup counts too: the checks only need who follows up their findings, and the client form asks that.
if not settings:
    item = api.workq.create(
        title="Set up Bookkeeping checks for " + where,
        scope="org",
        description=(
            "Fill in the **Bookkeeping checks setup** form attached to this item. It tells the overnight ledger checks "
            "who follows up their findings.\n\nWhen it's saved, this item gets the next steps."
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
        title="Checks settings for " + name,
        scope="org",
        description=(
            "Fill in the **Client checks settings (" + where + ")** form for **" + name + "**: its " + file_word
            + ", whether it's registered for GST, and who follows up its findings.\n\n"
            "When it's saved, the overnight ledger checks start on it."
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
