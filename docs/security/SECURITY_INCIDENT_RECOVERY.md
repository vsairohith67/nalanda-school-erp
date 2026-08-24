# Security Incident Recovery

## Recovery authority and evidence

Assign incident commander, operations lead, evidence custodian, privacy/communication owner and recovery approver. Freeze destructive cleanup until evidence is captured. Record exact release SHA, configuration versions, database and backup hashes, timestamps, actor approvals and all containment changes. Keep passwords, tokens, full records, AI prompts/context and private notes out of incident logs.

## Recovery sequence

1. Contain the relevant account, provider, edge/origin, queue or data path.
2. Preserve immutable/auditable evidence and capture the current recovery point.
3. Revoke affected sessions/credentials and rotate edge/origin/provider secrets as applicable.
4. Verify the selected encrypted/private backup locally; never upload a real backup during a rehearsal.
5. Restore twice into separate blank, migrated, isolated targets. Compare schema, semantic counts, audit immutability and expected hashes/evidence.
6. Prove the operational database bytes were not modified by rehearsal.
7. Rebuild/redeploy only an accepted exact head through the normal release gate; do not repair history or bypass CI.
8. Exercise health, authentication, authorization/IDOR, critical writes, exports, private storage, 429/503 degradation and recovery before resuming users.
9. Re-enable edge rules, workers and providers gradually with monitoring.

## Communication

State confirmed facts, affected service/data, current containment, user actions, uncertainty and next update time. Avoid unsupported security or DDoS guarantees. Coordinate legal/privacy notifications through authorised leadership.

## Closure

Close only after root cause and attack path are documented, access and data integrity are reconciled, two restores pass, monitoring is stable, emergency controls have owners/expiry, and follow-up work is tracked. A post-incident review records lessons, tests, policy changes, owners and dates.
