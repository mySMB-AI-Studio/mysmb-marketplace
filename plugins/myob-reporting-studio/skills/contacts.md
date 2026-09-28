---
name: MYOB Contacts
description: Generate a MYOB Contacts report — customer and supplier directory with type, status, and contact details.
---

# Contacts (Prompt ID M12 — Reporting › Reports › Business › Contacts)

Use `list_contacts` (`type: "All"` unless the reader narrows it, `page_size: 1000`) for the directory. `list_contacts` returns a single page only: if exactly 1000 contacts come back, show a visible "directory may be truncated at 1000" warning. Per the foundation skill's discovery rule, inspect the rows returned by the generation-turn `list_contacts` call (or call `get_contact` once on a real contact UID) to confirm exactly where email/phone live before writing render code — do not assume an `Addresses: [{Email, Phone1}]` shape. Render defensively (`contact?.Addresses?.[0]?.Email ?? "N/A"` style) so a shape mismatch degrades to "N/A" rather than a broken page.

Show one row per contact: `CompanyName` (or the individual's first/last name when there is no company name), `Type` (Customer/Supplier), `IsActive`, plus whatever email/phone fields the live check confirms. Group by `Type` with a count per group.

**Optional open-balance column:** if useful, cross-reference each contact's open balance via `list_invoices` (`status: "Open"`) for customers and `list_bills` (`status: "Open"`) for suppliers, summing `BalanceDueAmount` client-side by `Customer.UID`/`Supplier.UID` — this is two calls total (one per contact type), not one per contact, so it stays cheap regardless of directory size. Disclose this in Sources & limitations if included.

No numeric tie-out is meaningful for a directory listing — skip the Validation section's equations, but still confirm the displayed contact count matches `list_contacts`' returned row count. That check compares against what was returned, so it must not Fail just because of paging: when exactly 1000 rows came back, show it as "N/A — may be truncated" with the warning above, not Fail.

## Interactivity

* Declare `persona` and `company_file` per the foundation skill.
* Declare a `type` enum input (Customer/Supplier/All) mapped 1:1 to `list_contacts`' `type` param.
* Name search: filter client-side over the fetched rows by default (this also matches individuals). `list_contacts`' own `name` param is a "company name starts with" search (`startswith(CompanyName, …)`), so individuals without a company name never match it — use it only for directories over 1000, as a second binding called with `getData` once the reader types a name, and say so beside the search box.
* Client-side sort by name within each type group.

## Sources & limitations

Tools used: `list_contacts` (`/Contact`, one page of up to 1000); optionally `list_invoices`/`list_bills` for open balances. No new connector work needed. Email/phone field paths confirmed live at generation time (see discovery note above) rather than assumed.
