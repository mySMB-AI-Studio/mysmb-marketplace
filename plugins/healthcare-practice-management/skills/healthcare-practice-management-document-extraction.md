---
name: healthcare-practice-management-document-extraction
description: Reads PDFs, photos and email bodies to pull out structured data — test result type and patient identifiers, supplier invoice fields, GST. Use for AU-06 (test result filing) and AU-16 (supplier bill capture).
---

# Document understanding and extraction

Use when an email or its attachment needs structured data pulled out before filing or coding.

1. Get the attachment: Outlook `list_email_attachments` then `get_email_attachment`; Gmail (dev) `get_attachment`. A text-layer PDF can be parsed directly; a scanned PDF or photo has no text layer, so read it as an image with `api.ai.generate` (vision input) instead — don't assume OCR is available.
2. For a test result: extract the test type, the date, and any patient-identifying text (name, date of birth) printed on the document. Do not interpret the result's clinical meaning — that's out of scope for every skill in this extension (see `healthcare-practice-management-clinical-summarisation`).
3. Resolve the patient with `healthcare-practice-management-patient-payer-resolution` using the extracted identifiers. Low-confidence extraction (blurry scan, no clear name) must lower your match confidence too, not be papered over.
4. For a supplier bill: extract supplier name, invoice number, date, line items, GST and total, the same fields a bookkeeping workflow needs — but note that this extension doesn't do the bill-coding or Xero-draft steps itself at MVP (that's AU-16, a P2 item).
5. File a confirmed test result as a patient attachment with `create_patient_attachment` only when the patient match is certain; otherwise route to WorkQ for a human match, per the automation's own approval rule.

Guardrails: never guess a missing field (a blank GST or an illegible total) — mark it as not found rather than estimating. Flag low scan quality explicitly so the review step knows to check the original image, not just the extracted text.

Example: a scanned pathology report PDF with no text layer arrives attached to an email. Read it as an image, extract "Jane Doe, DOB 03/04/1990, Lipid panel, collected 7 Oct 2026". Resolve to patient Jane Doe via `healthcare-practice-management-patient-payer-resolution`, then `create_patient_attachment` with a note that this was read from a scan and should be visually checked.
