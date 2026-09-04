# Real-User Access Readiness 1A

Status: software foundation in release QA. Feature default: `OFF`; rollout: `0%`.

This phase prepares governed account rollout without creating or activating a real user, sending a real invitation, configuring a live delivery provider, or claiming private staging. Every exercised identity uses reserved synthetic data and every write-capable database check runs against a disposable copy or a fresh synthetic database.

## Delivered boundary

- separate person, account, assignment, active-role session and authenticator records;
- explicit request, review, approval, invitation, activation, certification, recovery and offboarding states;
- a 14-template machine-readable role catalogue derived from server permissions;
- preview-only bounded bulk preparation with duplicate, confusable, contact, formula and resource-limit validation;
- hash-only, purpose/user/invitation/environment-bound, short-lived one-time invitations with a loopback-only QA sink;
- guided server-owned activation requiring credential, MFA where mandatory, current training, draft policy acknowledgement and approved roles;
- encrypted-at-rest TOTP, hash-only one-time recovery codes, RP/origin-bound WebAuthn credentials and action/session-bound step-up;
- safe own-session/security views and narrowly authorised readiness administration;
- periodic certification, automatic temporary-access expiry, three-person MFA recovery and complete offboarding revocation;
- additive SQLite and PostgreSQL migrations plus secret-safe backup/restore handling.

## Fail-closed operating contract

`real-user-access-readiness-1a` remains false in `config/release-feature-flags.json`. The guarded routes return unavailable unless the server-owned flag and environment admit them. Existing users are not migrated into MFA, prepared records are not active, and no prior direct account path may bypass the governed workflow while the feature is enabled.

The activation decision is server-owned. It verifies the current person link, request/role snapshot, credential version, invitation, MFA requirement, training versions, policy version, eligibility and feature/environment state in one transaction. Client checkboxes or claimed state never activate an account.

## Durable and transient records

Durable records include access requests and decision history, invitation metadata, encrypted authenticators/public passkey material, recovery-code hashes, training/policy acknowledgements, access certifications, recovery decisions and privacy-safe security events. Transient activation sessions, MFA challenges and step-up grants are deliberately absent from backup.

## Roles and views

Super Admin has the governed administrative view. Principal and Director receive bounded oversight only through current server permissions. An explicitly delegated IAM operator can prepare but cannot silently approve. All other roles see only their own security/session state unless separately authorised. Computer Operator and Accountant receive no automatic IAM authority.

## Not cleared

- real roster intake or person matching;
- real usernames, contacts, devices, acknowledgements or MFA enrolment;
- Email, SMS, WhatsApp or identity-provider activation;
- a private repository, accepted private HTTPS staging, provider/region or production domain;
- physical-device passkey certification or app-store/package publication;
- any Parent, Student, Staff or leadership rollout wave.

The only permitted next execution is the separately approved prompt in `docs/prompts/REAL_USER_ACCESS_ACTIVATION_1B.md`, after every private-infrastructure, roster, policy, approver, provider, rehearsal and owner gate is evidenced.

