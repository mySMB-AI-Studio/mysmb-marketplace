# Payroll: QA run

Use a Xero organisation with **Xero Payroll AU** (the Demo Company (AU) has employees, pay calendars and timesheets) and, for the Deputy version, a Deputy account whose employees have the same names as in Xero.

## Setup (as the automations' owner)
1. **Connect** Xero Payroll AU (the *Xero Payroll AU* extension), and Deputy if you're testing that version.
2. **Publish** the four payroll forms (Client payroll settings, Pay run, Payroll review, Client payroll approval) and the payroll automations:
   - *Start pay runs*;
   - **one** *Check pay run* (the Deputy version only if the hours come from Deputy);
   - *Build payroll review pack*;
   - *Apply payroll review*.

   Republish *Start setup* and *Apply setup* too.
3. **Run *Start setup*** with the client under *Client businesses to set up payroll for*. Fill in **Client payroll settings**, using the pay calendar's name exactly as Xero Payroll shows it.
4. **Fill in the pay guide** at `Bookkeeping Payroll/<client>/pay-guide.xlsx`:
   - add the rates for the employees' award and classification;
   - put each employee in the `employees` sheet;
   - map the Xero earnings rates to bands in `pay_items`.

## Run it
1. **Run *Start pay runs* by hand** with the client's name. The pay run item opens straight away (on the schedule it waits for the preparation day).
2. **On the Pay run form, choose *Run the checks*.** Check the report and the comment against what you'd find by hand:
   - missing starters;
   - salaried staff with timesheets;
   - hour differences;
   - penalty bands;
   - rates;
   - changes;
   - reimbursements.
3. **Create the draft pay run in Xero Payroll.** Then choose *Ready for review*. The reviewer gets the pack.
4. **Approve on the Payroll review form.** The client approval item gets a drafted email; record *They approved it*.

## What to look for
- **Nothing in Xero Payroll changes.** Every correction is listed for the officer.
- **The first check after setup** usually lists missing pay guide rows (*no rate in the pay guide…*) and employees not in the `employees` sheet. Fill those in and run it again.
- **With the first client's real data (kept outside the repo)**, replay the last two pay runs. The check should catch what the payroll officer caught, including the public holiday rate miss.
