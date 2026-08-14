# V1 Security Acceptance Report

The repository-wide Standard scan `c24f4641-457a-478e-b564-92eeea269413` reviewed authentication/authorization, public input/uploads and private files/parsers/operations at protected revision `16154c395459dcfe27052204c4dbcecfa7ddd169`. The sealed baseline report is at `C:\Users\dell\AppData\Local\Temp\codex-security-scans-fo7N7b\school-software\16154c395459dcfe27052204c4dbcecfa7ddd169_20260814T121758Z_ai9njdi4\report.md`.

Eight baseline findings were validated: two high and six medium. The release branch closes each with regression evidence:

- operational support backups refuse missing/ephemeral keys and require a durable key version;
- qpdf requires an independently pinned SHA-256 identity;
- PDF uploads traverse normalized parsed objects, reject compressed/escaped active content and persist a fresh serialization;
- public intake uses trusted-source extraction and durable global caps before support-file storage;
- five configurable private roots reject public/static/release overlap;
- OCR reads verify stored byte size and SHA-256;
- release ZIP verification bounds archive size, entries, per-entry expansion, total expansion and compression ratio before extraction;
- direct-mode login throttling cannot block an unrelated account.

Focused security tests, the full 1,913-test suite, production build, Git safety and representative final Browser role-denial probes pass. There are zero unresolved Critical, High or Medium findings in the release working tree. The three qpdf runtime tests are deliberately skipped until an operator supplies the required binary and independent SHA-256; missing or mismatched configuration fails closed. No live provider, public deployment or real-data claim is made.
