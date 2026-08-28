# Private object storage architecture

The local MinIO rehearsal uses a generated synthetic-only KMS secret so the adapter's required
SSE-S3 (`AES256`) requests are encrypted at rest. Provider overlays must map the same contract to an
owner-approved managed key or provider encryption control; the local key is never reused remotely.

The local synthetic overlay separates MinIO root credentials, application S3 credentials and backup-only S3 credentials. A one-shot pinned `mc` container creates the bucket, enables versioning, disables anonymous access, creates both restricted users and attaches checked-in prefix policies. Root credentials are not mounted into web, backup, seed, runtime-QA or object-init containers. Application credentials cannot reach `private/backups/*`; backup credentials cannot reach admissions, classwork, support, event-media, payslip, report/export, identity-card, onboarding or OCR prefixes.

Routes never receive a raw S3 client. `PrivateObjectStore` exposes bounded private put/get/stream/stat/delete/copy/list, short-lived authorized download URLs, checksum verification, health, and close. The filesystem adapter preserves local/copied QA. The S3-compatible adapter accepts a fixed endpoint, region, and bucket; remote governed environments require HTTPS.

Object keys are server-owned, module-prefixed, opaque, traversal-resistant, and never derived from display names. Uploads have bounded size/concurrency/time, exact SHA-256 verification, private encryption headers, and read-back verification. Signed URLs last 30–300 seconds and use a sanitized response filename. Bucket initialization rejects public policy/ACL and enables versioning.

Authorization and ownership remain in existing route/database layers. Knowing an object key is never sufficient to download it.
