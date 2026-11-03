# Investment Reports

Turns the investment documents in SharePoint into reports for the family. It's read-only in SharePoint and Xero.

## What's included

### Connectors

- **m365-sharepoint** reads SharePoint and OneDrive folders and files by link, using `list_sharepoint_folder` and `read_sharepoint_file`. It reads Word, Excel, PowerPoint, PDF, text, CSV and HTML files. Older formats such as .doc and .xls are converted by Microsoft first.
- **xero-accounting** looks up bank receipts, using `list_bank_transactions`. Nothing is changed in Xero.
- **m365-mail-send** emails the one-page summary with the PDF attached, using `send_email`.

### Automation: One-page summary from SharePoint

"Investments: One-page summary from SharePoint" runs on Run now only.

1. It goes through one investment's folder and its subfolders. The subfolders are tax statements, dividend statements, investor updates, annual reports and correspondence.
2. It reads up to 50 documents. AI pulls out the facts each one states:
   - money invested
   - dividends paid
   - valuations
   - key terms
   - milestones
   - what the company does and why it was bought
3. It puts the facts together, counting each investment and each dividend once, and takes the latest valuation. AI writes a plain-English overview for family members.
4. It looks for bank receipts in Xero that name the company and compares them with the dividend statements by financial year. The result is noted on the report and in the email.
5. It draws a one-page PDF with:
   - invested capital, carrying value, dividends, MOIC and IRR
   - a value-created chart and dividends by financial year
   - key terms, milestones and the source documents (with links)
   - notes and important information
6. It saves the PDF to Knowledge as `Investments/Reports/<company> Investment Summary <dd-Mmm-yy>.pdf` and emails it to the "Email to" address.

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

- **Investment name:** use it when the link is to the folder that holds every investment. The subfolder whose name contains it is used.
- **Email to:** defaults to the address set in the automation. Separate several addresses with commas.
- **Name on the report:** defaults to Future Now.
- **Xero contact or reference to match:** use it when the dividends in Xero don't name the company, for example a share registry's name.

**Scopes:**

- The one-page summary needs `connectors:m365-sharepoint`, `connectors:xero-accounting`, `connectors:m365-mail-send`, `ai:generate`, `files:read` and `files:write`.
- The combined report needs `connectors:m365-sharepoint`, `ai:generate`, `files:read` and `files:write`.

## Limits

- **Documents read per run:** 50, taking the first 12,000 characters of each. The terms documents are read first, then dividend statements, annual reports, updates and tax statements. Anything past 50 is still counted in the source documents.
- **Scanned PDFs:** images of pages have no text, so they're counted but not read.
- **Email attachment:** the PDF has to be 3 MB or less. A one-page summary is well under that.
- **Figures:** they're taken from the documents as written, with the help of AI. The report says so. Check it against the source documents before sharing. It isn't financial advice.
