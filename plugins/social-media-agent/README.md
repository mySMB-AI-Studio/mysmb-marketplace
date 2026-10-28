# Social Media Agent

A business agent for a small business's marketing. It plans campaigns and drafts social media posts, articles, emails, announcements and simple visuals in the business's own voice, from a confirmed Brand Kit. Every draft is reviewed by a named person before it is used, saved in a Knowledge folder for its content type, and booked into WorkQ for its publish date.

**Draft-only.** The agent never posts, publishes, schedules or sends anything. The business copies approved content and posts it themselves. It never invents prices, dates, offers or claims (missing facts are shown as `[[MISSING: ...]]`) and never writes testimonials.

## What's in the box

- **Agent (1):** Social Media Agent (Sonnet). Role prompt with the draft-only, no-invented-facts, no-testimonials, Australian English and no-em-dash rules.
- **Custom tables (3):** Brand Kits (one row per business: voice, messages, restrictions, colours, fonts, logo path), Campaigns, and Content pieces (one per post, article, email, announcement or visual; its stage runs planned, drafting, ready for review, changes requested, approved, then published or skipped).
- **Setup (1):** Preferences: drafts folder in Knowledge (default `Social posts`), time zone (default Sydney), review lead time (default 2 business days) and a default call to action.

Processes (Brand Kit setup, drafting a content piece, planning a campaign) are added in later versions.

## Configuration

No configuration variables are required. The agent uses no external connectors: it works only with Workspace Knowledge, WorkQ and its own custom tables.
