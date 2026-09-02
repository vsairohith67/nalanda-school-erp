# OCR Scanning Foundation 1B clearance record

Status: `OCR_SCANNING_FOUNDATION_1B_PARTIAL_EXTERNAL_TOOLCHAIN_GATE`

Captured 2026-08-31. This is a partial software evidence record, not an operational authorization.

## Cleared software evidence

- The governed feature remains production-default OFF at 0% rollout and fails closed across UI, document APIs, submission APIs and worker APIs.
- PaddleOCR 3.7.0, PaddlePaddle GPU 3.3.1 and the four approved model revisions/weight hashes are exact and verified offline; weights and the worker image remain external to Git and CI.
- Strict admission accepts only decoder-valid PNG, JPEG or PDF input with matching extension, declared MIME and magic bytes. Streaming request ceilings, byte/page/pixel/dimension/output/time/concurrency limits and controlled failures are enforced.
- Private source and raster storage, signed replay-resistant worker calls, leases, bounded retries, cancellation, human field decisions, critical confirmation, optimistic concurrency, idempotent submission and authoritative domain-service writes passed synthetic QA.
- SQLite and PostgreSQL schemas/migrations/triggers are equivalent. Fresh install, existing-database migration, backup, double restore, retention and purge behavior passed on isolated copied/synthetic databases.
- Desktop/mobile light/dark browser QA completed with zero fresh console errors or warnings; the human-review submission was read back from the synthetic database.
- The complete ERP suite passed 242 test files (one intentionally skipped), 2,232 tests (three intentionally skipped). Focused OCR tests passed 11/11. Full typecheck and production build are release-gate requirements and are recorded in the exact-head CI run.
- Codex Security scan `470f9127-c794-46ad-b92a-599eb3933761` sealed zero reportable application-code findings across 69 changed-file receipts, including the route-local streaming body-boundary module.

## Blocking external toolchain gate

The exact patched worker image `sha256:597f0e036869533a6b5c687d4eae1fac2cb3b514d4ec9a4dd6240a4ef5047314` still reports eight unresolved Debian Bookworm advisories after all vendor-available upgrades: two scanner-critical and six scanner-high across Perl, OpenSSL and Expat packages. No fixed Bookworm package versions were available on the capture date.

The worker's network-none, read-only, unprivileged, capability-free, no-new-privileges and bounded runtime materially reduces reachability. It does not establish that every transitive native path is unreachable and does not substitute for a vendor fix. Therefore this task must not merge, tag, activate, update release trackers as cleared, or make a production-readiness claim.

## Resolution condition

When fixed packages or a policy-approved alternative base become available, rebuild the exact worker image, regenerate its SBOM and vulnerability scan, rerun runtime/security/full exact-head CI, and reassess the gate. After software clearance, run the separately generated `docs/prompts/OCR_SCANNING_OPERATIONAL_CERTIFICATION_1C.md`; do not run it as part of 1B.

Real data used: no. Real documents used: no. Production activated: no. Physical scanner/device certified: no.
