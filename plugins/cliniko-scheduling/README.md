# Cliniko Scheduling

Manage Cliniko appointments, availability, and bookings. This plugin connects to the myHub-hosted Cliniko MCP server and surfaces the scheduling side of the Cliniko API — everything you need to read, create, reschedule, and cancel appointments for a practice.

The server talks to Cliniko on your behalf using your personal API key, so it only ever sees data and performs actions your own Cliniko login is allowed to.

## Tools & resources

### Individual appointments
- List, search, and view individual appointments
- Book a new appointment for a patient with a practitioner at a business
- Reschedule (change time, practitioner, or business)
- Cancel an appointment, with a cancellation reason
- Mark a Did Not Arrive (DNA)

### Group appointments
- List and view group appointments (classes / multi-patient sessions)
- Add and remove patients (attendees) from a group appointment

### Appointment types
- List and view appointment types (the bookable services, with their durations and the practitioners who offer them)

### Availability
- Query available time slots for a practitioner / appointment type / business over a date range
- List individual and group available times

### Bookings
- List and view online bookings made by patients through the Cliniko patient-facing booking flow

### Cancellations & attendance
- List appointment cancellation reasons
- Record cancellations and DNAs against appointments

## Configuration

This plugin connects to Cliniko with your personal API key.

| Variable | Required | Description |
|----------|----------|-------------|
| `CLINIKO_API_KEY` | Yes | Your personal Cliniko API key. In Cliniko: **My Info → Manage API keys → Add a key**. The key inherits your own permissions; its region suffix (e.g. `-au4`) selects your data centre automatically. |

One Cliniko API key connects every Cliniko plugin (scheduling, patients, clinical, billing, practice).

## See also
- [Find your Cliniko API key](https://help.cliniko.com/en/articles/1023957-find-your-api-key)
- [Cliniko API documentation](https://github.com/redguava/cliniko-api)
