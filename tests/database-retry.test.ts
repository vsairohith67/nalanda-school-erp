import { describe, expect, it, vi } from "vitest";
import { isRetryableDatabaseConflict, publicDatabaseError, withDatabaseRetry } from "../lib/database-retry";

describe("bounded database retry", () => {
  it("retries only recognized serialization/deadlock failures", async () => {
    const operation = vi.fn().mockRejectedValueOnce(Object.assign(new Error("serialization 40001"), { code: "P2034" })).mockResolvedValue("ok");
    const events: unknown[] = [];
    await expect(withDatabaseRetry(operation, { baseDelayMs: 0, random: () => 0, logger: (event) => events.push(event) })).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(events).toHaveLength(1);
  });

  it("does not retry business or validation failures", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("authorization denied"));
    await expect(withDatabaseRetry(operation, { baseDelayMs: 0 })).rejects.toThrow("authorization denied");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("stops at the configured bound and exposes only safe public errors", async () => {
    const conflict = Object.assign(new Error("private table details 40P01"), { code: "P2034" });
    const operation = vi.fn().mockRejectedValue(conflict);
    await expect(withDatabaseRetry(operation, { maxAttempts: 2, baseDelayMs: 0 })).rejects.toBe(conflict);
    expect(operation).toHaveBeenCalledTimes(2);
    expect(isRetryableDatabaseConflict(conflict)).toBe(true);
    expect(publicDatabaseError(conflict)).toEqual({ code: "RETRY_LATER", status: 409, message: "The record changed concurrently. Please retry." });
    expect(publicDatabaseError(Object.assign(new Error("secret sql"), { code: "P1001" }))).toEqual({ code: "DATABASE_TEMPORARILY_UNAVAILABLE", status: 503, message: "The service is temporarily unavailable." });
  });
});
