# SurveyMonkey

Connect SurveyMonkey to MyHub via the myHub-hosted SurveyMonkey MCP gateway. OAuth flow — click Connect and sign in to your SurveyMonkey account.

Covers survey listings, response data, per-question analytics rollups, collector management, and user profile access.

## Authentication

Click **Connect** in the MyHub workspace and sign in with your SurveyMonkey account. Access tokens are managed and refreshed automatically.

## Configuration

This plugin uses OAuth. No environment variables or manual credentials are required.

| Variable | Description |
|---|---|
| _(none)_ | OAuth tokens are managed automatically by MyHub after you click Connect. |

## Tools & resources

- `list_surveys` — list all surveys with title, id, date_created, date_modified, response_count, and page_count
- `get_survey_details` — full survey detail including pages and questions (param: `survey_id`)
- `get_survey_responses` — bulk responses for a survey (param: `survey_id`, optional `limit` default 50)
- `get_survey_summary` — rollup analytics per question (param: `survey_id`)
- `get_collector_list` — collectors for a survey (param: `survey_id`)
- `get_current_user` — authenticated user profile

## Widgets

- **Survey Overview** — list of your SurveyMonkey surveys with response counts and last-modified date
- **Response Summary** — total responses across all surveys with a top-survey highlight
- **Recent Surveys** — your 10 most recently modified SurveyMonkey surveys

## See also

- [SurveyMonkey API documentation](https://developer.surveymonkey.com/api/v3/)
- [SurveyMonkey OAuth guide](https://developer.surveymonkey.com/api/v3/#authentication)
