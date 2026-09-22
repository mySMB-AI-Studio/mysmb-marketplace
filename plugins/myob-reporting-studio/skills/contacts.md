# Contacts (Prompt ID M12 — Reporting › Reports › Business › Contacts)

Use `list_contacts` (`type: "All"` unless the reader narrows it) for the directory. Per the foundation skill's discovery rule, call `get_contact` once during generation against a real contact UID to confirm exactly where email/phone live in the READ response before writing render code — do not assume the `Addresses: [{Email, Phone1}]` shape from `create_contact`'s write schema applies identically to reads; MYOB's read and write shapes are not guaranteed to match. Render defensively (`contact?.Addresses?.[0]?.Email ?? "N/A"` style) so a shape mismatch degrades to "N/A" rather than a broken page.

Show one row per contact: `CompanyName`, `Type` (Customer/Supplier), `IsActive`, plus whatever email/phone fields the live check confirms. Group by `Type` with a count per group.

**Optional open-balance column:** if useful, cross-reference each contact's open balance via `list_invoices` (`status: "Open"`) for customers and `list_bills` (`status: "Open"`) for suppliers, aggregated client-side by `Customer.UID`/`Supplier.UID` — this is two calls total (one per contact type), not one per contact, so it stays cheap regardless of directory size. Disclose this in Sources & limitations if included.

No numeric tie-out is meaningful for a directory listing — skip the Validation section's equations, but still confirm the displayed contact count matches `list_contacts`' returned count.

## Interactivity

* Declare `persona` per the foundation skill.
* Declare a `type` enum input (Customer/Supplier/All) mapped 1:1 to `list_contacts`' `type` param.
* Declare a `name` text input mapped to `list_contacts`' partial-name search for reader-side filtering without a full client-side re-scan on large directories.
* Client-side sort by name within each type group.

## Sources & limitations

Tools used: `list_contacts` (`/Contact`); optionally `list_invoices`/`list_bills` for open balances. No new connector work needed. Email/phone field paths confirmed live at generation time (see discovery note above) rather than assumed from the write schema.
