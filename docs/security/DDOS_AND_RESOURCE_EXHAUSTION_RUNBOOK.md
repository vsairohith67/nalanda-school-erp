# DDoS and Resource Exhaustion Runbook

## Detection and severity

Detect abnormal edge request/connection volume, 429/503 rate, origin CPU/memory, event-loop latency, queue saturation, database pool wait, slow requests, upload rejects, provider cost and health success. Do not include request bodies or private records. Severity is Critical for sustained availability loss or uncontrolled spend/data risk, High for material degradation or repeated bypass, Medium for contained abuse with adequate capacity, and Low for unsuccessful reconnaissance.

## Immediate containment

Declare incident ownership and time. Preserve edge/origin metrics, configuration versions, deployment SHA and privacy-safe security events. Enable the reviewed under-attack policy; tighten anonymous login/recovery/public-form/upload/expensive-work rules; shed new HIGH work; keep content-free health and safe authentication/recovery available where possible. Do not restart repeatedly, open the origin, disable authorization, create an unbounded queue, or silently discard committed writes.

For Layer 3/4 saturation, escalate to the managed edge/provider because application controls cannot absorb it. For Layer 7 abuse, use endpoint-specific edge rules and the application actor/cost budgets. For slow requests, shorten edge header/body/idle timeouts within tested values. For database exhaustion, shed expensive reads/writes, stop nonessential workers, and preserve transaction integrity.

## Communication and evidence

Use the incident channel and approved school communications owner. State observed impact and uncertainty; never claim immunity. Record commands, approvals, timestamps, traffic summaries and configuration diffs. Protect logs from alteration and restrict access.

## Recovery

Confirm burst decline, healthy queue/database pool, bounded memory/CPU, successful health/auth probes, and normal 429/503 recovery. Re-enable expensive work gradually. Verify backup freshness and perform isolated restore when integrity is in doubt. Review unexpected provider cost before restoring provider actions.

## Post-incident review

Within the agreed review window, document entry vector, affected policy, detection delay, containment, legitimate-user impact, cost, evidence retention, residual risk, policy/test changes, owner and due date. Expire emergency country/ASN blocks and under-attack mode deliberately.
