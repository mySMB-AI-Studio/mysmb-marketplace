# Investment Reports

Turns the investment documents in SharePoint into reports for the family: an investment register filled in from every entity and investment in the fund area, a one-page summary of a single investment, and a combined report across portfolio summaries. It is read-only in SharePoint and Xero.

## What's included

### Connectors

- **m365-sharepoint** reads SharePoint and OneDrive folders and files by link, using `list_sharepoint_folder` and `read_sharepoint_file`. It reads Word, Excel, PowerPoint, PDF, text, CSV and HTML files. Older formats such as .doc and .xls are converted by Microsoft first.
- **xero-accounting** looks up bank receipts, using `list_bank_transactions`. Nothing is changed in Xero.
- **m365-mail-send** emails the one-page summary with the PDF attached, using `send_email`.
- **m365-sharepoint-write** saves the finished investment register into SharePoint as a new file, using `read_sharepoint_file_bytes` and `write_sharepoint_file`. This is the only connector here that writes anything, and only the register automation uses it. It adds files; it does not change the spreadsheet it built from.

### Automation: One-page summary from SharePoint

"Investments: One-page summary from SharePoint" runs on Run now only.

1. It goes through one investment's folder and its subfolders, up to eight levels down, so folders that sit inside a wrapper folder are still reached. Documents are grouped by their own file name first and the folders above them second: capital calls, valuations (capital account and wealth statements), dividend and distribution statements, tax statements, annual reports, investor updates (including quarterly reports), terms and deeds (applications, subscriptions, trust deeds), due diligence and correspondence.
2. It reads up to 50 documents. The investment can be shares in a company or an interest in a fund, trust or limited partnership. AI pulls out the facts each one states:
   - money invested, including capital calls and drawdowns - counted only from capital call notices and signed subscription documents, never from correspondence that merely describes a call. Each of those documents is asked one dedicated question about the money it moves, the same way every run, so the instalments behind the IRR do not change from one run to the next. A refund, repayment or return of an overpayment is money coming back, and is never counted as an instalment. Where a capital call's file name states the amount and the day it falls - "1 - 2020 11 09 $72,280.60.pdf" - the name settles both and the document is not read for them, because a name reads the same on every run. A name giving only the month is taken as that month's first day
   - dividends paid
   - valuations, capital account balances and net asset values
   - key terms
   - milestones
   - what the company does and why it was bought
3. It puts the facts together, counting each investment and each dividend once, and takes the latest valuation. Only the holder's own money is counted: amounts that belong to the whole fund or company — total fund size, net assets, the investments the fund itself made, unit prices — are left out, and so is every amount in an investor update, a quarterly report or a due diligence paper. Those documents still provide the story: the business and why the investment was made. When a capital account or wealth statement is there, its stated contributions, distributions and closing value settle the totals, with the capital calls supplying the dates the money moved. AI writes a plain-English overview for family members.
4. It looks for bank receipts in Xero that name the company and compares them with the dividend statements by financial year. The result is noted on the report and in the email.
5. **Optionally, it reads a reference sheet.** Give it the link to an Excel file in SharePoint and what the sheet states is used instead of what AI read from the documents: one row per investment, with the columns Folder, Heading, Investor entity, Investment into, Asset type, Asset, Sector, Commitment, Unfunded commitment, First investment, Term, Holding period, Tax status, Liquidity, Currency, Website, Executive summary, General, The business, The investment and Notes. Blank cells change nothing. Commitment, unfunded commitment, first investment, holding period and currency are printed exactly as the sheet writes them; the amounts the report works out itself (invested capital, distributions, value, MOIC, IRR) are never taken from the sheet. Folder, Heading, Term, General and Notes exist only in the sheet. The row whose Folder column names the investment's own folder is the one used. Failing that, one row is used as it stands, and with several the row whose Investment into or Asset names this investment is used; if none does, the sheet is left out and the run says so. Word matching cannot tell "Fund 1" from "Fund 2", so give every row a Folder once there is more than one.
6. It draws the one page twice - as a PDF and as a web page - laid out as the Option A tear sheet the family marked up:
   - a masthead over the reporting date, prepared date, investor entity and currency
   - key terms down the left: investor entity, investment into, asset type, asset, shares held, ownership, commitment and unfunded commitment, first investment, term, holding period, tax status, liquidity, currency, website and general - each row appears only when the documents or the reference sheet state it. A row runs to as many lines as its value needs. Where they will not all fit, the space between rows closes up first and only then does the longest row give a line back, so a row of two words never loses one to make room for a clause.
   - on the right, an executive summary paragraph, then invested capital, distributions, carrying value, total value, net gain, MOIC and IRR, then the business, the investment, why it was bought and any notes
   - a value-created chart and a total returns chart beneath
   - important information, the confidentiality notice, and the reference number in the page footer
7. It puts the web page in **Reports**, visible to everyone in the workspace, files the PDF in Knowledge as `Investments/Reports/<company> Investment Summary <dd-Mmm-yy>.pdf`, and emails that PDF to the "Email to" address. The email carries the attachment and a link to the report. Reports lists HTML reports only, which is why the page that goes there is a web page rather than the PDF.

### Automation: Combined report from SharePoint

"Investments: Combined report from SharePoint" runs on Run now only.

1. It reads the portfolio summaries directly in a folder (up to 40) and pulls out each portfolio's figures.
2. It adds them up and has AI write an overview with points to watch and actions.
3. It saves the report to Knowledge in `Investments/Reports/` as `Combined Investment Report <dd-Mmm-yy>.docx` and `.md`.

### Automation: Build the investment register from SharePoint

"Investments: Build the investment register from SharePoint" runs on Run now only.

1. It opens the folder link and looks three levels down for investment folders: the ones that state an amount in their name, such as `2024 09 Capital Investments - Head Co $527K`, or that hold drawers such as Capital Calls, Reports and Tax. Whichever folder sits directly below the link is the investor entity, so a link to the whole fund area gives every entity and a link to one entity's folder gives just that one.
2. For each investment it reads the six documents most likely to carry the register's columns — terms and deeds first, then valuations, payments, tax statements and updates — and asks AI **three** questions about the lot: what was bought, the terms, then the descriptions. A scanned PDF has no text in it and cannot be known to have none until it is opened, so one that comes back empty is passed over and the next document is read in its place, up to fourteen attempts. Six documents means six with something in them, not six opened. Three questions per investment, not three per document, so a folder of 227 files costs the same as a folder of 8.

   They are asked apart because an AI step has 1500 output tokens for its whole answer, and whatever the model spends working out loud comes out of the same 1500. One question covering all fifteen columns never got as far as writing anything. Two got the figures out but never once finished the descriptions. The budget is per question, so three smaller questions have more of it between them than one large one has on its own. Each is asked over only the documents it needs, and each caps how long its answers may run — the descriptions are capped at 35 words a column, because left open, the notes column alone ran past the budget and took the other two down with it.

   **The terms question is not given documents from the top.** Term, tax status and liquidity are settled in clauses, and a placement memorandum spends its first several thousand characters on a cover page and a not-an-offer notice. So deeds, agreements and memoranda are read to 150,000 characters, and that question is handed the passages that actually talk about terms — how long it runs, how the money comes back out, what it is for tax, what is still uncalled — each with 700 characters either side so it reads as a sentence. A 203,000-character memorandum comes down to seven passages and about 14,000 characters, which carries `Term Five years from end of the Investment Period`, `VCLP` and `no public market for Fund Interests` into an ask that stays well under the 32,000-character cap. When nothing matches, that question falls back to reading from the top like the others.

   When a folder holds no deed, agreement or memorandum at all — subscription forms and capital calls only — Term and Liquidity cannot be filled in from anything, and **Gaps and queries** says so rather than leaving two silent blanks.

   A question that cannot be finished is asked once more over fewer documents, answered shorter. If that fails too it costs only its own columns: the descriptions failing leaves every figure intact, the terms failing leaves the commitment and the first investment date, which come from the names rather than from AI. The **Gaps and queries** sheet names which question went and what is missing because of it, and the step's summary counts the answers that landed out of the ones attempted.
3. Folder and file names settle what they can state. The commitment comes from the amount in the folder name (`$400K`, `$1M`, `$527,000`), and the first investment date from a payment file that names both a day and an amount. Those cells read the same on every run, whatever AI says.
4. It opens the spreadsheet you pointed it at **in SharePoint**, fills in a row for each investment, adds any register column it does not have yet, and rewrites the **Gaps and queries** sheet behind it. Everything else in the workbook — other sheets, formulas, formatting — comes through untouched, because the file is edited from the bytes that are there rather than rebuilt from nothing. All of that is then saved as a **new file beside the original**, named `<name> <dd-Mmm-yy>.xlsx`. A copy also goes to Knowledge under `Investments/Reports/` and the register goes to Reports as a web page.

The **Spreadsheet to build from** box takes the link to that spreadsheet. **It is never written to.** Each run leaves it exactly as it was and saves its own dated file beside it, so the same spreadsheet can be run again and again without being put back first — useful while the folders are still being tidied up, when a run may be repeated several times a day. A name already in the folder is not replaced: a second run on the same day writes `<name> <dd-Mmm-yy> (2).xlsx`, a third `(3)`, so a result someone is still looking at survives the next run.

Every cell filled in by hand in that spreadsheet is carried into the new file exactly as it is, and only the empty ones are written, so a tax status or a term someone has decided on is never overwritten by what AI reads. Rows are matched on the investor entity and the folder name together, which matters once two entities hold an investment with the same folder name; a register that has no `Folder` column yet is matched on the investment name instead, so the first run finds the rows already there rather than writing over them. Because the source is never changed, a decision typed into a dated output does not carry to the next run — type it into the spreadsheet the runs build from, and every run after it will keep it.

The Gaps and queries sheet raises: folders with no valuation document, so no carrying value, MOIC or IRR; folders with no deed, agreement or memorandum, so no term and no liquidity; folder names with no year and month, or no amount; payments filed in a folder whose investment is smaller than the payment; empty drawers; documents that could not be read; AI questions that could not be finished, and which columns each one cost; and the same folder name used under more than one entity.

The register's `Folder` column is what the one-page summary's **Reference sheet** box matches on, so this register can be handed straight back to that automation as its reference sheet.

## Configuration

No environment variables are required.

**Connect** these connectors (OAuth):

- **m365-sharepoint:** asks for delegated `Files.Read.All` and `Sites.Read.All`. You only see what you can already open in SharePoint.
- **xero-accounting:** sign in to the Xero organisation the dividends are paid into. The one-page summary uses this connector.
- **m365-mail-send:** asks for `Mail.Send`, which needs a Microsoft 365 admin to consent once for the organisation. The one-page summary uses this connector.

**Run the one-page summary:** publish the automation, click **Run now** and paste the investment folder's link (open the folder in SharePoint, then Share → Copy link). These fields are optional:

- **Investment name:** use it when the link is to the folder that holds every investment. The folder whose name contains it is used, wherever it sits below the link, so you can paste the top folder and type "Fund 1". If nothing matches, the run stops and lists the folders that are there rather than reading them all as one investment. You can leave it blank when the link goes straight to one investment's own folder; if the link turns out to sit above several, the run stops and names them, because one report can only cover one investment.
- **Reference sheet:** the link to the Excel file described in step 5 (open it in SharePoint, then Share → Copy link). Leave it blank to take everything from the documents. If the file can't be opened, or has no row that matches, the report still goes out from the documents and the summary says why.
- **Email to:** defaults to the address set in the automation. Separate several addresses with commas.
- **Name on the report:** defaults to Future Now.
- **Logo file:** a PNG or JPEG in Knowledge, `Automations/logo.png` by default, drawn at the top of the PDF
  and of the page in Reports, beside the name rather than in place of it. The page carries the image inline, so it renders for
  anyone the report reaches without them needing rights to the file. Leave it blank for the name in text;
  if the file is missing the report still goes out with the name in text and says so in its summary.
- **Xero contact or reference to match:** use it when the dividends in Xero don't name the company, for example a share registry's name.

**Scopes:**

- The one-page summary needs `connectors:m365-sharepoint`, `connectors:xero-accounting`, `connectors:m365-mail-send`, `ai:generate`, `artifacts:write`, `files:read` and `files:write`.
- The combined report needs `connectors:m365-sharepoint`, `ai:generate`, `files:read` and `files:write`.

## Limits

- **Documents read per run:** 50, taking the first 12,000 characters of each. Terms and deeds are read first, then capital calls, valuations, dividend statements, annual reports, investor updates, tax statements, due diligence and correspondence. Anything past 50 is still counted in the source documents.
- **Scanned PDFs:** images of pages have no text, so they're counted but not read.
- **Documents AI can't read:** each one is asked for three times, each ask smaller than the last - everything, then the figures alone, then the document's date and the money it moves. Anything that fails all three is counted but left out, and the report says how many on the page.
- **Email attachment:** the PDF has to be 3 MB or less. A one-page summary is well under that.
- **Source documents on the report:** the seven largest groups are listed; the rest are counted under Other documents so the summary stays on one page.
- **Figures:** they're taken from the documents as written, with the help of AI. The report says so. Check it against the source documents before sharing. It isn't financial advice.
