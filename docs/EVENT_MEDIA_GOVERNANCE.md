# Event Media governance

Event Media is a privacy-first album and photo library for authorised school leadership. Uploading never publishes a photo. The enforced lifecycle is `UPLOAD -> PRIVATE -> REVIEW -> CONSENT/PUBLICATION CHECK -> EXPLICIT APPROVAL -> PUBLISHED`; any unknown people or missing consent keeps publication blocked.

## Scope and authority

- Super Admin, Director, and Principal receive the governed management permissions. Upload, review, consent, approval, publication, and archival are separate permissions.
- Teacher, Computer Operator, Viewer, Parent, and Student receive no management or publication authority by default. Parents have read-only access to explicitly published `PARENT_PORTAL` content scoped to their linked family.
- Public Event Media is disabled unless `EVENT_MEDIA_PUBLIC_GALLERY_ENABLED=true` is deliberately set. The default and example configuration are `false`. There is no website, social-media, messaging-provider, or external publishing integration.
- No face recognition, biometric processing, inferred Student tagging, generative editing, automatic moderation, or external image-processing API is used. Manual Student association is an authorised internal workflow only.

## Consent and publication

`MediaPublicationConsent` is specific to `EVENT_MEDIA_PUBLICATION`. It records the Student, optional linked Guardian, audience, wording version, documented evidence reference, source, granting date, expiry, recording actor, and revocation history. General enrolment, WhatsApp consent, or SMS/email consent is never reused or inferred.

For `PARENT_PORTAL` or `PUBLIC`, a photo with Students is eligible only when authorised staff declare the manual association list complete and every associated Student has a current consent for that exact audience. Unknown people, an empty association list, one missing consent in a group, expiry, or revocation fails closed. Revocation immediately withdraws affected published media; all delivery endpoints recheck consent and publication state before reading bytes.

## Storage, derivatives, and delivery

- Original bytes are written once beneath the validated private `EVENT_MEDIA_PRIVATE_STORAGE_ROOT`. Database triggers prevent changes to original evidence fields and prevent hard deletion.
- Accepted uploads are bounded PNG, JPEG, or still WebP. Validation compares extension, browser MIME, file magic, container completeness, decoded format, dimensions, pixel count, and byte size. SVG and animated or malformed formats are rejected.
- Sharp runs locally and deterministically to apply orientation, bound the thumbnail to 720 px, encode JPEG, and verify that EXIF/ICC/XMP metadata is absent. The original is never overwritten.
- Management originals and thumbnails and Parent derivatives are authenticated with `private, no-store` responses. Public derivatives exist only behind the default-off feature flag, are revalidated on every request, and use `max-age=0, must-revalidate` so withdrawal cannot rely on a stale long-lived cache.
- Public and Parent payloads expose opaque media/album public keys only, never Student identifiers, names, admission numbers, consent evidence, private storage keys, or original file names.

## Retention, audit, backup, and restore

Albums and media use governed archival and withdrawal; API hard-delete routes do not exist. Archival does not erase originals, audit rows, or consent records. Audit history covers creation/upload, review, approval, publication, unpublication, consent changes, archival, withdrawal, and derivative failure without binary image contents.

Logical backup version 43 continues to include all six Event Media metadata tables and excludes image bytes. Private bytes have a separate encrypted `event-media:asset-backup` flow. That command:

1. verifies every original and ready thumbnail against its stored SHA-256;
2. bounds each encrypted asset-backup set to 240 MiB of media, leaving container capacity for the ZIP manifest and headers; larger libraries must be split into explicit asset-key batches;
3. writes a bounded encrypted artifact with exclusive creation;
4. restores it to two isolated directories;
5. verifies exact file and ownership digests; and
6. marks original recovery evidence verified only when the database row stayed byte/hash-identical.

Restore rejects unknown archive entries, path traversal, duplicate ownership, malformed manifests, conflicting target files, wrong keys, altered bytes, and unsafe target roots. Original retention or eventual governed deletion must follow school policy and legal-hold review; unpublication or consent revocation is not an instruction to destroy the original.

## Operational safety

Migration and mutation QA must run only against a copied SQLite database with synthetic images. Snapshot the operational `dev.db`, `dev.db-wal`, and `dev.db-shm` artifacts before QA and compare them after cleanup. No test may use real Student photos or invoke an external provider.
