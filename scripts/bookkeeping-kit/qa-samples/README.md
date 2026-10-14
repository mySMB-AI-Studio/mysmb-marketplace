# Bookkeeping for Xero: QA run

Sample bills for the first live test on the QA workspace. They are text PDFs (the AI can read them) with valid ABNs, dated 29/09/2026.

| File | Supplier | Total | Tests |
|---|---|---|---|
| `01-PowerDirect-PD-20931.pdf` | PowerDirect (a Xero Demo Company supplier) | $464.25 | Known supplier, coding from history, approve with changes + remember |
| `02-Harbourside-Plumbing-HP-0457.pdf` | Harbourside Plumbing Services (new) | $493.90 | New supplier, over the client-approval limit, second organisation |
| `03-Office-Supplies-Co-OS-88120.pdf` | Office Supplies Co (new) | $451.77 | Reject → draft deleted in Xero |
| `04-scanned-no-text.pdf` | none | none | Exception: no readable text |

Do everything as the same person, the one who owns the automations (the automation owner). The automations call Xero with the owner's login.

## 0. Before you start
- [ ] Integrations → Xero Accounting: connect, and on Xero's consent screen tick **at least two organisations** (for example the Demo Company plus one more). These are client A and client B below.

## 1. Setup
- [ ] Publish the 4 forms: Bookkeeping setup, Client bookkeeping settings, Bill review, Client bill approval.
- [ ] Publish **Bookkeeping: Start setup** and **Bookkeeping: Apply setup (Xero)**.
- [ ] Run **Start setup** with the two organisation names, one per line.
  **Check:** WorkQ has 3 items (Bookkeeping setup + 2 client settings), each with its form.
- [ ] Submit **Bookkeeping setup**:
  - How you use the workspace: practice
  - Reviewer: yourself
  - After review: *awaiting approval* (SUBMITTED)
  - Skip review below: `0`
  - Client approval above: `480`
  **Check:** `Bookkeeping/settings.json` is in Knowledge and the item has a comment.
- [ ] Submit each **Client bookkeeping settings** item:
  - The Xero organisation name exactly as Xero shows it
  - GST: yes
  - Contact: your own name and email (nothing is sent; emails are only drafted)
  **Check:**
  - `Bookkeeping/Clients/<client>.json` has a `xero_tenant_id`.
  - `Bookkeeping Inbox/<client>/_README.txt` exists.
  - The item comment names the matched organisation. If it says the organisation wasn't found, it lists the ones it can see; resubmit with one of those.

## 2. Bills
- [ ] Publish **Bookkeeping: Process bill (Xero)** and **Bookkeeping: Apply bill review (Xero)**.
- [ ] Upload `01` to `Bookkeeping Inbox/<client A>/`.
  **Check:**
  - A draft bill appears in **client A's** Xero with the PDF attached.
  - WorkQ has a review item with the Bill review form.
  - The PDF has moved to `Bookkeeping Processed/<client A>/`.
- [ ] Upload `02` to `Bookkeeping Inbox/<client B>/`.
  **Check:** the draft is in **client B's** Xero, not A's, and the new supplier is flagged on the item.
- [ ] Upload `03` to client A's inbox. **Check:** a draft plus a review item, as for `01`.
- [ ] Upload `04` to client A's inbox.
  **Check:** an exception item ("no readable text") and the PDF in `Bookkeeping Failed/<client A>/`.
- [ ] Upload `01` to client A's inbox again.
  **Check:** an exception for a duplicate bill, with no second draft in Xero.

## 3. Reviews
- [ ] On PowerDirect, choose **Approve with changes**, enter `line 1 account 445` (any expense account), and answer *Remember* = yes.
  **Check:**
  - The Xero bill is *Awaiting Approval* with line 1 on that account.
  - `Bookkeeping/Rules/<client A>.json` has the rule.
- [ ] On Harbourside, choose **Approve**.
  **Check:** because it's over $480, a client-approval item with a draft email appears. Submit it as *They approved it*, then check the bill is *Awaiting Approval* in client B's Xero.
- [ ] On Office Supplies, choose **Reject**.
  **Check:** the draft is gone from client A's Xero.

## 4. Digest and agent
- [ ] Publish and run **AP digest** manually. **Check:** an "AP digest" artifact covering both clients, and a notification.
- [ ] Ask **Bookkeeping Coordinator (Xero)**:
  - "What's waiting for <client B>?"
  - "Why was PD-20931 coded like that?"

## If something fails
Send the automation run (the failing step's error), the WorkQ item and its comments, and a screenshot of Xero. Fixes go into the kit and out as a new PR.
