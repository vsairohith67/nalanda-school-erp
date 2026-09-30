# School-PC acceptance
**NOT EXECUTED — REQUIRES SEPARATE OWNER APPROVAL.**

This runbook is preparation only. Do not execute it on the owner's MSI laptop or school PC as part of 1A.

## Prerequisites and stop gates

Management must supply the exact official K30 SDK documentation/licence, version/hash, supported firmware/serial, architecture and redistribution rights. Admit documented read-only attendance calls only; verify prerequisites on a disposable Windows system before school installation. A DLL listing or simulated event is insufficient. Any x86 broker is a separately verified read-only package; no automatic global COM registration.

Admit an immutable signed complete package (host, Node, agent and dependency manifest), malware/dependency disposition, supported Windows x64 and locked .NET runtime. Stage versioned binaries under a task-owned Program Files directory and private host/bridge configs plus stable DPAPI secret under a unique ProgramData directory. Queue and health use separate child directories; report-export directory needs explicit private report access approval. Provision secrets by protected stdin only. Preserve queue key/version; never replace it after decryption failure.

Confirm separate management/admin and standard accountant identities. Confirm accountant is not a local administrator; if they are, stop and record the gate without changing membership. Verify actual service virtual identity can decrypt machine DPAPI and modify only queue/health. Under the standard account prove denial of binary/config/key/queue read or replacement and service privileged commands. Machine DPAPI alone offers no ACL isolation, and local administrators are outside this protection claim.

Owner must identify device ownership and approved school LAN access, private host/port/serial binding and communication secret. No home-network connection to a similarly addressed device. Preserve attendance logs and unknown directions/clocks. Authorize only retrieval; clock/IP/firmware/user/template/log-clear operations remain unavailable.

Approve stable ERP staff mappings, the private Word-order roster, Teaching/Non-Teaching include/exclude positions and month/version. Approve actual attendance-policy summaries and evidence-backed remarks. An XLSX reference or enrolment flag is insufficient. Admit serial ERP export/freshness work from ERP_INTEGRATION_PATCH.md before claiming live reports/long outage recovery.

## Installation and checks after approval

1. In an admitted disposable Windows VM/runner, run Preflight/Plan/Validate, verify package signatures, exact hashes, ownership, path permissions/reparse refusal and private data layout. Do not advance on a failed external-process exit.
2. Obtain explicit school-PC approval. Use companion.ps1 -Action Install -HostExe <signed absolute exe> -HostConfig <absolute private host json> -Apply -TargetComputer <exact machine> -ConfirmApply APPLY:<machine>. Default registration stays stopped; StartAfterInstall requires the same approved acceptance window. Verify SCM delayed Automatic start, unique virtual identity, service ACL and protected subtree owner.
3. Verify actual successful device poll, new punch identity/time preservation, durable encrypted queue, exact existing-protocol server ACK and independently checked ERP record. Assess updatedAt plus SCM/child ownership; processRunning or an unchanged old punch is insufficient.
4. Test stop/shutdown during wait and polling, child crash, host crash, bounded restarts and no orphan. Test power/reboot and operation after management/accountant logoff, with logs preserved. This task did not reboot any owner machine.
5. Test network-off boot, ERP timeout/rejection/lost ACK, repeated download and recovery, including beyond released ERP's 48-hour window. Confirm no loss/double-post; unresolved records stay reviewable. A held batch resumes only after owner revalidates server/credential gates, stops the owned service and uses explicitly applied Resume. No timestamps/body rewriting.
6. Test corrupt queue/wrong key/full disk; preserve original data and stop collection receipt advancement. Validate restart/upgrade decryptability with the same key and saved interval.
7. Export only from approved ERP monthly summary and approved order manifest, to the approved directory. Read back numeric cells/order/remarks; edited export must not write back to ledger.
8. Record every result with actual identity/version/hash, exact source checkpoint and private evidence references. Failed, blocked and not-executed are distinct. No hardware certification or parent task closure follows from source QA.

## Collector cutover and rollback

Keep the existing vendor collector until documented SDK read-only retrieval and ownership tests pass. In the approved window, stop the former collector and admit exactly one verified owner. Compare preserved terminal log identities and downstream totals; do not clear terminal history or write the Access MDB. This companion does not maintain eTimeTrackLite's database automatically.

Retain signed immutable prior packages/configs, stable key and protected queue; stop and verify zero owned workers before upgrade/rollback. Rollback revalidates prior signatures/hashes and restores owned service command, preserving data. If validation or SCM/ACL registration partially fails, leave stopped, record failure and inspect the ownership checkpoint; never overwrite an unrelated service. Non-destructive Uninstall removes only owned service registration and retains private files/ownership. No purge is implemented.

Reverting collector ownership requires management's controlled window and duplicate reconciliation. Template bidirectional mirroring remains NOT IMPLEMENTED and outside this acceptance.
