# Import Package Specification

The deterministic contract is [package-manifest.schema.json](../config/onboarding/package-manifest.schema.json). A package is a private directory containing `manifest.json` and up to 32 flat, individually declared CSV/XLSX files. Subdirectories, absolute/parent paths, symlinks, archives and undeclared files are outside the admitted contract.

Each file records safe file ID, flat relative path, SHA-256, exact size, format, domain and optional declared encoding. The package SHA is SHA-256 over deterministic JSON tuples sorted by file ID and relative path: `[fileId, relativePath, format, domain, declaredEncoding-or-null, sizeBytes, fileSha256]`. It therefore binds mapping-sensitive metadata as well as bytes. Validation rejects every undeclared or non-regular directory entry. The digest proves the admitted package set, not custody by itself.

Supported formats are CSV (UTF-8, UTF-8 BOM, or explicitly declared supported Windows encoding) and hardened XLSX. Low-confidence encoding, inconsistent/ambiguous delimiters, duplicate/blank headers, hidden sheets, merged cells, formulas, external relationships, macros, executable content, expansion bombs, scientific-notation identifiers and checksum substitution produce explicit errors/review states.

The same package hash + mapping version + wave is an idempotency identity for a future import. It must not create duplicate records. This preparation tool does not create import batches or authoritative records.

Original filename is custody metadata and need not match a working-copy filename. It must never contain credentials. File contents are untrusted even when a manifest says they are authoritative.
