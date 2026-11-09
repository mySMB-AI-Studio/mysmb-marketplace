# Bank Balance Report

Emails a daily report on how the Xero bank balances moved. It's the Bank Balance Change tile, written up and sent out: the same figures, the same transactions, with a plain-English explanation of what moved each balance. It's read-only in Xero.

## What's included

### Connectors

- **xero-accounting** reads each bank account's balance today, its closing balance on the previous business day and the transactions in between, using `get_xero_bank_balance_difference`. Nothing is changed in Xero.
- **m365-mail-send** emails the report with the PDF attached, using `send_email`.

### Automation: Bank Balance Change: daily report

"Bank Balance Change: daily report" runs on **Run now** and on a schedule — 6:00 pm Sydney time, Monday to Friday.

1. It reads the bank balance change from Xero: for each bank account, today's balance against the closing balance on the previous business day (Friday when today is a Monday), and every authorised bank transaction and payment dated in between. These are the figures the Bank Balance Change tile shows, from the same tool, so the report and the tile can't disagree.
2. AI reads the day's transactions and writes, for each account that moved, two or three sentences on what moved it — the handful of transactions behind most of the change and who they were with. It then picks up to four points worth a second look: a large or unusual payment, a duplicate-looking pair, bank fees, an account gone negative. It's told to leave that list empty rather than invent a concern, and never to restate a figure it wasn't given.
3. It draws the report twice — as a PDF and as a web page:
   - a masthead over the reporting line ("2 accounts · today (Mon 02-Nov-26) vs Fri 30-Oct-26, last business day")
   - the total change across all the accounts
   - the headline sentence
   - one block per account: the account's change, its previous and current balances, the explanation, then the transaction table in the tile's columns — account code with the account it was coded to, contact with the detail line, and the signed amount in red when money went out — a total row, and the line that proves the transactions add up to the difference
   - the points worth a look
   - the footer line from Xero ("From Xero bank transactions · updated 4:26 PM")
4. It puts the web page in **Reports**, visible to everyone in the workspace, files the PDF in Knowledge as `Banking/Reports/<name> Bank Balance Change <dd-Mmm-yy>.pdf`, and emails that PDF to the "Email to" address with a link to the report. Reports lists HTML reports only, which is why the page that goes there is a web page rather than the PDF.

An account that didn't move gets one line saying so rather than an empty table.

## Configuration

No environment variables are required.

**Connect** these connectors (OAuth):

- **xero-accounting:** sign in to the Xero organisation whose bank accounts you want reported. An automation runs on the workspace connection, which is not the personal connection a dashboard tile reads - if the two sit on different Xero organisations, this report and the Bank Balance Change tile will disagree. Every report names the organisation it read, so check that line against the tile the first time it runs.
- **m365-mail-send:** asks for `Mail.Send`, which needs a Microsoft 365 admin to consent once for the organisation.

**Set it up:** publish the automation, then fill in its fields. All four are optional, but read the first two before the schedule fires:

- **Xero organisation:** which organisation to report on, by name, for example `Irvine Jackson Pty Ltd`. An automation does not follow the organisation picker on your dashboard - with this blank it reads whichever organisation the connection happens to default to, which may not be the one your tiles show. If the name is not one of the connected organisations the run stops and lists the ones that are, rather than quietly reporting on the wrong books.

- **Email to:** who gets the PDF. Separate several addresses with commas. **Set this before the schedule first fires** — it's blank by default, and with no address the report is still saved to Reports and Knowledge but nothing is emailed.
- **Name on the report:** shown at the top. Blank uses the Xero organisation's own name. Either way the report prints the Xero organisation the figures came from beneath the title, because this field is free text and can name any organisation.
- **Logo file:** a PNG or JPEG in Knowledge, for example `Automations/logo.png`, drawn at the top of the PDF and of the page in Reports in place of the name. The page carries the image inline, so it renders for anyone the report reaches without them needing rights to the file. Leave it blank for the name in text; if the file is missing the report still goes out with the name in text and says so in its summary.

**Scopes:** `connectors:xero-accounting`, `connectors:m365-mail-send`, `ai:generate`, `artifacts:write`, `files:read` and `files:write`.

## Limits

- **Previous business day:** Friday when today is a Monday, and the day before otherwise. Public holidays aren't accounted for, so the Tuesday after a long weekend compares against the Monday, which has no transactions.
- **Transactions printed per account:** 60. Beyond that the rest are counted on a line pointing to Xero, so one busy account can't run the report to pages.
- **Transactions sent to AI:** the 40 largest per account, by size of the amount. The table on the report is unaffected — it still prints all of them, up to the limit above.
- **Email attachment:** the PDF has to be 3 MB or less. A day's report is well under that, and the logo is shrunk to keep it there.
- **Figures:** they come straight from the Xero bank transactions and are quoted as Xero formats them. The wording around them is written with the help of AI — the report says so. It isn't financial advice.
