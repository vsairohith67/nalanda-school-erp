# Admissions Duplicate and Link Policy

Duplicate checks use exact normalised evidence: Guardian phone/email, child name plus DOB when collected, desired year/class and existing Guardian-Student links. Results are suggestions, never merges.

Each suggestion uses an opaque HMAC reference. Raw database IDs are not returned. A human must record `LINK`, `NOT_DUPLICATE` or `BLOCK` with a bounded reason. The decision and safe comparison evidence are append-only. Existing Students cannot be silently linked by conversion; a Student candidate may only be marked not duplicate or block conversion. An existing Guardian is linked only after an explicit exact-evidence `LINK` resolution.

Fuzzy name similarity never overwrites or merges records. Unresolved suggestions block conversion. Collision, ambiguity or contradictory evidence must be escalated to Principal/Director review.
