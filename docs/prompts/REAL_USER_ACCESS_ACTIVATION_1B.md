# REAL-USER-ACCESS-ACTIVATION-1B — Future Governed Prompt

**DO NOT RUN. This file is a reviewable future prompt, not activation approval.**

## Objective

Activate the smallest explicitly approved real-user cohort through the already released Real-User Access Readiness foundation. Maintain least privilege, exact person links, multi-person approval, MFA/training gates, safe private delivery, rollback and post-activation review. Do not broaden the cohort or automatically start another wave.

## Mandatory preflight stop gate

Before receiving or processing any real roster, independently evidence all of the following:

1. repository visibility is private and independently verified;
2. a private HTTPS staging environment has passed acceptance on the exact intended release;
3. provider, region, data residency, retention, legal/privacy and incident responsibilities are approved;
4. the exact real roster is supplied through an approved secure channel, never chat, issue, public repository or CI artifact;
5. every person-link authority and duplicate-resolution owner is named;
6. requester, reviewer, approver and recovery approvers are named and eligible;
7. the exact role/scope/expiry matrix is approved;
8. current training modules and policy acknowledgement wording are approved;
9. role-specific MFA and recovery requirements are approved;
10. a real delivery provider is privately configured with safe templates, domain controls, bounce/abuse handling and no logged token;
11. a synthetic invitation and first-login rehearsal has passed in the same private environment;
12. a fresh backup, restore proof and written rollback plan have passed;
13. support, recovery, security monitoring and post-activation review owners are on duty;
14. the owner has approved this exact wave, cohort and time window in writing.

If any item is missing, ambiguous or stale, return `REAL_USER_ACCESS_ACTIVATION_1B_BLOCKED_PREFLIGHT` and stop before roster intake, account creation, provider delivery or feature activation.

## Safety boundaries

- Use one dedicated branch and physical worktree; fetch and verify latest authorised main.
- Do not copy the roster into Git, CI, screenshots, logs, tracker comments or generic exports.
- Hash the operational database and use a protected backup/rollback point before any mutation.
- Search existing person/account/link records; never match by name, contact or fuzzy score alone.
- Prepare preview first, resolve every duplicate/conflict, and require distinct human review/approval.
- Never email a password. Invitation tokens remain hash-only, one-use, bound and short-lived.
- Require current training, approved policy, exact role/scope and mandatory MFA before atomic activation.
- Preserve one active-role context, linked-child isolation, Teacher marks denials and last-Super-Admin safety.
- Monitor invitations, failures, sessions/devices, recovery, role changes and audit without secrets/private content.
- Do not activate a Parent or Student cohort before the Staff cohort is explicitly accepted.
- Do not deploy unrelated features, activate OCR, certify physical devices or publish app packages.

## Waves

| Wave | Cohort |
| --- | --- |
| 0 | Super Admin recovery and governance accounts |
| 1 | Principal, Director and limited office security administrators |
| 2 | Accountant and designated Computer/Attendance operators |
| 3 | Teachers and Staff |
| 4 | small Parent pilot |
| 5 | remaining Parents |
| 6 | Students only when approved School policy requires accounts |

For each wave: produce a named go/no-go record; securely validate the exact roster; preview preparation; record link/conflict decisions; approve; take a new rollback point; issue only that cohort; supervise first login/MFA/training; inspect linked-object and active-role scope; review sessions/devices and events; resolve failures; perform post-activation review; and close or roll back. Completion returns to `PENDING_OWNER_APPROVAL`; it does not schedule or begin the next wave.

## Required proof

Capture repository/private-staging/provider evidence, exact release and database hashes, roster custody without roster content, approval references, preparation counts, invitation delivery counts (no token/contact), activation/MFA/training aggregates, permission and linked-child checks, recovery and revocation drills, security findings, rollback outcome, post-activation observations and owner decision.

Terminal statuses: `REAL_USER_ACCESS_ACTIVATION_1B_WAVE_CLEARED`, `REAL_USER_ACCESS_ACTIVATION_1B_REQUIRES_FIXES`, `REAL_USER_ACCESS_ACTIVATION_1B_ROLLED_BACK`, `REAL_USER_ACCESS_ACTIVATION_1B_BLOCKED_PREFLIGHT`, or `REAL_USER_ACCESS_ACTIVATION_1B_BLOCKED_SECURITY`.

