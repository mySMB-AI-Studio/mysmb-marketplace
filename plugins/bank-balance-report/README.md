# Bank Balance Report

One daily automation, two reports out of the Xero bank accounts: **where the money sits**, and **what moved it**. Between them they are the Bank Balance Change tile written up and sent out — the same figures, from the same tool. Both are read-only in Xero.

One run makes both. The balances are a one-page glance that most of a team can see; the transactions behind them are a finance document with real contacts and amounts on it. They go to the same people, as two emails, so each PDF can be forwarded on its own.

## What's included

### Connectors

- **xero-accounting** reads each bank account's balance today, its closing balance on the previous business day and the transactions in between, using `get_xero_bank_balance_difference`. Nothing is changed in Xero.
- **m365-mail-send** emails each report with its PDF attached, using `send_email`.

### Automation: Bank Balance Report: daily

"Bank Balance Report: daily" runs on **Run now** and on a schedule — 6:00 pm Sydney time, Monday to Friday, until someone changes it. It has four steps, and the balances go out before the AI step so that page is never held up by it.

1. **Read the balances from Xero.** For each bank account, today's balance against the closing balance on the previous business day (Friday when today is a Monday). These are the figures the Bank Balance Change tile shows, from the same tool, so the report and the tile can't disagree.
2. **Write the balance report and email it.** One page, as a PDF and as a web page:
   - a masthead over the reporting line ("2 accounts · today (Mon 02-Nov-26) vs Fri 30-Oct-26, last business day")
   - the total change across all the accounts, and beside it the total held — the one figure no row carries
   - one row per account: previous close with the day it closed, balance today, and the movement, with the day's money in and out underneath it. An account that didn't move says "no change" rather than showing a zero in colour.

   The web page goes to **Reports**, the PDF is filed in Knowledge as `Banking/Reports/<name> Bank Balances <dd-Mmm-yy>.pdf`, and it is emailed to the people picked. No AI is involved — there is no prose on the page, only figures Xero gave us.
3. **Explain what moved the balances.** AI reads the day's larger transactions and writes, for each account that moved, two or three sentences on what moved it — the handful behind most of the change and who they were with. It then picks up to four points worth a second look: a large or unusual payment, a duplicate-looking pair, bank fees, an account gone negative. It's told to leave that list empty rather than invent a concern, and never to restate a figure it wasn't given. It only sees the transactions the report lists, so it can't explain a movement with a payment the reader can't find on the page.
4. **Write the transaction detail and email it.** The report, as a PDF and as a web page:
   - the masthead, the total change and the headline sentence
   - one block per account: the account's change, its previous and current balances, the explanation, then the transactions **at or above the amount set** — account code with the account it was coded to, contact with the detail line, and the signed amount in red when money went out
   - one row counting everything below that amount, so the total still adds up, then the total and the line that proves the transactions match the difference
   - the points worth a look, and Xero's own footer line

   The web page goes to **Reports**, the PDF is filed in Knowledge as `Banking/Reports/<name> Bank Transaction Detail <dd-Mmm-yy>.pdf`, and it is emailed with a link to the report.

An account that moved on nothing that large still gets a line — "nothing at or above A$50,000, 8 smaller transactions, A$276.87 net out" — because "none today" is the answer to the question the report is asking, and silence isn't.

Reports lists HTML reports only, which is why the page that goes there is a web page rather than the PDF.

## Configuration

No environment variables are required.

**Connect** these connectors (OAuth):

- **xero-accounting:** sign in to the Xero organisation whose bank accounts you want reported. An automation runs on the workspace connection, which is not the personal connection a dashboard tile reads - if the two sit on different Xero organisations, these reports and the Bank Balance Change tile will disagree. Every report names the organisation it read, so check that line against the tile the first time it runs.
- **m365-mail-send:** asks for `Mail.Send`, which needs a Microsoft 365 admin to consent once for the organisation.

**Set it up:** publish the automation, then fill in its fields. Everything is optional, but read the first two before the schedule fires.

- **Xero organisation:** which organisation to report on. Part of the name is enough - `irvine` finds `Irvine Jackson Pty Ltd` - and a whole name always wins outright, so an organisation whose name sits inside a longer one is still reachable. Matching ignores case and surrounding spaces; if what you type matches none of the connected organisations, or more than one, the run stops and names what it found. An automation does not follow the organisation picker on your dashboard - with this blank it reads whichever organisation the connection happens to default to, which may not be the one your tiles show.
- **Send to group / Send to person / Other email addresses:** who gets the PDF. Pick a workspace group and everyone in it gets the report, and the list keeps up as people join and leave; pick one person on top of that; and type any addresses for people outside the workspace, separated by commas. All three are added together and each address is sent to once. **Set at least one before the schedule first fires** — they are blank by default, and with nobody picked the report is still saved to Reports and Knowledge but nothing is emailed. If someone picked has no email address on their profile, or the group can't be read, the report still goes to everyone else and the run says who was left off.
- **Smallest transaction to list** *(affects the transaction detail only)*: how big a transaction has to be to get a line of its own. A$50,000 by default. Size is what counts, not direction — at A$50,000 a payment of A$60,000 and a receipt of A$60,000 both appear. Everything smaller is counted on one line per account, so the totals still add up and nothing is hidden. Set it to 0 to list every transaction.
- **Name on the report:** shown at the top. Blank uses the Xero organisation's own name. Either way the report prints the Xero organisation the figures came from beneath the title, because this field is free text and can name any organisation.
- **Logo file:** a PNG or JPEG in Knowledge, for example `Automations/logo.png`, drawn at the top of the PDF and of the page in Reports in place of the name. The page carries the image inline, so it renders for anyone the report reaches without them needing rights to the file. Leave it blank for the name in text; if the file is missing the report still goes out with the name in text and says so in its summary.

**Changing when it runs:** open the automation, select its Schedule trigger and set Daily, Weekly or Monthly and a time. The time zone comes from the browser of whoever sets it.

**Scopes:**

- `connectors:xero-accounting`, `connectors:m365-mail-send`, `artifacts:write`, `files:read`, `files:write`, `users:read` and `groups:read`, plus `ai:generate` for the explanation in the transaction detail.

## Limits

- **Previous business day:** Friday when today is a Monday, and the day before otherwise. Public holidays aren't accounted for, so the Tuesday after a long weekend compares against the Monday, which has no transactions.
- **Bank fees and other late postings:** a transaction only appears once the bank feed has delivered it. A report run in the evening can miss a fee the bank posts overnight; it shows up on the next run instead, and the balance still reconciles because both sides move together.
- **Transactions printed per account:** 60 of those at or above the amount set. Beyond that the rest are counted on a line pointing to Xero, so one busy account can't run the report to pages.
- **Transactions sent to AI:** the 40 largest per account that the report lists, by size of the amount. The table is unaffected.
- **Email attachment:** the PDF has to be 3 MB or less. A day's report is well under that, and the logo is shrunk to keep it there.
- **Balances are Xero's:** they are the balance in Xero, which is not the same thing as the balance at the bank — anything entered in Xero but not yet through the feed, or sitting in the feed unreconciled, puts the two apart. The statement balance is only available through Xero's Finance API, which Xero opens to financial-services partners.
- **Figures:** they come straight from the Xero bank transactions and are quoted as Xero formats them. The wording around them is written with the help of AI — the report says so. It isn't financial advice.
