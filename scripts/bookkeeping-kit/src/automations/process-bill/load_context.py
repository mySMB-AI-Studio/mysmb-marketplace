problem = ""
folder = params.get("folder") or ""
settings = bk_read_json(BK_SETTINGS)
client = bk_client_for(settings, folder) or bk_client_for(settings, bk_slug(folder))
rules = {"suppliers": {}}
if not settings:
    problem = "Bookkeeping isn't set up yet. Run **Bookkeeping: Start setup** and submit the Bookkeeping setup form."
elif not client:
    problem = ("There are no client settings for the folder `" + folder + "`. Run **Bookkeeping: Start setup** with this "
               "business's name, submit its settings form, and drop the bill into the folder it names.")
elif not client.get("xero_tenant_id"):
    problem = "The client settings for `" + folder + "` have no Xero organisation. Submit the client settings form again."
else:
    rules = bk_read_json(BK_RULES + "/" + client["slug"] + ".json", rules) or rules
ctx = {"settings": settings or {}, "client": client or {}, "rules": rules, "folder": folder}
