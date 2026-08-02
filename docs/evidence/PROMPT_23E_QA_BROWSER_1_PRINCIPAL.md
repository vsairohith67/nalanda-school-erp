# Prompt 23E-QA Browser Checkpoint 1 — Principal

Date: 2026-08-03

Environment: fresh `CAL23E` copied database, final production build, isolated production runtime on `127.0.0.1:3220`.

Independent Principal QA passed at exact 1366 × 768 in light and dark themes. The page exposed operational and informational concepts separately, working/non-working/half-day/vacation totals, a one-date correction impact, one posted-attendance session, zero attendance rewrites, an explicit reconciliation warning and append-only reasoned history.

The event workspace exposed the current published examination reference, exact class-section audience preview, Staff-only and leadership-only scopes, a published replacement indicator and withdrawn history. The private capability note explicitly excluded public-site publication and Email, SMS or WhatsApp delivery.

All visible interactive controls measured at least 44 px. Keyboard focus had a visible solid outline; the exact viewport had no page-level horizontal overflow. Dialogs had accessible names and focused Close controls. There was no native JavaScript dialog and the Browser console contained zero warnings or errors.

An intentional `localhost` login attempt failed while `APP_ORIGIN` required `127.0.0.1`, confirming origin protection. The canonical-origin login succeeded. Production stderr was empty. The Principal tab and runtime were stopped after the batch.

The Principal tab and isolated runtime were stopped before the separate Parent batch began.
