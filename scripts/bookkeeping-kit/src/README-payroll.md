# Bookkeeping Payroll for Xero

Pay runs for bookkeeping practices that run payroll for their clients in **Xero Payroll AU**. On each client's preparation day the pay run item opens in WorkQ. When the payroll officer asks, the pay run is checked against Deputy (or Xero) timesheets and the client's own pay guide; then the internal review pack is built and the client approval email is drafted. It reads only: nothing in Xero Payroll changes without the payroll officer.

It works alongside **Bookkeeping for Xero**, which holds the practice and client settings (`Bookkeeping/settings.json`, `Bookkeeping/Clients/<client>.json`). Install and set that up first.

> Generated from `scripts/bookkeeping-kit` in this repo (gen-ext.js). Change the kit source and regenerate; don't hand-edit these files.

## What's in the box

- **Connectors:** `xero-payroll-au` (Xero Payroll AU). *Check pay run (Xero Payroll + Deputy)* also uses `deputy` (Deputy extension).
- **Automations (7):**
  - *Bookkeeping: Start payroll setup* (run by hand): one Client payroll settings item per business you list.
  - *Bookkeeping: Apply payroll settings*: saves the Client payroll settings answers and creates the client's pay guide template.
  - *Bookkeeping: Start pay runs (Xero Payroll)*: hourly on weekdays. Opens each client's pay run item on its preparation day, says when the timesheets are in Xero, and drafts a chase when Deputy timesheets are late.
  - *Bookkeeping: Check pay run (Xero Payroll + Deputy)* or *(Xero Payroll)*: publish one. Runs from the pay run item's form and lists:
    - Deputy vs Xero hours per employee per day;
    - missing starters;
    - salaried staff with timesheets;
    - penalty bands (early, late, Saturday, Sunday, public holiday, overtime) worked out from shift times;
    - rates against the client's pay guide;
    - this period's changes (junior birthdays, special arrangements ending, 1 July);
    - reimbursements against the draft pay run.

    Then it posts a report and one drafted query email.
  - *Bookkeeping: Build payroll review pack (Xero Payroll)*: the draft pay run's totals and payslips, the last check, the changes and the notes, sent to the internal reviewer.
  - *Bookkeeping: Apply payroll review*: internal approval → client approval item with a drafted email → done (or "post it" when the practice posts).
- **Forms (4):** Client payroll settings, Pay run, Payroll review, Client payroll approval.
- **Skill (1):** `bookkeeping-xero-payroll`.

## Configuration

No configuration variables are required. Settings are collected by the Client payroll settings form and stored in Knowledge (`Bookkeeping/Payroll/<client>.json`). Needs **Bookkeeping for Xero** set up first, for the practice and client settings.

## After installing

1. **Connect Xero Payroll AU** (and Deputy, for clients whose hours come from Deputy) as the person who will own the automations.
2. **Publish the four forms** in Forms (they install as drafts).
3. **Publish** *Start payroll setup* and *Apply payroll settings*, then run **Bookkeeping: Start payroll setup** with the businesses to set up, one per line. Each needs its bookkeeping settings first.
4. **Publish** *Start pay runs*, *Check pay run* (the Deputy version if the hours come from Deputy), *Build payroll review pack* and *Apply payroll review*.

A workspace that had these automations and forms from Bookkeeping for Xero keeps them: they're the same components, now shipped by this extension.

## How a pay run flows

1. **Settings:** run *Start payroll setup* with the business. Fill in its **Client payroll settings**:
   - the pay calendar's name in Xero Payroll;
   - the preparation day and time;
   - where the hours come from;
   - the timesheet owner;
   - the payroll officer and the internal reviewer;
   - the client approvers;
   - who posts.

   A pay guide template appears in `Bookkeeping Payroll/<client>/pay-guide.xlsx`.
2. **Pay guide:** fill in its sheets and replace the EXAMPLE rows. The guide is the client's own rate sheet, from the Fair Work pay guides:
   - `rates`: award, classification, employment type, age range, band, rate and effective date;
   - `employees`: each employee's award, classification, state and any special arrangement with its end date;
   - `rules`: when the day starts and ends, and the daily overtime threshold and first-hours band;
   - `holidays`: public holidays by state;
   - `pay_items`: which band each Xero earnings rate pays.
3. **Pay run item:** opens on the preparation day, in the week of the pay day. When the timesheets are in Xero Payroll it says so; if Deputy timesheets are late it drafts a chase.
4. **Check:** choose *Run the checks* on the Pay run form, fix what the report lists in Xero Payroll, and run it again. Drop the period's reimbursement spreadsheet (*expense* or *reimburs* in the name) into `Bookkeeping Payroll/<client>/` first.
5. **Review pack:** choose *Ready for review* once the draft pay run is in Xero. The internal reviewer gets the pack and the **Payroll review** form.
6. **Client approval:** an approved review creates the client approval item with a drafted email. Record the answer on the **Client payroll approval** form. If the client posts the pay run, the pay run item completes; if the practice posts it, the item stays open until you post and file STP.

## Limits

- Payroll checks read Xero Payroll AU and Deputy only; the officer makes every correction. Deputy is one connection per client business. Penalty rules beyond the day start/end, weekends, public holidays and a daily overtime threshold are not modelled yet.
- Every email is a draft: a person sends it.
