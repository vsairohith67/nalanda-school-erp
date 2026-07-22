import type { CloudBackupSchedule } from "@prisma/client";

export const CLOUD_BACKUP_TIMEZONE = "Asia/Kolkata";
const INDIA_OFFSET_MINUTES = 330;

type ScheduleShape = Pick<CloudBackupSchedule,
  "frequency" | "intervalCount" | "hourOfDay" | "minuteOfHour" |
  "dayOfWeek" | "dayOfMonth" | "timezone">;

export function validateCloudBackupSchedule(input: ScheduleShape) {
  if (!["HOURLY", "DAILY", "WEEKLY", "MONTHLY", "MANUAL_ONLY"].includes(input.frequency)) throw new Error("Unsupported backup frequency.");
  if (!Number.isInteger(input.intervalCount) || input.intervalCount < 1 || input.intervalCount > 365) throw new Error("Backup interval must be between 1 and 365.");
  if (input.timezone !== CLOUD_BACKUP_TIMEZONE) throw new Error("The first release supports only Asia/Kolkata schedules.");
  optionalRange(input.minuteOfHour, 0, 59, "minute");
  optionalRange(input.hourOfDay, 0, 23, "hour");
  optionalRange(input.dayOfWeek, 0, 6, "weekday");
  optionalRange(input.dayOfMonth, 1, 28, "month day");
  if (input.frequency === "DAILY" && input.hourOfDay == null) throw new Error("Daily schedules require an hour.");
  if (input.frequency === "WEEKLY" && (input.hourOfDay == null || input.dayOfWeek == null)) throw new Error("Weekly schedules require an hour and weekday.");
  if (input.frequency === "MONTHLY" && (input.hourOfDay == null || input.dayOfMonth == null)) throw new Error("Monthly schedules require an hour and day 1 through 28.");
}

export function nextCloudBackupDueAt(schedule: ScheduleShape, after = new Date()) {
  validateCloudBackupSchedule(schedule);
  if (schedule.frequency === "MANUAL_ONLY") return null;
  const local = indiaParts(after);
  const minute = schedule.minuteOfHour ?? 0;
  let candidate: Date;
  if (schedule.frequency === "HOURLY") {
    candidate = indiaDate(local.year, local.month, local.day, local.hour, minute);
    while (candidate <= after) candidate = new Date(candidate.getTime() + schedule.intervalCount * 60 * 60 * 1000);
    return candidate;
  }
  if (schedule.frequency === "DAILY") {
    candidate = indiaDate(local.year, local.month, local.day, schedule.hourOfDay!, minute);
    while (candidate <= after) candidate = addIndiaDays(candidate, schedule.intervalCount);
    return candidate;
  }
  if (schedule.frequency === "WEEKLY") {
    candidate = indiaDate(local.year, local.month, local.day, schedule.hourOfDay!, minute);
    const daysForward = (schedule.dayOfWeek! - indiaParts(candidate).weekday + 7) % 7;
    candidate = addIndiaDays(candidate, daysForward);
    while (candidate <= after) candidate = addIndiaDays(candidate, schedule.intervalCount * 7);
    return candidate;
  }
  candidate = indiaDate(local.year, local.month, schedule.dayOfMonth!, schedule.hourOfDay!, minute);
  while (candidate <= after) candidate = addIndiaMonths(candidate, schedule.intervalCount, schedule.dayOfMonth!);
  return candidate;
}

export function indiaDateKey(date: Date) {
  const p = indiaParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}-${pad(p.hour)}-${pad(p.minute)}-${pad(p.second)}`;
}

function indiaParts(date: Date) {
  const shifted = new Date(date.getTime() + INDIA_OFFSET_MINUTES * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay()
  };
}

function indiaDate(year: number, month: number, day: number, hour: number, minute: number) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - INDIA_OFFSET_MINUTES * 60_000);
}

function addIndiaDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addIndiaMonths(date: Date, months: number, day: number) {
  const p = indiaParts(date);
  const monthIndex = p.month - 1 + months;
  return indiaDate(p.year + Math.floor(monthIndex / 12), (monthIndex % 12) + 1, day, p.hour, p.minute);
}

function optionalRange(value: number | null, minimum: number, maximum: number, label: string) {
  if (value != null && (!Number.isInteger(value) || value < minimum || value > maximum)) throw new Error(`Backup schedule ${label} is invalid.`);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
