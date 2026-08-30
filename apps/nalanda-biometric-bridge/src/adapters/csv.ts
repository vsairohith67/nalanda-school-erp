import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DeviceAdapter, ConfiguredDevice } from "./adapter.js";
import { validateNormalizedEvent, type NormalizedEvent } from "../contracts.js";

const MAX_CSV_BYTES = 2 * 1024 * 1024;

export class GenericCsvAdapter implements DeviceAdapter {
  readonly profile = "GENERIC_CSV_IMPORT" as const; readonly officialProtocolRequired = false;
  async poll(device: ConfiguredDevice) {
    if (!device.csvInbox || !existsSync(device.csvInbox)) return [];
    const source = readBoundedCsv(device.csvInbox);
    if (readReceipt(device.csvInbox) === csvDigest(source)) return [];
    return parseGenericCsv(source, device.deviceId);
  }
  async acknowledgePoll(device: ConfiguredDevice, events: NormalizedEvent[]) {
    if (!device.csvInbox || !events.length || !existsSync(device.csvInbox)) return;
    const source = readBoundedCsv(device.csvInbox);
    const parsed = parseGenericCsv(source, device.deviceId);
    if (eventDigest(parsed) !== eventDigest(events)) throw new Error("CSV_IMPORT_CHANGED_DURING_QUEUE");
    writeReceipt(device.csvInbox, csvDigest(source));
  }
}

export function parseGenericCsv(source: string, deviceId: string): NormalizedEvent[] {
  if (Buffer.byteLength(source, "utf8") > MAX_CSV_BYTES) throw new Error("CSV_IMPORT_TOO_LARGE");
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean); if (lines.length < 2 || lines.length > 20_001) throw new Error("CSV_IMPORT_ROWS_INVALID");
  const header = split(lines[0]).map((value) => value.trim()); const expected = ["opaqueDeviceUserId", "punchTimestamp", "verificationMethod", "punchCode", "statusCode", "sequenceNumber", "sequenceEpoch", "eventReference"];
  if (header.join("|") !== expected.join("|")) throw new Error("CSV_IMPORT_HEADER_INVALID");
  const receivedAt = new Date().toISOString();
  return lines.slice(1).map((line) => { const row = split(line); if (row.length !== expected.length) throw new Error("CSV_IMPORT_ROW_INVALID"); const sequence = row[5].trim(); return validateNormalizedEvent({ deviceId, opaqueDeviceUserId: row[0].trim(), punchTimestamp: normalizedTimestamp(row[1]), bridgeReceivedTimestamp: receivedAt, estimatedClockDriftSeconds: null, verificationMethod: allowed(row[2], ["FINGERPRINT", "FACE", "CARD", "PIN", "OTHER"]) as NormalizedEvent["verificationMethod"], punchCode: allowed(row[3], ["IN", "OUT", "UNKNOWN"]) as NormalizedEvent["punchCode"], statusCode: optionalMetadata(row[4], 80), sequenceNumber: sequence ? integer(sequence, 0, Number.MAX_SAFE_INTEGER) : null, sequenceEpoch: integer(row[6].trim() || "1", 1, 1_000_000), eventReference: optionalMetadata(row[7], 160), protocolProfile: "GENERIC_CSV_IMPORT" }); });
}
function split(line: string) { const values: string[] = []; let current = "", quoted = false; for (let i=0;i<line.length;i++){const char=line[i];if(char==='"'){if(quoted&&line[i+1]==='"'){current+='"';i++;}else quoted=!quoted;}else if(char===","&&!quoted){values.push(current);current="";}else current+=char;}if(quoted)throw new Error("CSV_IMPORT_QUOTE_INVALID");values.push(current);return values;}
function allowed(value:string, choices:string[]){const text=value.trim().toUpperCase();if(!choices.includes(text))throw new Error("CSV_IMPORT_VALUE_INVALID");return text;}
function normalizedTimestamp(value: string) { const text = value.trim(), date = new Date(text); if (text.length < 20 || text.length > 40 || Number.isNaN(date.getTime())) throw new Error("CSV_IMPORT_TIMESTAMP_INVALID"); return date.toISOString(); }
function integer(value: string, min: number, max: number) { const parsed = Number(value); if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new Error("CSV_IMPORT_INTEGER_INVALID"); return parsed; }
function optionalMetadata(value: string, max: number) { const text = value.trim(); if (!text) return null; if (text.length > max || !/^[A-Za-z0-9._:@/-]+$/.test(text) || /(fingerprint|face|biometric|template|image|secret|password|privatekey)/i.test(text)) throw new Error("CSV_IMPORT_METADATA_INVALID"); return text; }
function readBoundedCsv(file: string) { const stat = statSync(file); if (!stat.isFile() || stat.size > MAX_CSV_BYTES) throw new Error("CSV_IMPORT_TOO_LARGE"); const source = readFileSync(file, "utf8"); if (Buffer.byteLength(source, "utf8") > MAX_CSV_BYTES) throw new Error("CSV_IMPORT_TOO_LARGE"); return source; }
function receiptPath(file: string) { return `${file}.nalanda-consumed.sha256`; }
function readReceipt(file: string) { try { const value = readFileSync(receiptPath(file), "utf8").trim(); return /^[a-f0-9]{64}$/.test(value) ? value : null; } catch { return null; } }
function writeReceipt(file: string, digest: string) { const receipt = receiptPath(file), temporary = `${receipt}.${process.pid}.partial`; mkdirSync(path.dirname(receipt), { recursive: true }); writeFileSync(temporary, `${digest}\n`, { encoding: "utf8", mode: 0o600, flag: "w" }); renameSync(temporary, receipt); }
function csvDigest(source: string) { return createHash("sha256").update(source).digest("hex"); }
function eventDigest(events: NormalizedEvent[]) { return createHash("sha256").update(JSON.stringify(events.map(({ bridgeReceivedTimestamp: _, estimatedClockDriftSeconds: __, ...event }) => event))).digest("hex"); }
