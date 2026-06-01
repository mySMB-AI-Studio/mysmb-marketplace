# Cliniko Patients

Manage Cliniko patients, contacts, and referral sources. This plugin connects to the myHub-hosted Cliniko MCP server and surfaces the patient-record side of the Cliniko API — the people a practice serves, their cases, the non-patient contacts linked to them, and where referrals come from.

The server talks to Cliniko on your behalf using your personal API key, so it only ever sees data and performs actions your own Cliniko login is allowed to.

## Tools & resources

### Patients
- List and search patients (by name, email, date of birth, reference number)
- View a single patient's full profile
- Create a new patient
- Update patient demographics and contact details
- Archive / unarchive a patient

### Patient cases
- List and view a patient's cases (episodes of care)
- Create and update a case (e.g. claim/condition grouping for a patient)
- Close or reopen a case

### Contacts
- List and view contacts (non-patient people — GPs, next of kin, employers, third parties)
- Create and update a contact
- Link contacts to patients

### Referral sources
- List and view referral source types and the individual referral sources
- Attribute a patient to a referral source for reporting

## Configuration

This plugin connects to Cliniko with your personal API key.

| Variable | Required | Description |
|----------|----------|-------------|
| `CLINIKO_API_KEY` | Yes | Your personal Cliniko API key. In Cliniko: **My Info → Manage API keys → Add a key**. The key inherits your own permissions; its region suffix (e.g. `-au4`) selects your data centre automatically. |

One Cliniko API key connects every Cliniko plugin (scheduling, patients, clinical, billing, practice).

## See also
- [Find your Cliniko API key](https://help.cliniko.com/en/articles/1023957-find-your-api-key)
- [Cliniko API documentation](https://github.com/redguava/cliniko-api)
