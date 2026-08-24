# Account Takeover Runbook

## Detection and severity

Signals include credential stuffing, login/recovery/OTP rate hits, successful login after distributed failures, unfamiliar session summaries, repeated role/permission denial, recovery changes, privileged role changes, and disabled-account attempts. Never log passwords, tokens, recovery codes, or full network identifiers.

Critical means confirmed privileged takeover or finance/Student integrity impact. High means confirmed user takeover or credible privileged attempt. Medium means contained stuffing/recovery abuse without takeover.

## Immediate containment

Revoke the affected session registry entries and rotate credentials through the approved private recovery workflow. For privileged or uncertain scope, revoke all subject sessions, rotate credential version, suspend risky provider actions, preserve role/permission state and enable tighter account/source limits. Do not reveal whether an unknown public identifier exists.

Review role assignments, aliases, recovery channels, recent writes, exports, audit chains and provider activity. If insider privilege abuse is possible, separate incident leadership from the suspected operator and preserve evidence before access changes where safety permits.

## Communication and recovery

Use verified contact channels; never send credentials. Notify privacy/school leadership according to severity. Restore access only after identity verification, credential rotation, session revocation, role reconciliation and high-risk write review. Verify backup/recovery evidence if integrity may be affected.

## Post-incident review

Record root cause, authentication/recovery control behavior, session revocation evidence, affected objects, communication decisions, residual risk and follow-up owners. Do not infer that a successful reset proves no data was accessed.
