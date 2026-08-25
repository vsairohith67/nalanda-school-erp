"use client";

export const OFFLINE_DB_NAME = "nps-offline-finance-v1";
export const OFFLINE_DB_VERSION = 1;
export type StoreName = "vault" | "drafts" | "outbox" | "references" | "accepted" | "device" | "coordination";

export type EncryptedLocalRecord = {
  id: string;
  cipherText: string;
  iv: string;
  aad: string;
  encryptionVersion: 1;
  status?: string;
  operationType?: string;
  updatedAt: number;
  expiresAt?: number;
};

export function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of ["vault", "drafts", "outbox", "references", "accepted", "device", "coordination"] as StoreName[]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("OFFLINE_DATABASE_OPEN_FAILED"));
  });
}

export async function readLocal<T>(store: StoreName, id: string): Promise<T | undefined> {
  const db = await openOfflineDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const request = db.transaction(store, "readonly").objectStore(store).get(id);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

export async function writeLocal<T>(store: StoreName, value: T) {
  const db = await openOfflineDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(store, "readwrite");
      transaction.objectStore(store).put(value);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("OFFLINE_DATABASE_WRITE_ABORTED"));
    });
  } finally { db.close(); }
}

export async function deleteLocal(store: StoreName, id: string) {
  const db = await openOfflineDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(store, "readwrite");
      transaction.objectStore(store).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

export async function listLocal<T>(store: StoreName): Promise<T[]> {
  const db = await openOfflineDb();
  try {
    return await new Promise<T[]>((resolve, reject) => {
      const request = db.transaction(store, "readonly").objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

export function wipeOfflineDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(OFFLINE_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Close other Nalanda tabs before resetting offline data."));
  });
}
