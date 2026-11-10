# Social Media Agent

A business agent for a small business's marketing. It plans campaigns and drafts social media posts, articles, emails, announcements and simple visuals in the business's own voice, from a confirmed Brand Kit. Every draft is reviewed by a named person before it is used, saved in a Knowledge folder for its content type, and booked into WorkQ for its publish date.

**Draft-only.** The agent never posts, publishes, schedules or sends anything. The business copies approved content and posts it themselves. It never invents prices, dates, offers or claims (missing facts are shown as `[[MISSING: ...]]`) and never writes testimonials.

## How to use it

The agent works with three kinds of record (under **Records**):

| Record | What it is | When you use it |
|---|---|---|
| **Brand Kit** | One per business: what you do, who you serve, how you sound, key messages, default call to action, words to avoid, claims you can't make, colours | Once, at the start. Creating it starts a check; you confirm it, and every draft uses the confirmed copy. Edit it and confirm again whenever your brand changes. |
| **Campaign** | A time-bound push: what you're promoting, when, for whom, on which channels | When you want several pieces around one goal. You describe it, the agent plans it, you approve the plan, and it creates the pieces. |
| **Content piece** | One post, article, email, announcement or visual, with its publish date | For every piece of content. Each one is drafted, checked and reviewed on its own. |

**1. Set up the Brand Kit.** Records > Brand Kits > New, fill it in and save. Confirm it when the agent asks (Agents > Social Media Agent > Needs your attention).

**2. Ask for one piece.** Records > Content pieces > New: give it a title, content type, channels, publish date and a topic or brief (Origin: One-off request). Within a couple of minutes the agent drafts it, runs the brand and compliance checks (posted on the job's WorkQ item) and asks you to **Approve**, **Request changes** (type what to change and it redrafts) or **Skip**. An approved draft is saved as Word and Markdown in `Social posts/<content type>/`, and the job waits for the publish date, when you get a "Post it today" task. Nothing is posted for you.

**3. Plan a campaign.** Ask from **mySidekick** ("plan a social media campaign for...") or from the agent's page (Start a process > **Plan a campaign**), and describe it in a sentence or two. The agent proposes the pieces, dates and angles; approve it or ask for changes. Approving creates the campaign and its content pieces, and each piece is drafted and reviewed as in step 2. Ask for "plan my month" to get a month of posts around your key messages. If the team will write a piece itself, say so and it goes on the calendar without a draft.

**4. Reuse an approved piece.** Create a content piece with **Origin: Repurposed**, the new content type (for example Email) and the approved piece's **exact title in Topic**. The agent rewrites it for the new format with the same facts.

**5. Visuals.** A content piece of type **Visual** is drafted as a headline, subhead and call to action. When you approve it, branded images (square, story and banner) are saved next to the draft in your Brand Kit's colours. Add your logo by hand.

**Every week.** On Mondays you get a "Publishing this week" WorkQ item listing what's due and what still needs review, and the agent suggests campaigns 3 to 6 weeks ahead of Australian occasions ("Seasonal idea: ..."). Close a suggestion you don't want.

**It learns from your changes.** Every time you choose **Request changes**, your note is saved to `Social posts/Brand Kit/reviewer-notes.md` (newest first, the last 20), and every new draft applies those notes as standing preferences. Edit or delete lines in that file to change what it applies.

**Keep a steady rhythm (optional).** Set **Posts per week** in the agent's Preferences (Agents > Social Media Agent > Setup). Every Monday the agent adds social posts to next week until it has that many, each built around one of your Brand Kit's key messages; each is drafted and reviewed as usual. Leave it empty to plan everything yourself.

**Where to look.** Agents > Social Media Agent shows what needs your decision, open jobs, the drafts (Outputs) and AI usage (Reports). Each piece's job is a WorkQ item due on its publish date.

## What's in the box

- **Agent (1):** Social Media Agent (Sonnet). Role prompt with the draft-only, no-invented-facts, no-testimonials, Australian English and no-em-dash rules.
- **Custom tables (3):** Brand Kits (one row per business: voice, messages, restrictions, colours, fonts, logo path), Campaigns, and Content pieces (one per post, article, email, announcement or visual; its stage runs planned, drafting, ready for review, changes requested, approved, then published or skipped).
- **Setup (1):** Preferences: drafts folder in Knowledge (default `Social posts`), time zone (default Sydney), review lead time (default 2 business days) and a default call to action.

- **Processes (3):**
  - *Confirm a Brand Kit:* checks a new Brand Kit, asks the reviewer to confirm it, then saves a versioned copy in Knowledge for the agent.
  - *Draft a content piece:* drafts one piece from the confirmed Brand Kit, runs the brand and compliance checks and asks the reviewer to approve, change or skip it. An approved draft is saved as Word and Markdown in the folder for its content type and booked for its publish date. Starts when a content piece is created.
  - *Plan a campaign:* plans the pieces, content types, channels and dates from what you describe, shows the plan for approval, then creates the campaign and one content piece per planned piece (each starts its own drafting job).
- **Automations (6):** the steps the processes run (Brand Kit check and confirm, content piece steps, campaign plan steps), plus three scheduled ones: **rhythm top-up** (Mondays 7:00, only when Posts per week is set), **publishing this week**, which every Monday at 8:00 (Sydney time) lists the week's pieces in one WorkQ item, and **seasonal prompts**, which every Monday at 9:00 suggests a campaign 3 to 6 weeks before an Australian occasion (New Year, Valentine's Day, Easter, Mother's Day, end of financial year, Father's Day, Small Business Month, Black Friday, Christmas). They use no AI and send nothing. An administrator publishes them after install.
- **Skills (2):** `draft-content` and `plan-campaign`.

**Known limit:** automations cannot move a record's stage yet, so a content piece's Stage stays at Planned. Follow progress on the job's WorkQ item and the piece's dates, checks and Knowledge link instead.

## Configuration

No configuration variables are required.
