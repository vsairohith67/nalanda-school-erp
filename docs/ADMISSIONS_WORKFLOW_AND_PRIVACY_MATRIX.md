# Admissions Workflow and Privacy Matrix

Prompt 23H implements a local, governed admissions CRM. It does not authorise deployment, real applicants, live messaging, payment collection, government submission, transport or address/location capture.

## Lifecycle

`NEW -> CONTACTED -> VISIT_SCHEDULED -> APPLICATION_INVITED -> APPLICATION_IN_PROGRESS -> SUBMITTED -> UNDER_REVIEW -> WAITLISTED/OFFERED -> ADMITTED`

Terminal or review states are `DECLINED`, `WITHDRAWN`, `EXPIRED` and `ARCHIVED`. All state changes use expected versions and append an event. Decisions, conversions, duplicate resolutions, application versions and audit events have database-level rewrite/delete guards.

## Data boundary

| Stage | Permitted | Prohibited |
|---|---|---|
| Public/staff enquiry | Guardian name, phone/email, desired year/class, optional child name, source, bounded message, notice/consent version | Address/location, Aadhaar/PAN, medical/bank/payment data, photos, documents, marks |
| Invited application | Child name, optional DOB when configured, desired year/class, prior school/class, Guardian relationship/contact, declarations | Residential address/location, Aadhaar/PAN, payment/transport data |
| Documents | Independently enabled birth certificate, report card or transfer certificate; PDF/PNG/JPEG/still WebP | Public uploads/URLs, SVG/HTML/office/macro/executable/animated content, EXIF/local paths |
| Conversion | Student, exact Guardian links, academic-year enrollment, governed admission number, optional inactive Parent User | Payment, receipt, fee posting, account activation, address/location, transport |

## Roles

Super Admin/Director have governed oversight. Principal may decide, offer and convert. Admin supports intake/application/document workflows without conversion authority. Computer Operator handles minimal enquiries/follow-ups. A Teacher sees only an exact assigned review. Viewer sees suppressed aggregates. Accountant has no admissions permission by default. Applicants access only their invitation-bound application.

Public intake creates only `AdmissionEnquiry`; it never creates Student, Guardian, User or enrollment records.
