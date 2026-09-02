# OCR-SCANNING-OPERATIONAL-CERTIFICATION-1C

## Instruction

This is a future governed operational-certification task. Do not run it as part of OCR-SCANNING-FOUNDATION-1B. Begin only after a human explicitly authorizes 1C and supplies the approved environment, policy owners and real-document scope.

## Preconditions

- Start from the accepted OCR-SCANNING-FOUNDATION-1B merge SHA and confirm the foundation feature is still server-side OFF at 0%.
- Use one task, one branch and one dedicated physical worktree.
- Re-verify repository visibility, latest main, exact model/runtime pins, current vulnerability status and operational database hash before any write-capable QA.
- Require private HTTPS staging with no public model, source-document, database, log or worker-image artifact.
- Obtain signed approval for OCR retention/deletion periods, data-controller responsibilities, access roles, incident response and real-document test classes.
- Approve a specific local worker host/GPU profile and checksum-verified model store. Do not substitute cloud OCR, Tesseract, Surya or Unlimited-OCR.

## Certification scope

1. Deploy the web application, private-object store and local worker into the approved private staging architecture.
2. Validate host hardening, network-none worker containment, HMAC secret custody/rotation, backup custody, observability redaction and recovery drills.
3. Exercise approved representative real documents only after privacy authorization. Minimize the sample, identify handwriting separately and never infer handwriting certification from printed-text results.
4. Measure English, Hindi, Telugu and mixed-language accuracy by document class; record field-level false acceptance/rejection, page failures, latency, GPU/RAM and throughput.
5. Confirm every field remains a candidate until a trained human reviewer acts; test critical-field warnings, corrections, rejection/missing flows, final confirmation and stale-target/idempotency protection.
6. Confirm authoritative writes occur only through Admissions, Students, Guardians and Staff services and remain reversible through the approved domain process.
7. Test source/raster/raw/candidate/audit retention and purge end to end, including backup boundary, legal hold, failed deletion and object-prefix enumeration.
8. Validate Windows scan-to-file import. Native TWAIN/WIA is a separate decision. Validate Android/iOS only as upload/review clients unless camera OCR receives its own certification.
9. Re-run full security review, dependency audit, SBOM, worker-image vulnerability scan, SQLite/PostgreSQL parity, backup/restore twice, browser/accessibility matrix and full ERP regression.
10. Require exact-head CI, normal merge/tag and canonical tracker readback only if every operational gate passes.

## Stop gates

Stop without activation if any of these is true: retention policy is absent; real-document authority is ambiguous; worker/model provenance differs; unresolved reachable high/critical vulnerability exists; operational database changes outside the approved copy; private objects or OCR values reach Search/Smart AI; human review can be bypassed; service-boundary writes can be bypassed; purge cannot be proven; or staging is not private HTTPS.

## Activation boundary

Operational certification may recommend a separately approved, reversible rollout. It must not itself enable production, admit broad real data, certify handwriting, certify physical scanners, certify mobile camera OCR or claim 100% accuracy. Any activation requires a new explicit authorization, named owners, monitoring, rollback, retention configuration and a limited percentage.
