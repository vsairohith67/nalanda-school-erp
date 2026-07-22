import type { PrismaClient } from "@prisma/client";

export const DEFAULT_SCHOOL_SETTINGS = {
  id: "school",
  schoolName: "Nalanda Public School",
  addressLine1: "Nanalnagar, Mehdipatnam",
  city: "Hyderabad",
  phone: "040-23513913",
  academicYear: "2026-27",
  receiptPrefix: null as string | null,
  defaultCurrency: "INR",
  whatsappReminderFooter: "Nalanda Public School",
  logoPath: "/nalanda-logo.jpg",
  receiptTitle: "FEE RECEIPT",
  showSchoolPhone: true,
  showSchoolAddress: true,
  defaultPrintSize: "A5",
  signatureLabel: "Receiver Signature"
};

export type SchoolSettingsValue = typeof DEFAULT_SCHOOL_SETTINGS;

type SettingsClient = Pick<PrismaClient, "schoolSettings">;

export async function getSchoolSettings(client: SettingsClient): Promise<SchoolSettingsValue> {
  const row = await client.schoolSettings.findUnique({ where: { id: "school" } });
  if (!row) return { ...DEFAULT_SCHOOL_SETTINGS };
  return {
    id: row.id,
    schoolName: row.schoolName,
    addressLine1: row.addressLine1,
    city: row.city,
    phone: row.phone,
    academicYear: row.academicYear,
    receiptPrefix: row.receiptPrefix,
    defaultCurrency: row.defaultCurrency,
    whatsappReminderFooter: row.whatsappReminderFooter,
    logoPath: row.logoPath,
    receiptTitle: row.receiptTitle,
    showSchoolPhone: row.showSchoolPhone,
    showSchoolAddress: row.showSchoolAddress,
    defaultPrintSize: row.defaultPrintSize,
    signatureLabel: row.signatureLabel
  };
}

export function validateSchoolSettings(input: Record<string, unknown>): Omit<SchoolSettingsValue, "id"> {
  const defaultPrintSize = text(input.defaultPrintSize, "Default print size").toUpperCase();
  if (!["A4", "A5"].includes(defaultPrintSize)) throw new Error("Default print size must be A4 or A5");
  const defaultCurrency = text(input.defaultCurrency, "Default currency").toUpperCase();
  if (defaultCurrency !== "INR") throw new Error("Default currency must be INR");
  const logoPath = text(input.logoPath, "Logo path");
  if (!logoPath.startsWith("/") || logoPath.startsWith("//")) throw new Error("Logo path must be a local path");

  return {
    schoolName: text(input.schoolName, "School name"),
    addressLine1: text(input.addressLine1, "Address"),
    city: text(input.city, "City"),
    phone: text(input.phone, "Phone"),
    academicYear: text(input.academicYear, "Academic year"),
    receiptPrefix: optionalText(input.receiptPrefix),
    defaultCurrency,
    whatsappReminderFooter: text(input.whatsappReminderFooter, "WhatsApp reminder footer"),
    logoPath,
    receiptTitle: text(input.receiptTitle, "Receipt title"),
    showSchoolPhone: booleanValue(input.showSchoolPhone),
    showSchoolAddress: booleanValue(input.showSchoolAddress),
    defaultPrintSize,
    signatureLabel: text(input.signatureLabel, "Signature label")
  };
}

export function displayReceiptNumber(receiptNo: string, receiptPrefix?: string | null) {
  const prefix = String(receiptPrefix ?? "").trim();
  return prefix ? `${prefix}${receiptNo}` : receiptNo;
}

function text(value: unknown, label: string) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${label} is required`);
  return result;
}

function optionalText(value: unknown) {
  const result = String(value ?? "").trim();
  return result || null;
}

function booleanValue(value: unknown) {
  return value === true || value === "true" || value === "on";
}
