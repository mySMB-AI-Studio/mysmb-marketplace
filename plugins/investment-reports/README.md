# Investment Reports

Turns the investment summaries in a SharePoint folder into one combined report on how all the investments look.

## What's included

**Connector:** `m365-sharepoint` reads SharePoint and OneDrive folders and files by link. It is read-only and has two tools:

- `list_sharepoint_folder`
- `read_sharepoint_file`

It can read Word, Excel, PowerPoint, PDF, text, CSV and HTML files. Older formats such as .doc and .xls are converted by Microsoft first.

**Automation:** "Investments: Combined report from SharePoint" (Run now only).

1. It lists the files directly in the folder you give it, up to 40 per run, and reads each one's text.
2. AI pulls out each portfolio's figures as the summary states them:
   - entity, provider and valuation date
   - opening and closing value
   - contributions, income, franking credits and fees
   - realised and unrealised gains, and return
   - asset allocation, largest holdings and follow-ups
3. It adds the portfolios up and has AI write a short overview with points to watch and actions.
4. It saves the report to Knowledge in `Investments/Reports/` as both `Combined Investment Report <dd-Mmm-yy>.docx` and `.md`.

The report lists the source files, and any files it skipped with the reason. The automation never changes anything in SharePoint.

## Configuration

No environment variables are required.

**Connect:** the connector uses OAuth. Click Connect on **m365-sharepoint** and sign in with your Microsoft 365 account. It asks for delegated `Files.Read.All` and `Sites.Read.All`, which a user can consent to. You only see what you can already open in SharePoint.

**Run:** publish the automation, click **Run now** and paste the folder's link. To get the link, open the folder in SharePoint and use Share → Copy link. The browser address also works.

**Scopes** the automation needs: `connectors:m365-sharepoint`, `ai:generate`, `files:read` and `files:write`.

## Limits

- **Scanned PDFs:** images of pages have no text, so they're skipped and listed under "Not included".
- **Files per run:** 40. For each file, the first 24,000 characters are read.
- **Subfolders:** they aren't opened. Put the summaries directly in the folder.
- **Figures:** they're taken from each summary as written. Check the report against the source files before relying on it. It isn't financial advice.
