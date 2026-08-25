# Offline Finance Drafts — User and Operations Guide

## What Accountants see

The navigation item appears only after the feature is separately enabled and the signed-in role is Accountant or Super Admin. A new browser first asks for a plain device label. It generates its own signing key, sends only the public key to Nalanda ERP and waits for Super Admin approval.

After approval, the Accountant creates a separate 6–12 digit offline PIN. The page explains that the school cannot recover this PIN and that resetting the browser deletes unsynchronized drafts. The workspace then offers:

- Refresh references while connected;
- Fee payment, Expense or Misc. income tabs;
- Encrypt and queue draft;
- Editing, queued, conflict and rejected counts;
- Sync queued drafts; and
- Lock.

Browser “online” is only a hint. Sync first runs a private authenticated server check. Reconnection does not submit anything automatically.

## Official-record language

Every draft screen says drafts are not receipts. Successful sync returns the server-created receipt/expense reference. Conflict or rejected states never show an invented official number. Accepted draft payloads are removed from the draft and outbox stores; only an encrypted safe result remains for 90 days.

## Super Admin procedure

1. Confirm the request with the named Accountant and physical device.
2. Open **Offline Device Governance**.
3. Check label, platform summary and request time.
4. Approve only the expected device. The user can have at most the configured cap.
5. For a lost or suspected device, choose **Revoke / lost**, record a meaningful reason and tell the Accountant to reconnect on any remaining device.
6. Use **Retire** for a planned replacement. Terminal devices are never reactivated; register a new identity instead.
7. Device key rotation is initiated from the old active device and proves possession of both old and new keys.

## Conflict procedure

Director, Principal or Super Admin can view only safe conflict metadata: operation type, code, Accountant, device and timestamps. They record an acknowledgment, revised-draft decision or discard decision with a note. Review does not force a transaction. The Accountant must correct and queue a new mutation when a current record is still required.

## Lost PIN or corrupt browser data

Select **Reset this browser’s offline data** only after checking whether queued work can be recreated. Reset deletes the Nalanda offline IndexedDB database, including wrapped keys, draft content, reference packs and local accepted history. It does not delete server receipts or other browser databases. Register again and obtain approval if the device identity was removed.

## Rollout and rollback

Software release keeps `offline-sync-1a` false at 0%. A later operational activation requires a separate approved change, named owner, limited cohort, monitoring and training. Rollback sets rollout to zero/default-off and revokes affected devices if compromise is suspected. Existing server records remain authoritative. Do not delete audit/idempotency tables during rollback.
