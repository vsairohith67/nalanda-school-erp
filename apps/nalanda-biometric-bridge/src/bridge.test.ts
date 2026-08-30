import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { VendorProtocolDisabledAdapter } from "./adapters/vendor-disabled.js";
import { GenericCsvAdapter, parseGenericCsv } from "./adapters/csv.js";
import { SIMULATOR_SCENARIOS, simulateScenario } from "./adapters/simulator.js";
import { EncryptedDurableQueue } from "./encrypted-queue.js";
import { validateNormalizedEvent } from "./contracts.js";

const temporaryDirectories: string[] = [];
afterEach(() => { while (temporaryDirectories.length) rmSync(temporaryDirectories.pop()!, { recursive: true, force: true }); });

describe("Nalanda biometric bridge foundation", () => {
  it("provides every deterministic 1A simulator scenario including the 80 Staff burst", () => {
    expect(SIMULATOR_SCENARIOS).toEqual(expect.arrayContaining([
      "normal", "duplicate", "repeated-batch", "exact-replay", "changed-replay", "late-arrival", "out-of-order-logs", "offline-backlog", "bridge-restart",
      "clock-drift-plus-5", "clock-drift-minus-5", "severe-clock-drift", "unknown-staff", "inactive-staff", "revoked-bridge", "revoked-device",
      "missing-in", "missing-out", "multiple-punches", "holiday-punch", "approved-leave-punch", "sequence-reset", "malformed", "oversized-event",
      "timeout-before-commit", "timeout-after-commit", "morning-burst-80", "evening-burst-80", "week-backlog", "month-load"
    ]));
    const first = simulateScenario("morning-burst-80", "00000000-0000-4000-8000-000000000001");
    const second = simulateScenario("morning-burst-80", "00000000-0000-4000-8000-000000000001");
    expect(first).toEqual(second);
    expect(first).toHaveLength(80);
    expect(simulateScenario("evening-burst-80", first[0].deviceId)).toHaveLength(80);
    expect(simulateScenario("week-backlog", first[0].deviceId)).toHaveLength(1_120);
    expect(simulateScenario("month-load", first[0].deviceId)).toHaveLength(4_800);
    expect(new Set(first.map((event) => event.opaqueDeviceUserId)).size).toBe(80);
    expect(simulateScenario("normal", first[0].deviceId).map(validateNormalizedEvent)).toHaveLength(2);
    expect(() => validateNormalizedEvent(simulateScenario("malformed", first[0].deviceId)[0])).toThrow("NORMALIZED_EVENT_ID_INVALID");
  });

  it("encrypts the durable queue and authenticates it against tampering", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "nalanda-biometric-queue-"));
    temporaryDirectories.push(directory);
    const file = path.join(directory, "queue.enc");
    const key = Buffer.alloc(32, 7).toString("base64url");
    const queue = new EncryptedDurableQueue(file, key);
    const events = simulateScenario("normal", "00000000-0000-4000-8000-000000000001").map((event) => ({ ...event, queuedAt: "2026-08-28T00:00:00.000Z", localState: "RECEIVED_FROM_DEVICE" as const, attemptCount: 0 }));
    queue.append(events);
    expect(queue.size()).toBe(2);
    queue.append(events);
    expect(queue.size()).toBe(2);
    expect(readFileSync(file, "utf8")).not.toContain("STAFF-001");
    expect(() => new EncryptedDurableQueue(file, Buffer.alloc(32, 8).toString("base64url")).load()).toThrow();
    queue.markSending(1);
    expect(queue.peek()[0].localState).toBe("SENDING");
    queue.acknowledge(1);
    expect(queue.peek()).toHaveLength(1);
    expect(queue.history()).toMatchObject([{ localState: "ACKNOWLEDGED" }]);
    queue.markSending(1);
    queue.acknowledge(1, true);
    expect(queue.size()).toBe(0);
    expect(queue.history().map((event) => event.localState)).toEqual(expect.arrayContaining(["ACKNOWLEDGED", "DUPLICATE_ACKNOWLEDGED"]));
  });

  it("keeps vendor adapters disabled without lawful official protocol proof", async () => {
    const adapter = new VendorProtocolDisabledAdapter("ESSL_K30_PRO_PUSH");
    await expect(adapter.poll({ deviceId: "00000000-0000-4000-8000-000000000001", host: "192.168.1.30", port: 4370, profile: "ESSL_K30_PRO_PUSH" })).rejects.toThrow("VENDOR_PROTOCOL_NOT_VERIFIED");
  });

  it("parses only the fixed provider-neutral CSV contract", () => {
    const header = "opaqueDeviceUserId,punchTimestamp,verificationMethod,punchCode,statusCode,sequenceNumber,sequenceEpoch,eventReference";
    const source = `${header}\nSTAFF-001,2026-08-28T02:30:00.000Z,FINGERPRINT,IN,,1,1,CSV-1`;
    expect(parseGenericCsv(source, "00000000-0000-4000-8000-000000000001")).toMatchObject([{ opaqueDeviceUserId: "STAFF-001", punchCode: "IN", protocolProfile: "GENERIC_CSV_IMPORT" }]);
    expect(() => parseGenericCsv(`${header},fingerprintTemplate\nrow`, "00000000-0000-4000-8000-000000000001")).toThrow("CSV_IMPORT_HEADER_INVALID");
    expect(() => parseGenericCsv(`${header}\nSTAFF-001,2026-08-28T02:30:00.000Z,FINGERPRINT,IN,,NaN,1,CSV-1`, "00000000-0000-4000-8000-000000000001")).toThrow("CSV_IMPORT_INTEGER_INVALID");
    expect(() => parseGenericCsv(`${header}\nSTAFF-001,2026-08-28T02:30:00.000Z,FINGERPRINT,IN,fingerprintTemplate,1,1,CSV-1`, "00000000-0000-4000-8000-000000000001")).toThrow("CSV_IMPORT_METADATA_INVALID");
  });

  it("acknowledges a CSV only after its events are durably queued", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "nalanda-biometric-csv-"));
    temporaryDirectories.push(directory);
    const file = path.join(directory, "punches.csv");
    const header = "opaqueDeviceUserId,punchTimestamp,verificationMethod,punchCode,statusCode,sequenceNumber,sequenceEpoch,eventReference";
    writeFileSync(file, `${header}\nSTAFF-001,2026-08-28T02:30:00.000Z,FINGERPRINT,IN,,1,1,CSV-1`);
    const device = { deviceId: "00000000-0000-4000-8000-000000000001", host: "127.0.0.1", port: 1, profile: "GENERIC_CSV_IMPORT" as const, csvInbox: file };
    const adapter = new GenericCsvAdapter();
    const events = await adapter.poll(device);
    expect(events).toHaveLength(1);
    await adapter.acknowledgePoll(device, events);
    expect(await adapter.poll(device)).toHaveLength(0);
    writeFileSync(file, `${header}\nSTAFF-002,2026-08-28T02:31:00.000Z,FINGERPRINT,IN,,2,1,CSV-2`);
    expect(await adapter.poll(device)).toHaveLength(1);
  });
});
