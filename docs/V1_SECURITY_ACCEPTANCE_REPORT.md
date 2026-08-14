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

Focused security tests, the post-correction full 1,916-test suite, production build, Git safety and representative final Browser role-denial probes pass. There are zero unresolved Critical, High or Medium findings in the release working tree. Independent QA also cleared the production dependency audit by pinning patched Next.js/Sharp versions and Nanoid/PostCSS overrides; `pnpm audit --prod` reports no known vulnerabilities.

The three qpdf runtime tests passed independently with the official qpdf 12.3.2 Windows archive after its published SHA-256 was verified. AES-256 protection, permitted printing/restricted editing and malformed/active-PDF refusal were inspected. The binary remained temporary, is absent from the release package and still requires approved deployment-time path/hash configuration; missing or mismatched configuration fails closed. No live provider, public deployment or real-data claim is made.
