import { describe, expect, it } from "vitest";
import { protectedCloudBackupRunReasons } from "../lib/cloud-backup-retention";

function run(id: string, completedAt: string) {
  const date = new Date(completedAt);
  return { id, completedAt: date, createdAt: date };
}

describe("cloud backup retention recovery-point protection", () => {
  it("protects latest copies plus one India-local daily, weekly, and monthly recovery point", () => {
    const runs = [
      run("today-newest", "2026-07-19T05:30:00.000Z"),
      run("today-older", "2026-07-19T04:30:00.000Z"),
      run("yesterday", "2026-07-18T05:30:00.000Z"),
      run("prior-week", "2026-07-10T05:30:00.000Z"),
      run("prior-month", "2026-06-15T05:30:00.000Z")
    ];
    const reasons = protectedCloudBackupRunReasons(runs, {
      keepLatestVerifiedCount: 2,
      keepDailyDays: 2,
      keepWeeklyWeeks: 2,
      keepMonthlyMonths: 2
    }, new Date("2026-07-19T06:30:00.000Z"));

    expect(reasons.get("today-newest")?.has("LATEST_VERIFIED")).toBe(true);
    expect(reasons.get("today-older")?.has("LATEST_VERIFIED")).toBe(true);
    expect(reasons.get("yesterday")?.has("DAILY_RECOVERY_POINT")).toBe(true);
    expect(reasons.get("prior-week")?.has("WEEKLY_RECOVERY_POINT")).toBe(true);
    expect(reasons.get("prior-month")?.has("MONTHLY_RECOVERY_POINT")).toBe(true);
  });

  it("allows recovery-point buckets to be disabled without weakening latest-copy protection", () => {
    const reasons = protectedCloudBackupRunReasons([
      run("one", "2026-07-19T05:30:00.000Z"),
      run("two", "2026-07-18T05:30:00.000Z"),
      run("three", "2026-07-17T05:30:00.000Z")
    ], {
      keepLatestVerifiedCount: 2,
      keepDailyDays: 0,
      keepWeeklyWeeks: 0,
      keepMonthlyMonths: 0
    }, new Date("2026-07-19T06:30:00.000Z"));

    expect([...reasons.keys()]).toEqual(["one", "two"]);
  });
});
