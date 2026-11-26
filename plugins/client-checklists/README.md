# Client Checklists

Give every client its own copy of your master checklists: monthly bookkeeping, quarterly BAS, year-end and onboarding. Change, add or remove tasks for one client without touching the master, and keep a record of why any task was dropped.

## What's in the box

- **Custom tables:**
  - *Client checklists*: one row per client per master checklist (an Activity template), with who it's assigned to, the approver, and how often it repeats.
  - *Client checklist tasks*: the client's copy, one row per task.
- **Automations:**
  - *Client checklists: Attach or sync*: run it with a client and a master to attach a checklist. It also runs every night at 1:30am (Sydney) to sync every client's copy with its master.
  - *Client checklists: Removal approvals*: raises and closes approvals when a required task is removed.

## How it works

1. **Masters are your own Activity templates.** Make one per checklist in Templates. Tag a step `required`, or put `[required]` in its title or description, if it can't be skipped without approval (for example "Lodge the BAS" or "Reconcile the bank").
2. **Attach a master to a client.** Run *Client checklists: Attach or sync* and choose the client, the master, how often it repeats, who it's assigned to and the approver. Every step of the master becomes a task on the client's copy, with the status **Kept**.
3. **Tailor the copy in Records › Client checklist tasks:**
   - **Change a task:** fill in *Task name for this client*, *Due* or *Assign to*, and set the status to **Changed for this client**.
   - **Add a task for this client only:** create a task linked to the client checklist, with the status **Added for this client**.
   - **Remove an optional task:** set the status to **Removed** and give a reason.
   - **Remove a required task:** set the status to **Removal requested** and give a reason. The approver gets a WorkQ item and a notification. They approve by moving the task to **Removed**, or decline by moving it back to **Kept**. A required task moved straight to Removed by anyone but the approver goes back to Removal requested.
   - Every status change is kept in the task's history (who and when). The reason is on the task.
4. **When a master changes**, the nightly sync updates every client's copy:
   - a new **required** step is added as Kept;
   - a new optional step arrives as **New in master** for review;
   - a step the master drops becomes **Retired in master**;
   - renamed steps update *Task in the master*.

   Tasks a person removed, or asked to remove, are never changed by the sync.

**Not in this version:** creating each period's WorkQ items automatically (next release), tasks that close themselves from ledger checks, and a variance view.

## Limits

- Automations can't link a WorkQ item to a client record yet, so approval items name the client in their title.
- The approver is a person on the client checklist; if it's empty, the practice manager set on *Removal approvals* approves. With neither set, anyone can approve.
- Masters made in an extension are overwritten when that extension updates. Use your own Activity templates as masters.

## Configuration

No configuration variables are required. After installing:

1. Review and publish the two custom tables during extension setup.
2. Publish both automations (they install as drafts).
3. On *Removal approvals*, set **Practice manager**.
