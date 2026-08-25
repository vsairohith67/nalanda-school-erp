import { describe, expect, it } from "vitest";
import { nativeRequestProofMessage, versionAtLeast } from "./auth";

describe("native protocol client", () => {
  it("matches the server Offline Sync proof contract", () => {
    expect(nativeRequestProofMessage({
      method: "POST",
      path: "/api/native/v1/sync",
      timestamp: "1787700000000",
      nonce: "nonce_nonce_nonce_nonce",
      bodyHash: "a".repeat(64),
      publicDeviceId: "00000000-0000-4000-8000-000000000001",
      keyVersion: 2
    })).toBe([
      "offline-sync-request-v1",
      "POST",
      "/api/native/v1/sync",
      "1787700000000",
      "nonce_nonce_nonce_nonce",
      "a".repeat(64),
      "00000000-0000-4000-8000-000000000001",
      "2",
      "1"
    ].join("\n"));
  });

  it("compares three-part app/server versions fail closed", () => {
    expect(versionAtLeast("1.2.0", "1.1.9")).toBe(true);
    expect(versionAtLeast("1.0.0", "1.0.0")).toBe(true);
    expect(versionAtLeast("0.9.9", "1.0.0")).toBe(false);
    expect(() => versionAtLeast("latest", "1.0.0")).toThrow("invalid");
  });
});
