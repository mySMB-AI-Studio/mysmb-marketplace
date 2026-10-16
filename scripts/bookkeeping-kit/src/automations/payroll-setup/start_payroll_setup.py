actor = params.get("actor") or ""
assignees = [actor] if actor else None
created = []

for name in [n.strip() for n in re.split(r"[\n,;]+", params.get("payroll_names") or "") if n.strip()]:
    item = api.workq.create(
        title="Payroll settings for " + name,
        scope="org",
        description=(
            "Fill in the **Client payroll settings** form for **" + name + "**: its pay calendar in Xero Payroll, when we "
            "prepare the pay run, where the hours come from, who reviews and approves, and who posts the pay run.\n\n"
            "The business needs its bookkeeping settings first (run **Bookkeeping: Start setup** with its name)."
        ),
        priority="medium",
        assignee_ids=assignees,
        labels=["bookkeeping", "setup", "payroll", bk_slug(name)],
    )
    api.workq.attach_form(todo_id=item["id"], form_id=params["payroll_form"])
    created.append(item["id"])

created_count = len(created)
if created_count == 0:
    summary = "Nothing to do: no business names were given. Run again with the businesses to set up payroll for, one per line."
else:
    summary = "Created " + str(created_count) + " payroll settings item(s) in WorkQ."
