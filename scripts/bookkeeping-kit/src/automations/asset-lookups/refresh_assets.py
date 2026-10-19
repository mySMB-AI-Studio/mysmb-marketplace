import time

started = time.monotonic()
# Stay well inside the 20-minute run limit; the next run carries on with whatever is left.
BUDGET_SECONDS = 13 * 60
ASSETS_SERVER = "xero-assets"
settings = bk_read_json(BK_SETTINGS)
wanted = bk_slug(params.get("client_name")) if params.get("client_name") else ""
summary = {"clients": [], "left": 0, "errors": []}
problem = ""


def _assets_call(tool, tenant_id, **args):
    # A Xero Assets read for the client's own organisation (the fixed asset register isn't in the accounting API).
    args["xero_tenant_id"] = tenant_id
    return api.connectors.invoke(server=ASSETS_SERVER, tool=tool, args=args)


def _assets_items(result):
    # The Xero Assets API returns {"pagination": …, "items": [...]} for assets and a plain list for asset types.
    if isinstance(result, dict):
        return result.get("items") or result.get("Items") or []
    return result if isinstance(result, list) else []


if not settings:
    problem = "Bookkeeping isn't set up yet. Run **Bookkeeping: Start setup** and submit the Bookkeeping setup form."
else:
    today = bk_today(settings)
    for f in api.files.list(path=BK_CLIENTS):
        client = bk_read_json(f["path"]) if str(f.get("name") or "").endswith(".json") else None
        if not client or not client.get("xero_tenant_id") or client.get("checks_enabled", True) is False:
            continue
        slug = client.get("slug") or ""
        if wanted and wanted != slug and wanted != bk_slug(client.get("name")):
            continue
        if time.monotonic() - started > BUDGET_SECONDS:
            summary["left"] += 1
            continue
        tenant = client["xero_tenant_id"]
        exc = None
        try:
            # Draft assets (CHK-139), and the fixed asset accounts the asset types use (CHK-140).
            drafts = _assets_items(_assets_call("list_assets", tenant, status="Draft", pageSize=500))
            types = _assets_items(_assets_call("list_asset_types", tenant))
            cache = {"refreshed": str(today),
                     "draft": [{"id": str(a.get("assetId") or ""), "name": str(a.get("assetName") or "(no name)"),
                                "number": str(a.get("assetNumber") or ""), "price": bk_money(a.get("purchasePrice")) or 0.0,
                                "date": str(a.get("purchaseDate") or "")[:10], "link": ""}
                               for a in drafts if a.get("assetId")],
                     "type_accounts": sorted({str(t.get("fixedAssetAccountId")) for t in types if t.get("fixedAssetAccountId")})}
            bk_write_json(BK_CHECKS + "/" + slug + "-assets.json", cache)
            summary["clients"].append({"client": client.get("name"), "draft": len(cache["draft"]),
                                       "asset_types": len(types)})
        except Exception as exc:
            summary["errors"].append(str(client.get("name")) + ": " + str(exc)[:300])
    if not summary["clients"] and not summary["errors"]:
        problem = ("No client with ledger checks turned on" + (" matches \"" + str(params.get("client_name") or "") + "\"" if wanted else "")
                   + ". Fixed asset checks run for the clients set up in Bookkeeping with ledger checks on.")
