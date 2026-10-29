# Social Media Agent

A business agent for a small business's marketing. It plans campaigns and drafts social media posts, articles, emails, announcements and simple visuals in the business's own voice, from a confirmed Brand Kit. Every draft is reviewed by a named person before it is used, saved in a Knowledge folder for its content type, and booked into WorkQ for its publish date.

**Draft-only.** The agent never posts, publishes, schedules or sends anything. The business copies approved content and posts it themselves. It never invents prices, dates, offers or claims (missing facts are shown as `[[MISSING: ...]]`) and never writes testimonials.

## What's in the box

- **Agent (1):** Social Media Agent (Sonnet). Role prompt with the draft-only, no-invented-facts, no-testimonials, Australian English and no-em-dash rules.
- **Custom tables (3):** Brand Kits (one row per business: voice, messages, restrictions, colours, fonts, logo path), Campaigns, and Content pieces (one per post, article, email, announcement or visual; its stage runs planned, drafting, ready for review, changes requested, approved, then published or skipped).
- **Setup (1):** Preferences: drafts folder in Knowledge (default `Social posts`), time zone (default Sydney), review lead time (default 2 business days) and a default call to action.

- **Processes (3):**
  - *Confirm a Brand Kit:* checks a new Brand Kit, asks the reviewer to confirm it, then saves a versioned copy in Knowledge for the agent.
  - *Draft a content piece:* drafts one piece from the confirmed Brand Kit, runs the brand and compliance checks and asks the reviewer to approve, change or skip it. An approved draft is saved as Word and Markdown in the folder for its content type and booked for its publish date. Starts when a content piece is created.
  - *Plan a campaign:* plans the pieces, content types, channels and dates from what you describe, shows the plan for approval, then creates the campaign and one content piece per planned piece (each starts its own drafting job).
- **Automations (3):** the steps the processes run (Brand Kit check and confirm, content piece steps, campaign plan steps). They use no AI and send nothing. An administrator publishes them after install.
- **Skills (2):** `draft-content` and `plan-campaign`.

**Known limit:** automations cannot move a record's stage yet, so a content piece's Stage stays at Planned. Follow progress on the job's WorkQ item and the piece's dates, checks and Knowledge link instead.

## Configuration

No configuration variables are required.
