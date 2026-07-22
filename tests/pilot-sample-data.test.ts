import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generatePilotSampleData } from "../lib/pilot-sample-data";
import {
  PILOT_SAMPLE_DATE,
  PILOT_SAMPLE_EXPECTED_TOTALS
} from "../lib/pilot-sample-constants";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

describe("pilot sample CSV generation", () => {
  it("writes both sample files with required cases and an invalid row", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "nalanda-sample-data-"));
    temporaryDirectories.push(directory);
    const result = await generatePilotSampleData(directory);
    const students = await readFile(result.studentFile, "utf8");
    const payments = await readFile(result.paymentFile, "utf8");

    expect(result.outputDirectory).toBe(path.join(directory, "pilot-data", "sample-imports"));
    expect(students).toContain("Pilot Normal Student");
    expect(students).toContain("Faculty Child");
    expect(students).toContain(",IX,");
    expect(students).toContain("INVALID: missing admission number");
    expect(payments).toContain("Director Sir GPay");
    expect(payments).toContain("NPS Current Account UPI");
    expect(payments.match(/PILOT-R004/g)).toHaveLength(2);
    expect(payments).toContain("40000,Cash,Cash");
    expect(payments).toContain("11300,UPI,NPS Current Account UPI");
    expect(payments).toContain("28000,UPI,Director Sir GPay");
    expect(payments).toContain("INVALID: missing receipt and unknown admission number");
  });

  it("keeps sample date and expected totals aligned with the runbook", () => {
    expect(PILOT_SAMPLE_DATE).toBe("2026-06-20");
    expect(PILOT_SAMPLE_EXPECTED_TOTALS).toEqual({
      cash: 60000,
      directorGPay: 30300,
      npsCurrentAccountUpi: 11300,
      bankOther: 0,
      grandTotal: 101600
    });
  });
});
