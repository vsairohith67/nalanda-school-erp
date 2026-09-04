# Communication Template Governance

The 1A catalogue contains immutable version-1 families for account invitation, password recovery, security change, payment receipt, report, classwork, Parent Meeting, Support, Safe Exit, Library, and system incident events. Every family has five channel renderings and three locale records.

English (`en-IN`) copy is reviewed for the software fixture. Telugu (`te-IN`) and Hindi (`hi-IN`) are explicitly `DRAFT_PENDING_LANGUAGE_REVIEW`; no professional-translation claim is made. Unsupported locales fall back deterministically to English and report the fallback.

Only server-owned placeholders are accepted: recipient display name, authorised Student display name, class label, meeting date, safe reference, relative action URL, and School display name. Current catalogue families use only School display name. Property paths, expressions, code, recursion, loops, raw JSON, arbitrary HTML and arbitrary URLs are rejected. Values are length-bounded, control characters are rejected, email subjects reject CRLF, and HTML escapes all substitutions.

External renderers use privacy-minimised copy. Reports say that a report is available rather than including marks; finance omits ledgers; Support omits complaint text; biometric notices omit punches; security notices omit secrets/device detail. Email is text-first with a strict generated HTML alternative and no scripts, forms, frames, tracking pixels or remote images. SMS is bounded for later segment estimation. WhatsApp remains template-oriented and one-way. Native push uses generic lock-screen copy. In-app may be richer only within current authorisation.

Every render hash binds the template version, approved substitutions, channel, locale, and safe action path. An already used version is never silently edited; a correction requires a new version.
