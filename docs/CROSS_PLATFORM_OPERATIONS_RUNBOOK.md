# Cross-Platform Apps operations runbook

The committed app profile is `NO_REMOTE_SERVER_CONFIGURED`; `CROSS_PLATFORM_APPS_1A=OFF`, `OFFLINE_SYNC_1A=OFF`, and both rollouts are 0%. Do not configure staging or production origins, enable either flag, enrol users/devices, install real signing material, or import real data under this runbook.

For local synthetic QA, use a copied database, explicit local profile, loopback origin, synthetic identities, and unsigned packages. Record the operational database size and SHA-256 before and after; require byte identity. Remove copied databases, local vaults, test tokens, debug logs, and packages outside approved evidence/artifact locations when finished.

If a device is revoked or a refresh token is replayed, the server denies new access and revokes the native session/token family. The app must lock when it observes that state, but server revocation is not remote wipe: an owner must use the explicit local reset or authorized operating-system app-data reset to erase device material before a new approved bootstrap. If the app/server version is incompatible, the server is unavailable, or either flag is OFF, preserve encrypted drafts and show the fail-closed state without pretending synchronization succeeded.

Next gates are `POSTGRES-READINESS-1A`, then `PRIVATE-STAGING-1B`, then `CROSS-PLATFORM-APPS-1B`. Distribution gates are `WINDOWS-SIGNING-STORE-1A`, `ANDROID-PLAY-READINESS-1A`, and `IOS-TESTFLIGHT-READINESS-1A`.
