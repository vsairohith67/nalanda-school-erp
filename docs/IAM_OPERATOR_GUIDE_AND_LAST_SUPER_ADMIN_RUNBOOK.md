# IAM-1A Operator Guide and Last-Super-Admin Runbook

## Normal account administration

1. Open **Named Users** and search by name, username, designation, status, or
   active role.
2. Create a pending account unless a governed invitation adapter or a
   temporary-password ceremony is explicitly approved.
3. Select the smallest base role. Treat the designation as a label, not a
   grant.
4. Link an existing active Staff record for Teacher access or an existing
   Guardian for Parent access. Do not create duplicate relationship records.
5. Prefer a reviewed reusable profile for common permissions. Use an
   individual allow only for a narrow exception and an individual deny for a
   deliberate restriction.
6. Review effective access in each role context. Object-scope notices mean the
   permission alone is not enough.
7. Enter a bounded operational reason, re-authenticate, and confirm the
   expected version before a critical change.
8. Confirm the access-history event and affected-session revocation.

Temporary passwords are entered only in hidden fields, communicated through
an approved offline ceremony, and never displayed again. If no safe activation
method exists, leave the account pending.

## Shared profile changes

Before editing or archiving a profile, review the affected-user count and each
current permission source. A shared change invalidates affected sessions.
Never turn a convenience profile into unrestricted administration. Clone the
profile when the intended audience differs materially.

## Last-Super-Admin runbook

The system must always retain at least one active owned Super Admin.

- The sole active Super Admin cannot be suspended or have the Super Admin role
  ended.
- Critical Super Admin access cannot be denied by profile or individual
  override.
- A non-Super-Admin cannot create or grant Super Admin.
- A Super Admin cannot change their own critical access. Another active Super
  Admin must perform the governed transition.
- Super-Admin creation or transition requires exact permission,
  re-authentication, reason, expected version, the safety lock, audit, and
  session invalidation.

For a planned ownership transition:

1. Verify the current owner and protected-account baseline.
2. Create the second named Super Admin using the approved activation ceremony.
3. Require the new owner to rotate the temporary password and complete a fresh
   login.
4. Verify both active sessions and effective Super Admin access.
5. From the second account, end or suspend the previous assignment with a
   reason.
6. Verify audit history, authorization-version change, stale-session refusal,
   and exactly one or more active owned Super Admins.

If any step fails, stop. Do not edit SQLite, role rows, session rows, or hashes
manually. Use the separately governed local recovery procedure only when the
normal ownership path is unavailable.

## Multi-role and family operation

Single-role users receive no picker. A Teacher + Parent user first changes the
active role to **Parent**, then chooses a linked child when more than one is
available. Child selection does not follow the user into Teacher context. If a
role or child link disappears, refresh and select from the remaining server
choices; do not retry with a copied handle or raw ID.

## Incident response

Suspend the account with a reason, confirm all sessions are revoked, inspect
access history, and preserve evidence. Do not retrieve or disclose a password.
Do not delete role/profile/override/audit rows. Provider activation, staging,
real-user onboarding, and Parent attendance/exam-timetable claims are outside
IAM-1A.
