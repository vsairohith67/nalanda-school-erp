import { describe, expect, it } from "vitest";
import { indiaDateKey, nextCloudBackupDueAt, validateCloudBackupSchedule } from "../lib/cloud-backup-schedules";

const base = {
  intervalCount: 1,
  hourOfDay: null,
  minuteOfHour: 15,
  dayOfWeek: null,
  dayOfMonth: null,
  timezone: "Asia/Kolkata"
};

describe("database-backed cloud backup schedule calculation", () => {
  it("calculates India-local hourly, daily, weekly, and monthly due times", () => {
    const after = new Date("2026-07-19T04:50:00.000Z"); // 10:20 India, Sunday.
    expect(indiaDateKey(nextCloudBackupDueAt({ ...base, frequency: "HOURLY" } as never, after)!))
      .toBe("2026-07-19-11-15-00");
    expect(indiaDateKey(nextCloudBackupDueAt({ ...base, frequency: "DAILY", hourOfDay: 11 } as never, after)!))
      .toBe("2026-07-19-11-15-00");
    expect(indiaDateKey(nextCloudBackupDueAt({ ...base, frequency: "WEEKLY", hourOfDay: 9, dayOfWeek: 1 } as never, after)!))
      .toBe("2026-07-20-09-15-00");
    expect(indiaDateKey(nextCloudBackupDueAt({ ...base, frequency: "MONTHLY", hourOfDay: 8, dayOfMonth: 20 } as never, after)!))
      .toBe("2026-07-20-08-15-00");
  });

  it("supports manual-only and rejects unsupported timezones or unsafe month days", () => {
    expect(nextCloudBackupDueAt({ ...base, frequency: "MANUAL_ONLY" } as never)).toBeNull();
    expect(() => validateCloudBackupSchedule({ ...base, frequency: "DAILY", hourOfDay: 2, timezone: "UTC" } as never))
      .toThrow("Asia/Kolkata");
    expect(() => validateCloudBackupSchedule({ ...base, frequency: "MONTHLY", hourOfDay: 2, dayOfMonth: 31 } as never))
      .toThrow("month day");
  });

  it("advances from the exact due instant without duplicating it", () => {
    const exact = new Date("2026-07-19T05:30:00.000Z"); // 11:00 India.
    const due = nextCloudBackupDueAt({ ...base, frequency: "DAILY", hourOfDay: 11, minuteOfHour: 0 } as never, exact);
    expect(indiaDateKey(due!)).toBe("2026-07-20-11-00-00");
  });
});
