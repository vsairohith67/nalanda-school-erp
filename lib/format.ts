export function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number.isFinite(value) ? value : 0);
}

export function moneyExact(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);
}

export function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isoDateInput(value: Date | string = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

export function monthKey(value: Date | string = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 7);
}

export const SCHOOL_TIME_ZONE = "Asia/Kolkata";

export function schoolDateKey(value: Date | string = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHOOL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function schoolHour(value: Date | string = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  return Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHOOL_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23"
  }).format(date));
}

export function displayDate(value: Date | string) {
  const iso = typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

export function normalizeAcademicYear(value: unknown) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4})-(\d{2})$/);
  if (!match || Number(match[2]) !== (Number(match[1]) + 1) % 100) {
    throw new Error("Academic year must use consecutive YYYY-YY format");
  }
  return text;
}

export function csvEscape(value: unknown) {
  const raw = value == null ? "" : String(value);
  const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ].join("\n");
}
