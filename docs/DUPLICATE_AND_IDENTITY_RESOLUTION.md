# Duplicate and Identity Resolution

Candidate matching is deterministic evidence for human review, never an automatic merge.

Student signals: exact admission number/source ID, name, DOB, year, class/section and linked Guardian. Guardian signals: source ID, linked Student, name and relationship; phone/email are supporting signals only. Staff signals: exact Staff code/source ID, name, joining date and designation; contact is supporting only. A fuzzy name score cannot decide identity.

Allowed decisions are `CREATE_NEW`, `LINK_TO_EXISTING`, `MERGE_AFTER_APPROVAL`, `KEEP_SEPARATE`, `REJECT_SOURCE_ROW` and `NEEDS_MORE_EVIDENCE`. Each decision records candidates, evidence, operator, approver, timestamp, reason and before/after impact using the empty [review template](../templates/onboarding/duplicate-review.csv).

Source precedence is configured per package and period. Possible evidence includes a current signed register, issued historical report snapshot, current approved Staff record and reconciled financial books/receipts. These examples are not hardcoded Nalanda policy. Conflicting evidence stays `NEEDS_MORE_EVIDENCE` until the named owner decides.

Identity merges and family links are high-risk and usually `REQUIRES_COMPENSATING_ACTION` or `NOT_SAFE_TO_AUTOMATICALLY_ROLL_BACK` after user activity. Phone sharing, sibling households, name changes and transliteration must not collapse distinct people.
