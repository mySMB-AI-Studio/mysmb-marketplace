# Investment Reports

Turns the investment documents in SharePoint into reports for the family. It's read-only in SharePoint and Xero.

## What's included

### Connectors

- **m365-sharepoint** reads SharePoint and OneDrive folders and files by link, using `list_sharepoint_folder` and `read_sharepoint_file`. It reads Word, Excel, PowerPoint, PDF, text, CSV and HTML files. Older formats such as .doc and .xls are converted by Microsoft first.
- **xero-accounting** looks up bank receipts, using `list_bank_transactions`. Nothing is changed in Xero.
- **m365-mail-send** emails the one-page summary with the PDF attached, using `send_email`.

### Automation: One-page summary from SharePoint

"Investments: One-page summary from SharePoint" runs on Run now only.

1. It goes through one investment's folder and its subfolders, up to eight levels down, so folders that sit inside a wrapper folder are still reached. Documents are grouped by their own file name first and the folders above them second: capital calls, valuations (capital account and wealth statements), dividend and distribution statements, tax statements, annual reports, investor updates (including quarterly reports), terms and deeds (applications, subscriptions, trust deeds), due diligence and correspondence.
2. It reads up to 50 documents. The investment can be shares in a company or an interest in a fund, trust or limited partnership. AI pulls out the facts each one states:
   - money invested, including capital calls and drawdowns
   - dividends paid
   - valuations, capital account balances and net asset values
   - key terms
   - milestones
   - what the company does and why it was bought
3. It puts the facts together, counting each investment and each dividend once, and takes the latest valuation. Only the holder's own money is counted: amounts that belong to the whole fund or company — total fund size, net assets, the investments the fund itself made, unit prices — are left out, and so is every amount in an investor update, a quarterly report or a due diligence paper. Those documents still provide the story: the business and why the investment was made. When a capital account or wealth statement is there, its stated contributions, distributions and closing value settle the totals, with the capital calls supplying the dates the money moved. AI writes a plain-English overview for family members.
4. It looks for bank receipts in Xero that name the company and compares them with the dividend statements by financial year. The result is noted on the report and in the email.
5. It draws the one page twice - as a PDF and as a web page - laid out as the Option A tear sheet the family marked up:
   - a masthead over the reporting date, prepared date, investor entity and currency
   - key terms down the left: investor entity, investment into, asset type, asset, shares held, ownership, commitment and unfunded commitment, first investment, holding period, tax status, liquidity, currency and website - each row appears only when the documents state it
   - on the right, an executive summary paragraph, then invested capital, distributions, carrying value, total value, net gain, MOIC and IRR, then the business, the investment and why it was bought
   - a value-created chart and a total returns chart beneath
   - important information, the confidentiality notice, and the reference number in the page footer
6. It puts the web page in **Reports**, visible to everyone in the workspace, files the PDF in Knowledge as `Investments/Reports/<company> Investment Summary <dd-Mmm-yy>.pdf`, and emails that PDF to the "Email to" address. The email carries the attachment and a link to the report. Reports lists HTML reports only, which is why the page that goes there is a web page rather than the PDF.

### Automation: Combined report from SharePoint

"Investments: Combined report from SharePoint" runs on Run now only.

1. It reads the portfolio summaries directly in a folder (up to 40) and pulls out each portfolio's figures.
2. It adds them up and has AI write an overview with points to watch and actions.
3. It saves the report to Knowledge in `Investments/Reports/` as `Combined Investment Report <dd-Mmm-yy>.docx` and `.md`.

## Configuration

No environment variables are required.

**Connect** these connectors (OAuth):

- **m365-sharepoint:** asks for delegated `Files.Read.All` and `Sites.Read.All`. You only see what you can already open in SharePoint.
- **xero-accounting:** sign in to the Xero organisation the dividends are paid into. The one-page summary uses this connector.
- **m365-mail-send:** asks for `Mail.Send`, which needs a Microsoft 365 admin to consent once for the organisation. The one-page summary uses this connector.

**Run the one-page summary:** publish the automation, click **Run now** and paste the investment folder's link (open the folder in SharePoint, then Share → Copy link). These fields are optional:

- **Investment name:** use it when the link is to the folder that holds every investment. The folder whose name contains it is used, wherever it sits below the link, so you can paste the top folder and type "Fund 1". If nothing matches, the run stops and lists the folders that are there rather than reading them all as one investment. You can leave it blank when the link goes straight to one investment's own folder; if the link turns out to sit above several, the run stops and names them, because one report can only cover one investment.
- **Email to:** defaults to the address set in the automation. Separate several addresses with commas.
- **Name on the report:** defaults to Future Now.
- **Xero contact or reference to match:** use it when the dividends in Xero don't name the company, for example a share registry's name.

**Scopes:**

- The one-page summary needs `connectors:m365-sharepoint`, `connectors:xero-accounting`, `connectors:m365-mail-send`, `ai:generate`, `artifacts:write`, `files:read` and `files:write`.
- The combined report needs `connectors:m365-sharepoint`, `ai:generate`, `files:read` and `files:write`.

## Limits

- **Documents read per run:** 50, taking the first 12,000 characters of each. Terms and deeds are read first, then capital calls, valuations, dividend statements, annual reports, investor updates, tax statements, due diligence and correspondence. Anything past 50 is still counted in the source documents.
- **Scanned PDFs:** images of pages have no text, so they're counted but not read.
- **Email attachment:** the PDF has to be 3 MB or less. A one-page summary is well under that.
- **Source documents on the report:** the seven largest groups are listed; the rest are counted under Other documents so the summary stays on one page.
- **Figures:** they're taken from the documents as written, with the help of AI. The report says so. Check it against the source documents before sharing. It isn't financial advice.
