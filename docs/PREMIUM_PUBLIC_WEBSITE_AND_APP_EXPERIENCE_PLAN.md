# Premium Public Website and App Experience Plan

## Status and scope

Prompt 20D adds a controlled public-website foundation to the existing Nalanda Fee Control Next.js application. It is local and deployment-ready in architecture, but it does not deploy, purchase hosting, change DNS, create a native app, submit an app-store package, add an Admissions CRM, collect enquiries, upload media, track visitors, or expose school records.

The public experience and authenticated ERP share one codebase while retaining separate route, data, permission, caching, indexing, and visual boundaries.

## Architecture and public/private boundary

The public surface provides a premium shell, first-party logo, editorial typography, responsive header/footer, skip link, visible focus, light/dark presentation, reduced motion, fixed public routes, controlled pages/news, local registered assets, safe metadata, robots/sitemap, and a fixed `/login` portal entry.

Public content comes only from:

- `PublicWebsiteSettings`;
- `PublicWebsitePage` and its selected immutable version;
- `PublicWebsitePost` and its selected immutable version;
- `PublicWebsiteNavigationItem`.

These models do not relate to Student, Guardian, Staff, Payment, attendance, assessment, report card, or communication records. Actor identifiers stay in authenticated audit data and are not rendered publicly or exported in reports.

Public pages create no application session and call no private API. `/login` is only the entry to the authenticated ERP. Draft previews and administration require explicit permissions and remain noindex/no-store.

## Controlled content

Allowed blocks are `HERO`, `RICH_TEXT`, `FEATURE_GRID`, `FACT_GRID`, `CTA`, `FAQ`, `TIMELINE`, `REGISTERED_IMAGE`, `QUOTE_WITHOUT_PERSONAL_ATTRIBUTION`, `CONTACT_DETAILS`, `PORTAL_LOGIN`, and `NEWS_LIST`.

Server validation rejects unsupported blocks, raw HTML, scripts, handlers, iframes, object/embed, forms, arbitrary components/CSS, external images, data/JavaScript/VBScript URLs, protocol-relative URLs, unapproved domains, private deep links, unsafe query parameters, oversized values, and skipped heading levels.

Images resolve from a fixed same-origin catalog with declared dimensions, MIME, and alt policy. Decorative images require empty alt. There is no upload or child-photo workflow.

## Publication and immutable versions

Lifecycle:

1. create/edit draft;
2. leadership draft preview;
3. submit the current review version;
4. approve that exact version;
5. publish with a reason;
6. create immutable original snapshot;
7. edit a later draft and invalidate earlier approval;
8. submit/approve again;
9. publish a correction with reason;
10. archive without deleting history.

Public readers render only a `PUBLISHED` record’s selected immutable snapshot. Scheduled posts stay unavailable until due; expired posts disappear. Unique parent/version constraints and restrictive relations protect history. There are no hard-delete page/post APIs. Navigation accepts only published page IDs, News, exact `/login`, or approved HTTPS destinations.

## Claims, privacy, contact, and admissions

Fallback pages use approval-pending wording. Content must not invent or imply affiliation/recognition, awards, rankings, testimonials, reviews, results, statistics, Student identity/photos, Parent contacts, private Staff details, fees, marks, attendance, private portal data, or analytics identities.

Contact permits only approved public address, office phone, office email, office hours, and allowlisted HTTPS directions. It has no enquiry/application form, upload, Student creation, payment, automated communication, or Admissions CRM.

Mandatory Disclosure is disabled by default and unavailable until published settings enable it and approved content is published.

## School App and future product boundaries

`/school-app` describes the existing PWA: login remains required; records are not stored offline; only approved static assets and the generic offline shell are cached; Parent/Teacher ownership remains server-authoritative; there is no government-ID, app-store, native-app, push-notification, or offline-database claim; production HTTPS and device testing are required.

A future wrapper is a separate phase requiring authentication/download/camera/update/accessibility/store-policy testing. A future native app requires its own threat model, API, consent, offline-data, release, and support plan. A future Admissions CRM and future media-consent workflow are also separate scopes.

## Accessibility and responsive design

Public routes use semantic landmarks and content elements. The shell provides skip navigation and visible focus. Mobile navigation provides a labelled trigger, `aria-expanded`, labelled navigation, explicit close, backdrop close, Escape close, and focus return.

Target viewports are 1366×768, 1024×768, 768×1024, 390×844, 375×667, and 320×568. Layouts use bounded widths, responsive grids, wrapping, 44px key controls, dark variables, and reduced-motion overrides. There is no autoplay.

## SEO and indexing

Controlled pages/posts require validated title, description, canonical path, and registered social image. Metadata includes canonical, Open Graph, Twitter, and robots.

Indexing requires both `PUBLIC_WEBSITE_INDEXING_ENABLED=true` and the exact approved HTTPS host `nalandaps.com` or `www.nalandaps.com`. Local/staging stays noindex with an empty sitemap. Only active published pages and non-expired published posts are listed. Draft, preview, admin, login, archived, private, and disabled Mandatory Disclosure routes are excluded.

Future structured data may use verified public settings only; it must never fabricate ratings, awards, affiliation, or private facts.

## Caching, PWA, and performance

Public rendering is server-led; mobile navigation is the only public client component. Public HTML is not added to the service-worker cache.

The existing worker remains limited to `/_next/static/**`, manifest, local logo/icons, and the generic offline response. It excludes navigation HTML, APIs, login, private routes, JSON/CSV/PDF/downloads, query resources, private/no-store responses, cookies, and cross-origin resources. Admin/preview APIs remain no-store. Publication does not clear unrelated/private caches.

Performance priorities are bounded queries, no visitor analytics/external fonts/autoplay, exact image dimensions, minimal client JavaScript, and no public API waterfall.

## Permissions

- Super Admin/Director: full administration.
- Principal: settings, content, review, publish, navigation, preview, reports/export.
- Admin: drafts, settings, navigation, preview, reports/export; no final review/publish by default.
- Viewer/Auditor: aggregate readiness only; no draft body, preview, or export.
- Accountant/Teacher/Parent: no administration.
- Public user: published routes only.

Every API enforces permissions server-side.

## Reports, backup, and restore

Readiness reports cover status/type totals, versions, reviews, stale approvals, required pages, SEO/heading/block gaps, contact completeness, Mandatory Disclosure, navigation integrity, orphan pages, scheduled/expired posts, sitemap counts, and robots state.

CSV is formula-safe, India-local in filename, aggregate-only, and excludes bodies, private contacts, raw actors, filesystem paths, provider/DNS/hosting credentials. Viewer cannot export.

Backup v37 adds `publicWebsiteSettings`, `publicWebsitePages`, `publicWebsitePageVersions`, `publicWebsitePosts`, `publicWebsitePostVersions`, `publicWebsiteNavigationItems`, and `publicWebsiteEvents`. Restore validates controlled JSON, natural keys, parent/version links, navigation links, and forbidden secrets. V36 remains compatible with empty website arrays. Restore rehearsals use a copied database only.

## Hosting, launch, rollback, and ownership

A future host must support the approved Next.js runtime, environment variables, database model/migration, HTTPS, backup, logs, health monitoring, and rollback.

The website-only DNS/mail-preservation sequence is in `GODADDY_DOMAIN_AND_WEBSITE_CUTOVER_RUNBOOK.md`. Launch must preserve the current GoDaddy site archive and Google Workspace MX, SPF, DKIM, DMARC, verification, ownership, and renewal records.

Launch phases:

1. local foundation and tests;
2. Prompt 20D-QA with isolated data/copied restore;
3. leadership content approval;
4. noindex HTTPS staging;
5. hosting/recovery/monitoring sign-off;
6. separately approved website-only DNS window;
7. mail, HTTPS, route, SEO, accessibility, and login verification;
8. monitored observation period.

Application rollback restores the last known-good release and compatible backup through an authorised isolated process. DNS rollback restores only pre-change website records while preserving mail/verification.

Maintenance ownership must cover domain/hosting/certificate renewal, public claims/contact accuracy, publication/correction reasons, accessibility/SEO/link/stale-content reviews, backup/restore, dependencies/security, incidents/rollback, and separate approval for any future CRM, consent, media, analytics, wrapper, or native app.

## Prompt 21A Student-location public boundary

Student addresses, localities linked to a Student, coordinates, clusters, map screenshots, transport/home markers, correction requests, provider payloads, and location audit are never public-website content. They must not enter controlled public content, metadata, structured data, sitemap, search index, media captions, analytics, enquiry forms, public APIs, downloadable files, or preview URLs.

A future internal map does not authorise a public catchment map. Public communications may describe the school’s service area only from leadership-approved non-Student content and must not allow small-group inference about children or families.
