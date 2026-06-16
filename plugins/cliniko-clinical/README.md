# Cliniko Clinical

Access Cliniko clinical records — treatment notes, medical alerts, and patient attachments. This plugin connects to the myHub-hosted Cliniko MCP server and surfaces the clinical-records side of the Cliniko API.

The server talks to Cliniko on your behalf using your personal API key, so it only ever sees data and performs actions your own Cliniko login is allowed to. Because clinical data is sensitive, your key's own Cliniko permissions govern exactly what is visible.

## Tools & resources

### Treatment notes
- List and view treatment notes for a patient or appointment
- Create a treatment note (from a treatment-note template / sections + answers)
- Update a draft treatment note
- List treatment note templates

### Medical alerts
- List and view a patient's medical alerts (allergies, conditions, warnings shown across the patient record)
- Create, update, and delete a medical alert

### Patient attachments
- List a patient's attachments (uploaded files / documents)
- View attachment metadata and retrieve the download URL
- Upload a new patient attachment
- Delete a patient attachment

## Configuration

This plugin connects to Cliniko with your personal API key.

| Variable | Required | Description |
|----------|----------|-------------|
| `CLINIKO_API_KEY` | Yes | Your personal Cliniko API key. In Cliniko: **My Info → Manage API keys → Add a key**. The key inherits your own permissions; its region suffix (e.g. `-au4`) selects your data centre automatically. |

One Cliniko API key connects every Cliniko plugin (scheduling, patients, clinical, billing, practice).

## Note on sensitive data

Treatment notes, medical alerts, and attachments are protected health information. Confirm before creating, editing, or deleting clinical records — and never expose attachment contents beyond the authorised user.

## See also
- [Find your Cliniko API key](https://help.cliniko.com/en/articles/1023957-find-your-api-key)
- [Cliniko API documentation](https://github.com/redguava/cliniko-api)
