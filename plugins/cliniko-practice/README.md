# Cliniko Practice

Manage Cliniko practitioners, businesses, users, and account settings. This plugin connects to the myHub-hosted Cliniko MCP server and surfaces the practice-administration side of the Cliniko API — the structural data that the rest of Cliniko hangs off (who works where, which locations exist, and account-level configuration).

The server talks to Cliniko on your behalf using your personal API key, so it only ever sees data and performs actions your own Cliniko login is allowed to.

## Tools & resources

### Practitioners
- List and view practitioners
- View a practitioner's profile, designation, and the appointment types they offer
- List practitioner reference numbers (provider numbers)

### Businesses
- List and view businesses (the practice locations / clinics)
- View a business's address, contact details, and time zone
- Create and update a business

### Users
- List and view Cliniko users (staff accounts)
- View the currently authenticated user (whose API key is in use)

### Account & settings
- View account details (practice name, plan, country, time zone)
- List settings such as taxes and appointment-type categories used across the practice

## Configuration

This plugin connects to Cliniko with your personal API key.

| Variable | Required | Description |
|----------|----------|-------------|
| `CLINIKO_API_KEY` | Yes | Your personal Cliniko API key. In Cliniko: **My Info → Manage API keys → Add a key**. The key inherits your own permissions; its region suffix (e.g. `-au4`) selects your data centre automatically. |

One Cliniko API key connects every Cliniko plugin (scheduling, patients, clinical, billing, practice).

## See also
- [Find your Cliniko API key](https://help.cliniko.com/en/articles/1023957-find-your-api-key)
- [Cliniko API documentation](https://github.com/redguava/cliniko-api)
