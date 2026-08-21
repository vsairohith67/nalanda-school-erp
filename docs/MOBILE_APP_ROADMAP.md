# Mobile App Roadmap

- **Reconciled:** 2026-08-21
- **Scope:** Shared responsive ERP, PWA certification, Android, iOS, and iPadOS

## Current classification

| Capability | Classification | Current evidence boundary |
|---|---|---|
| Responsive Web ERP | `CLEARED` | The shared ERP is responsive and remains the primary application surface. |
| PWA code foundation | `CLEARED` | The repository includes the installable PWA foundation described in the [PWA/mobile strategy](./PWA_AND_MOBILE_APP_STRATEGY.md). |
| End-to-end PWA readiness | `PARTIAL` | Browser-level foundation exists; real-device installation, update, session, file, and recovery behaviour is not yet certified. |
| Physical-device certification | `OPERATIONAL_CONFIGURATION_PENDING` | Requires approved private HTTPS staging and the [physical-device staging checklist](./PWA_PHYSICAL_DEVICE_STAGING_CHECKLIST.md). |
| Native Android app | `NOT_IMPLEMENTED` | No native Android application or approved store-delivery pipeline is proven. |
| Native iOS/iPadOS app | `NOT_IMPLEMENTED` | No native Apple application, signing pipeline, or App Store delivery is proven. |
| Push notifications | `NOT_IMPLEMENTED` | Push is not part of the current PWA/provider foundation and needs a separate consent, provider, and delivery design. |

## Governing approach

Keep one responsive web application as the source of product behaviour. Do not fork school workflows into separate Android and Apple codebases until measured usage and device evidence justify native work.

The preferred sequence is:

1. Deploy the exact approved RC to private synthetic HTTPS staging under separate operational authority.
2. Complete independent staging QA.
3. Certify the PWA on representative Android phones/tablets and iPhone/iPad devices.
4. Use the evidence to decide whether PWA alone is sufficient.
5. If approved, evaluate an Android Capacitor wrapper around the shared responsive application.
6. Prepare iOS/iPadOS compatibility, then build/sign only when a Mac/Xcode environment is available.

## Work that may begin before hosting

- Maintain responsive shared-web behaviour during V1.5 feature work.
- Define the device/browser matrix, expected evidence, accessibility cases, and issue template.
- Review Capacitor feasibility and native capability needs without creating a second product implementation.
- Prepare Apple account, privacy, entitlement, and signing decision checklists.

No mobile distribution, signing, device certification, live push, or store submission should occur before staging and separate approval.

## PWA physical-device certification

Certification must wait for private HTTPS staging and should cover:

- Android Chrome installation, relaunch, update, session expiry, and removal;
- iPhone and iPad Safari Add to Home Screen behaviour;
- responsive navigation, forms, tables, dialogs, uploads, downloads, and printing where relevant;
- online, slow, interrupted, and offline/error states without claiming unsupported offline data access;
- authentication, logout, session renewal, and role changes;
- service-worker update and stale-asset recovery;
- camera/file-picker behaviour only for existing approved flows;
- accessibility, orientation, keyboard, safe-area, and touch-target behaviour;
- privacy-safe logs and screenshots.

Passing PWA certification does not automatically authorise a native app.

## Android/Capacitor phase

`ANDROID-CAPACITOR-1A — Android Foundation and Device QA` may begin only after staging and PWA certification demonstrate a real need that the PWA cannot meet.

If approved, the phase should:

- wrap the shared responsive application rather than copy ERP feature code;
- define environment and deep-link allowlists;
- keep authentication and role enforcement server-side;
- expose native capabilities only through reviewed, minimal plugins;
- establish signed debug/internal builds before any store work;
- define update compatibility between wrapper and deployed web/API versions;
- exclude live push until consent, provider, template, unsubscribe, and delivery-evidence requirements are approved.

Focused QA must cover real Android devices, install/update, deep links, session lifecycle, uploads/downloads, network failure, privacy-safe diagnostics, and wrapper/web version mismatch.

## iOS/iPadOS phase

`IOS-IPADOS-PREP-1A — iOS/iPadOS Preparation and Signing Readiness` follows Android/PWA evidence. Planning may occur on MSI, but final build, signing, entitlement validation, simulator/device testing, and distribution require a Mac with a supported Xcode environment.

Required inputs include:

- Apple Developer/account ownership decision;
- bundle ID and signing ownership;
- certificate/profile and key-custody process;
- privacy manifest and data-use review;
- iPhone/iPad device matrix;
- App Store, private distribution, or internal-only decision;
- Mac/Xcode availability and named release owner.

Focused QA must include iPhone and iPad layouts, safe areas, keyboard behaviour, Safari/PWA parity, authentication/session lifecycle, file flows, signing/entitlements, update/rollback expectations, and privacy disclosure accuracy.

## Mobile dependencies and deferrals

- Universal search and Command Center features should remain shared web features, not mobile-only implementations.
- Citation-based Smart AI remains `DEFERRED_TO_V2`; a native shell does not accelerate its evidence or permission gates.
- Live WhatsApp, email, SMS, payment, and push providers remain separate operational work.
- Native apps must not block private staging, real-data preparation, training, pilot, or cutover unless device certification identifies a material school requirement.

## No-authority statement

This roadmap does not authorise deployment, store registration, signing-key creation, provider activation, real-data import, real-user activation, or public release.
