# Library Barcode Labels and Scanner Assistance

Prompt 16I uses **Code 39** (basic character set): `A-Z`, `0-9`, space, `-`, `.`, `$`, `/`, `+`, and `%`. Inputs are trimmed, uppercased, and whitespace is removed before exact matching. Unsupported values are rejected rather than printed as inaccurate decorative bars.

Labels are server-rendered SVGs and print black on white at a default 50 mm by 25 mm size. They include only NPS, the barcode, human-readable barcode, accession number, short title, and optional shelf code. They never include borrower, contact, Vendor, acquisition cost, invoice, or database-ID data.

Assignment is preview-first. Existing barcodes cannot be overwritten by a normal assignment. An explicit correction requires a reason and appends `BARCODE_ASSIGNED` or `BARCODE_CORRECTED` copy history. Accession numbers remain immutable. The current schema has no separate retired-barcode registry; corrections are exceptional and the old value remains in append-only history, so database-level reuse prevention applies to current values while a future identity-registry policy is intentionally deferred.

USB scanners are handled as keyboard input: autofocus, Enter submission, exact normalized lookup, 1.5-second duplicate suppression, and Reset/Rescan. They are not authentication. Issue and return scanning always stops at a visible confirmation; the existing transactional circulation helpers recheck membership, policy, reservation, loan, incident, physical-copy, and concurrency controls.

This phase includes no RFID, camera scanning, location tracking, stock verification, procurement, or valuation. Backup version remains 21 because `LibraryCopy.barcodeValue` and `LibraryCopyEvent` were already backed up and restored. Prompt 16J is reserved for stock verification.
# Prompt 16J stock-verification integration

The keyboard-style scanner is now also available inside an active stock-verification session. It retains trim/uppercase normalization, exact barcode lookup, optional exact accession fallback, Enter submission, autofocus, reset, and short duplicate suppression. A stock scan writes only verification records and append-only scan events; it never issues, returns, moves, damages, withdraws, or marks a copy missing. See `LIBRARY_STOCK_VERIFICATION_WORKFLOW.md`. Physical scanner hardware is still not certified without a real device.
