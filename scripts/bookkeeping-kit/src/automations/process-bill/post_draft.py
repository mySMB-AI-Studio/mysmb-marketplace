problem = params.get("problem") or ""
ctx = params.get("ctx") or {}
proposal = params.get("proposal") or {}
bill_id = ""
attach_error = ""
contact_id = (proposal.get("contact") or {}).get("id")
# A bill addressed to another business waits for "Which client is this for?": nothing goes to Xero before that.
if not problem and not (params.get("blocking") or []) and contact_id and not params.get("needs_client"):
    tenant = (ctx.get("client") or {}).get("xero_tenant_id")
    try:
        bill_id = xero_create_bill(tenant, proposal, "DRAFT")
    except Exception as exc:
        problem = "Xero didn't accept the draft bill: " + str(exc)[:400]
    if bill_id:
        attach_error = xero_attach_pdf(tenant, bill_id, params["path"])
