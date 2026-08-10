# Release Approval Guide

## Director

The Director may view the concise candidate, maintenance impact, approval gate and rollback readiness under the exact summary permission. Approval means the named candidate and evidence were reviewed; it does not authorise provider purchase, DNS, deployment or real-data onboarding. Record approval only when all required gates, owner and window are complete.

## Super Admin/operator

The full Release Operations view exposes privacy-safe gates, feature-flag defaults and append-only local history. Execute/rollback/flag management are separate Super Admin-only non-delegable permissions and require re-authentication in any future mutation surface. This implementation provides a read-only UI and local CLI; it provides no remote command interface and no state-changing GET.

Reject approval for missing/waived-without-governance evidence, destructive migration, untested restore, asset mismatch, client incompatibility, stale lock, unresolved security scan, missing rollback owner or unauthorised production/provider scope.
