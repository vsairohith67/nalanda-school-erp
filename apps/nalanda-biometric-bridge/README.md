# Nalanda Biometric Bridge 1A

This private-LAN Windows service foundation polls only configured allow-listed addresses, normalizes attendance metadata, encrypts its durable queue with AES-256-GCM, signs HTTPS batches with a rotating Ed25519 bridge credential, retries idempotently, and writes privacy-safe local health to a file. It opens no listening port and contains no LAN scanning.

`SIMULATOR` and governed `GENERIC_CSV_IMPORT` are active software adapters. `GENERIC_ADMS_PUSH` and `GENERIC_LAN_POLL` are provider-neutral slots that throw `GENERIC_ADAPTER_CONTRACT_NOT_CONFIGURED` until an approved public adapter contract is configured. `ESSL_K30_PRO_PUSH`, `ESSL_ZK_LAN_SDK`, and `ZK_ADMS_PUSH` deliberately throw `VENDOR_PROTOCOL_NOT_VERIFIED` until lawful official documentation or an SDK is reviewed. Do not copy a vendor biometric database into this bridge.

The encrypted queue records received, queued, sending, acknowledged or duplicate-acknowledged, rejected, and administrator-review states. Pending punches are never pruned before server acknowledgement. Acknowledged metadata is bounded to seven days and 1,000 entries.

The generated JavaScript/service package is signing-capable but is not claimed to be Authenticode-signed in 1A. Production installation requires the school owner's code-signing certificate, signature verification, a restricted service account, machine-scoped secret injection, private firewall rules, and the separate `BIOMETRIC-HARDWARE-CERTIFICATION-1B` onsite gate.

`NALANDA_BIOMETRIC_QUEUE_KEY` is mandatory and must be a stable, independently generated 32-byte base64url machine secret. The simulator refuses to create a one-use fallback because that would make an existing queue unrecoverable. The service installer records only the config path; the queue key and bridge-key version must be injected separately through the school's governed machine-secret procedure.
