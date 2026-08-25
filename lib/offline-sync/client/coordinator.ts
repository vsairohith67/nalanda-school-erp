"use client";

import { readLocal, writeLocal } from "@/lib/offline-sync/client/database";
import { lockOfflineVault } from "@/lib/offline-sync/client/crypto";

const LOCK_NAME = "nps-offline-finance-sync-v1";
const CHANNEL_NAME = "nps-offline-finance-v1";
const VAULT_LOCK_EVENT = "nalanda:offline-vault-lock";
const VAULT_LOCK_STORAGE_KEY = "nalanda:offline-vault-lock-signal";
const LEASE_MS = 45_000;
type Lease = { id: typeof LOCK_NAME; owner: string; expiresAt: number };

async function withLease<T>(task: () => Promise<T>): Promise<T> {
  const owner = crypto.randomUUID();
  const current = await readLocal<Lease>("coordination", LOCK_NAME);
  if (current && current.expiresAt > Date.now()) throw new Error("SYNC_ALREADY_RUNNING_IN_ANOTHER_TAB");
  await writeLocal<Lease>("coordination", { id: LOCK_NAME, owner, expiresAt: Date.now() + LEASE_MS });
  const confirmed = await readLocal<Lease>("coordination", LOCK_NAME);
  if (!confirmed || confirmed.owner !== owner) throw new Error("SYNC_ALREADY_RUNNING_IN_ANOTHER_TAB");
  try { return await task(); }
  finally {
    const latest = await readLocal<Lease>("coordination", LOCK_NAME);
    if (latest?.owner === owner) await writeLocal<Lease>("coordination", { id: LOCK_NAME, owner: "released", expiresAt: 0 });
  }
}

export async function withOfflineSyncLock<T>(task: () => Promise<T>) {
  const locks = navigator.locks;
  if (locks) return locks.request(LOCK_NAME, { mode: "exclusive", ifAvailable: true }, async (lock) => {
    if (!lock) throw new Error("SYNC_ALREADY_RUNNING_IN_ANOTHER_TAB");
    return task();
  });
  return withLease(task);
}

export function announceOfflineState(detail: Record<string, unknown>) {
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME); channel.postMessage({ type: "STATE", ...detail }); channel.close();
  }
  window.dispatchEvent(new CustomEvent("nalanda:pwa-unsafe-activity", { detail: { active: Boolean(detail.pending) } }));
}

function applyVaultLock(reason: string) {
  lockOfflineVault();
  window.dispatchEvent(new CustomEvent(VAULT_LOCK_EVENT, { detail: { reason } }));
}

export function lockOfflineVaultAcrossTabs(reason: "LOGOUT" | "CONTEXT_SWITCH" | "MANUAL_LOCK") {
  applyVaultLock(reason);
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME); channel.postMessage({ type: "VAULT_LOCK", reason }); channel.close();
  }
  try {
    window.localStorage.setItem(VAULT_LOCK_STORAGE_KEY, JSON.stringify({ reason, nonce: crypto.randomUUID() }));
  } catch {
    // BroadcastChannel remains the primary transport when storage is unavailable.
  }
}

export function installOfflineVaultLockListener() {
  const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;
  const listener = (event: MessageEvent<{ type?: string; reason?: string }>) => {
    if (event.data?.type === "VAULT_LOCK") applyVaultLock(event.data.reason ?? "REMOTE_LOCK");
  };
  const storageListener = (event: StorageEvent) => {
    if (event.key !== VAULT_LOCK_STORAGE_KEY || !event.newValue) return;
    try {
      const signal = JSON.parse(event.newValue) as { reason?: string };
      applyVaultLock(signal.reason ?? "REMOTE_LOCK");
    } catch {
      applyVaultLock("REMOTE_LOCK");
    }
  };
  channel?.addEventListener("message", listener);
  window.addEventListener("storage", storageListener);
  return () => {
    channel?.removeEventListener("message", listener);
    channel?.close();
    window.removeEventListener("storage", storageListener);
  };
}

export function onOfflineVaultLocked(listener: (reason: string) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<{ reason?: string }>).detail?.reason ?? "LOCKED");
  window.addEventListener(VAULT_LOCK_EVENT, handler);
  return () => window.removeEventListener(VAULT_LOCK_EVENT, handler);
}
