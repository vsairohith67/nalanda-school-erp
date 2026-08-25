import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ lockOfflineVault: vi.fn() }));

vi.mock("@/lib/offline-sync/client/crypto", () => ({
  lockOfflineVault: mocks.lockOfflineVault
}));

vi.mock("@/lib/offline-sync/client/database", () => ({
  readLocal: vi.fn(),
  writeLocal: vi.fn()
}));

import {
  installOfflineVaultLockListener,
  lockOfflineVaultAcrossTabs,
  onOfflineVaultLocked
} from "@/lib/offline-sync/client/coordinator";

const VAULT_LOCK_STORAGE_KEY = "nalanda:offline-vault-lock-signal";

type FakeTab = EventTarget & {
  localStorage: { setItem: (key: string, value: string) => void };
};

function storageEvent(key: string, newValue: string) {
  const event = new Event("storage");
  Object.defineProperties(event, {
    key: { value: key },
    newValue: { value: newValue }
  });
  return event;
}

function crossTabWindows() {
  const tabs: FakeTab[] = [];
  const writes: Array<{ key: string; value: string }> = [];
  const createTab = () => {
    const tab = new EventTarget() as FakeTab;
    Object.defineProperty(tab, "localStorage", {
      value: {
        setItem(key: string, value: string) {
          writes.push({ key, value });
          const sender = globalThis.window;
          for (const peer of tabs) {
            if (peer === sender) continue;
            globalThis.window = peer as unknown as Window & typeof globalThis;
            peer.dispatchEvent(storageEvent(key, value));
          }
          globalThis.window = sender;
        }
      }
    });
    tabs.push(tab);
    return tab;
  };
  return { createTab, writes };
}

afterEach(() => {
  mocks.lockOfflineVault.mockReset();
  vi.unstubAllGlobals();
});

describe("offline vault cross-tab coordination", () => {
  it("locks another tab through the storage-event fallback when BroadcastChannel is unavailable", () => {
    const hub = crossTabWindows();
    const logoutTab = hub.createTab();
    const draftTab = hub.createTab();
    expect("BroadcastChannel" in logoutTab).toBe(false);
    expect("BroadcastChannel" in draftTab).toBe(false);

    vi.stubGlobal("window", draftTab);
    const receivedReasons: string[] = [];
    const removeListener = installOfflineVaultLockListener();
    const removeObserver = onOfflineVaultLocked((reason) => receivedReasons.push(reason));

    globalThis.window = logoutTab as unknown as Window & typeof globalThis;
    lockOfflineVaultAcrossTabs("LOGOUT");

    expect(hub.writes).toHaveLength(1);
    expect(hub.writes[0]?.key).toBe(VAULT_LOCK_STORAGE_KEY);
    expect(JSON.parse(hub.writes[0]?.value ?? "{}")).toMatchObject({ reason: "LOGOUT" });
    expect(mocks.lockOfflineVault).toHaveBeenCalledTimes(2);
    expect(receivedReasons).toEqual(["LOGOUT"]);

    globalThis.window = draftTab as unknown as Window & typeof globalThis;
    removeObserver();
    removeListener();
  });
});
