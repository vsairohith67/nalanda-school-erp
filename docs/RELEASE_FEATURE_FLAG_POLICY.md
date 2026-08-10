# Release Feature-Flag Policy

`config/release-feature-flags.json` is the versioned default snapshot. Risky flags start false. Metadata includes stable key, description, environment, allowed roles, rollout percentage, schedule, owner, reason, version and history. Evaluation is server-side, environment/role/time/cohort bound and refuses unknown or stale versions. Emergency disable always wins.

Flags do not grant permissions, bypass ownership, reveal secrets to client bundles or permit Parent/Client self-enablement. Production override and audit machinery belongs to the private release state and future separately approved runtime configuration. New flags require an owner, expiry/review decision, tests and rollback action. Stale flags are removed through a reviewed release, never silently reinterpreted.
