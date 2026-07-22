# Library Membership and Circulation Workflow

Prompt 16G adds operational library circulation without adding any financial workflow. `BookCatalogItem`, student-fee `Payment`, miscellaneous income, books-sales receipts, publisher settlements, expenses, and cash book remain unchanged and separate.

## Memberships

One `LibraryMember` links to exactly one active `Student` or one active `StaffMember`. The database and server enforce the exclusive link, matching `memberType`, normalized unique `memberCode`, and one membership per linked person. Membership status is `ACTIVE`, `SUSPENDED`, or `INACTIVE`; suspension needs a reason. An expired `suspendedUntil` restores calculated eligibility without silently rewriting preserved status/history. Memberships with circulation history are never hard deleted.

Membership creation is manual and exact through `/library/members/new`. This phase intentionally does not add `library:members:backfill`; the optional bulk command was skipped to keep the release boundary low-risk.

## Borrowing policies

No school policy is silently seeded. Director/Admin must create reviewed policies in **Library > Policies**. Resolution order is exact active Student class, exact Staff type/designation, then general member type; priority resolves non-ambiguous candidates. Limits require positive max loans and calendar-day periods, non-negative renewals/reservations, and a positive renewal period. Policy changes apply to future issues only. Each loan preserves policy code, loan days, maximum renewals, and renewal days.

Calendar days are intentional in Prompt 16G. School-working-day, holiday, and grace adjustments are future work.

## Issue, return, and renewal

Issue is preview/confirm. The server rechecks active membership and linked person, physical `AVAILABLE` status, no active copy loan, loan limit, resolved policy, and earliest reservation priority inside a transaction. `LibraryLoan.activeCopyKey` equals the copy identity only while status is `ISSUED` and is unique at the database boundary. Issue does not change `LibraryCopy.status`; physical availability and circulation availability are separate.

Return accepts an India-local calendar date, condition, and notes. It blocks dates before issue and physical-status conflicts. The transaction changes the loan to `RETURNED`, clears `activeCopyKey`, and appends `RETURNED`. In Prompt 16H, explicitly selecting damage reporting creates a separate pending DAMAGED incident, records the returned condition, and moves the copy to `UNDER_REPAIR`; it still does not automatically create a charge.

Renewal requires an active loan and eligible member, respects the snapshot renewal limit, and is blocked when another member has a waiting reservation for the title. It extends from the current due date using `renewalPeriodDaysSnapshot`, then appends `RENEWED` with both due dates. An issued-in-error cancellation requires a reason, clears the active key, and preserves the loan and event.

## Reservations and overdue

Reservations are title-level. `activeMemberTitleKey` uniquely permits one waiting reservation per member/title. Queue order is requested date then creation time. The earliest eligible waiting member has issue priority; a different borrower is blocked. Issue automatically fulfils and links the matching reservation and loan transactionally. Staff can cancel with a reason or explicitly mark a waiting reservation expired; there is no background scheduler or self-service portal.

Overdue is never stored as an editable status. It is derived when `status = ISSUED` and `dueDate` is before the current Asia/Kolkata calendar date.

## Privacy and permissions

All pages and APIs enforce server-side permissions. Director and Super Admin have all circulation permissions. Admin has operational and export permissions. Principal is read-only for circulation and reports. Viewer/Auditor sees masked reports only and cannot export. Accountant, Teacher, and Parent have no circulation permission by default. A future Library In-charge should use a custom bundle in the existing role matrix; no global role was added.

Borrowing reports exclude contact/address details, raw actor IDs, hashes, secrets, filesystem paths, fines, and payment fields. CSV output neutralizes spreadsheet formulas and uses India-local filenames.

## Backup and continuation

Backup version 20 adds `libraryMembers`, `libraryPolicies`, `libraryLoans`, `libraryReservations`, and `libraryLoanEvents`. Restore validates exclusive membership links, snapshots, active-copy uniqueness, queue keys, fulfilment links, append-only events, collisions, older backups, and password-hash exclusion.

Prompt 16H now provides explicit overdue/lost/damaged review, separately approved charges and waivers, exactly-once Miscellaneous Income collection, and isolated read-only Parent/Teacher Library views. See `LIBRARY_INCIDENT_CHARGE_WAIVER_AND_PORTAL_WORKFLOW.md`. Scanner labels, RFID, stock verification, procurement, and inventory valuation remain absent.
# Prompt 16I update

Scanner assistance is identifier lookup only. Issue and return require a visible confirmation and still use the existing circulation transaction helpers and policy checks.
# Prompt 16J stock-verification boundary

An open `ISSUED` loan is snapshotted as `ISSUED_OFFSITE`, including borrower type and due date but not borrower name/contact/address for masked reports. It is never proposed missing merely because it is absent from the shelf. Existing circulation and unresolved-incident guards remain authoritative during any approved correction.
