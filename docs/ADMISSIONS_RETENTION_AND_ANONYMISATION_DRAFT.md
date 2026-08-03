# Admissions Retention and Anonymisation Draft

This is an operational draft, not a legal retention schedule. Production use requires an approved admissions privacy notice, retention policy and complaint route.

Every enquiry, application and document receives a retention-review date derived from the configured cycle. `/api/admissions/retention` is preview-only and returns bounded opaque references plus suggested review actions. It cannot delete or anonymise records.

Reviewers must separately decide whether to archive, anonymise contact/application content, retain decision/conversion lineage, or delete document bytes after recovery and legal review. Decisions, offers and conversions are never hard-deleted. Document deletion requires a later explicitly authorised workflow that preserves hash, decision and audit evidence without preserving unnecessary bytes.

No final duration is asserted. A future production policy must define purpose, lawful basis, applicant notice, access/correction/complaint path, active-cycle handling, declined/withdrawn/expired treatment, admitted-record handoff and encrypted-backup expiry.
