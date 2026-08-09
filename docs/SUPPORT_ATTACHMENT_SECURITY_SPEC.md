# Support attachment security specification

Public intake accepts one PNG, JPEG or still WebP up to 2 MB and 4096×4096. Authenticated intake accepts up to five files / 20 MB total: safe PDF, PNG, JPEG or still WebP, each up to 5 MB. SVG, HTML, Office files, archives, executables, animation, active PDF content, MIME/magic mismatch, malformed/truncated content, excessive dimensions/pages, traversal and symlinks fail closed.

Images are decoded and re-encoded to strip metadata. Files use opaque private paths, SHA-256 verification, request/message visibility inheritance, authenticated `private, no-store` retrieval, CSP sandboxing and no PWA/public URL. Encrypted asset backup carries bytes, hashes, request/message ownership and visibility, restores twice, and refuses wrong keys or corruption.
