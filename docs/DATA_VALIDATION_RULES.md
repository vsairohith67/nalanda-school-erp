# Data Validation Rules

## Admission limits

| Limit | Value |
|---|---:|
| File | 10 MiB |
| Files/package | 32 |
| Sheets/file | 16 |
| Rows/sheet | 10,000 |
| Columns | 128 |
| Cell | 8,000 characters |
| Total characters/file | 16 MiB |
| Formulas | 0 |
| Processing time | 30 seconds |
| Each report | 10 MiB |

CSV supports quoted commas and embedded newlines. UTF-8 and UTF-8 BOM are detected. A supported Windows code page is used only when explicitly declared; invalid UTF-8 without a supported declaration is `ENCODING_LOW_CONFIDENCE`. Delimiters must be unambiguous and consistent.

XLSX reuses central-directory inspection to refuse traversal, excessive entries/expansion, encryption, macros, ActiveX/OLE/embeddings, external relationships and malformed content. Generic domain files use exactly one visible, unmerged, formula-free sheet.

States are `VALID`, `MISSING_REQUIRED`, `INVALID_FORMAT`, `AMBIGUOUS`, `UNSUPPORTED`, `CONFLICTING_SOURCE`, `DUPLICATE_CANDIDATE`, `UNMAPPED_VALUE`, `SENSITIVE_REQUIRES_APPROVAL`, `NOT_APPLICABLE` and `READY_FOR_HUMAN_REVIEW`.

Allowed normalization is trim, NFC, deterministic aliases, declared dates, controlled-code casing and safe contact-format proposals. No name spelling, DOB, gender, admission number, class, relationship, Staff code or financial amount is invented or silently changed.

Logs contain only package/batch/file IDs, row number, field ID, safe error code, count and duration. They do not contain names, contacts, addresses, marks, amounts, source rows or identity numbers. CLI summaries follow the same rule.

Reports are private artifacts. CSV output neutralizes leading `=`, `+`, `-` and `@`. Source packages are re-hashed after dry run to prove no mutation. The preparation engine has no database or network access.
