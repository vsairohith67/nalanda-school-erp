# Exactly-Once Admission Conversion Specification

Conversion accepts only a final-approved `ADMITTED` application whose latest decision is `ADMIT`. It requires Principal/Director/Super Admin authority, an expected application version and a bounded request key.

One database transaction:

1. re-reads the approved application and unresolved duplicate evidence;
2. allocates one admission number using a cycle version/counter compare-and-set;
3. creates or explicitly links Guardians;
4. creates one Student and one active academic-year enrollment;
5. creates Guardian-Student links;
6. optionally creates one inactive `PENDING_ACTIVATION` Parent User through IAM records;
7. records immutable conversion lineage and an append-only event.

Uniqueness on application, request key, Student, enrollment and admission number plus the cycle counter makes repeated/concurrent calls converge on one conversion. A retry returns the existing safe conversion result. Any failure rolls back the counter, Student, Guardian, relationship, enrollment, Parent User, conversion and event together.

The transaction never creates Payment, receipt, fee, address/location or transport records and never activates a Parent account.
