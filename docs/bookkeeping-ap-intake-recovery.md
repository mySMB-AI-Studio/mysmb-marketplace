# Bookkeeping AP intake checkpoints

Each Xero organisation or mailbox folder keeps its existing cursor and recent
item IDs in `bookkeeping-ap/*-intake-state.json`. Before processing a new item,
the intake saves an additional `hold` with the item ID, timestamp and reason.
Only after the item finishes does it clear that hold and save the successful
checkpoint. Other state keys and prior cursor history are retained.

A failed create, partial multi-bill message, uncertain response, worker crash or
failed success-checkpoint write leaves the saved hold in place. Subsequent
scheduled runs refuse to process that held scope and report `Intake held`.
They do not automatically retry or advance beyond it. Other folders or Xero
organisations retain their own checkpoints.

Before a person clears a hold, reconcile the saved item against AP bill rows:
email message/attachment IDs, invoice number and client/Xero organisation, or
the Xero bill ID. A multi-document message may already have created some rows;
an uncertain response may have created a row despite reporting an error.
Preserve those rows and the original state snapshot. Decide explicitly how to
finish any missing documents before removing only that hold. Do not reset the
cursor/recent history or replay a whole mailbox as a generic repair.

No recovery or historical ingestion is automatic. A release must pause old
intake versions before opening built-in client reads, upgrade the package,
review/publish the corrected installed drafts, then resume only after reviewing
the saved state. Updating the platform image alone does not replace published
Python, and updating the package alone creates pending automation drafts.

Synthetic tests cover all four intake variants, failed creates, partial email
success, failed checkpoint writes, repeated held runs, and normal completion.
