# Signing and store boundary

`CROSS-PLATFORM-APPS-1A` contains no production signing key, certificate, provisioning profile, keystore password, Apple account, store credential, or release-publishing automation.

Allowed outputs are private unsigned development/QA packages and simulator artifacts with checksums and bounded retention. They are not safe for public distribution.

Separately governed future work is required for:

- Windows Authenticode and Microsoft Store submission;
- Android release keystore, Play App Signing, Play Console policy, and store listing;
- iOS distribution certificates, provisioning, entitlements review, TestFlight, and App Store review;
- privacy disclosures, support ownership, update policy, rollback policy, and physical-device acceptance.

The foundation release never implies any store publication or operational activation.

