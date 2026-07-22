import type { Prisma } from "@prisma/client";

export const VENDOR_STATUSES = ["ACTIVE", "INACTIVE", "BLOCKED"] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

const MOBILE = /^\+?[0-9][0-9 -]{7,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

function text(value: unknown, max: number, label: string) {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  if (result.length > max) throw new Error(`${label} must be at most ${max} characters`);
  return result || null;
}

export function validateVendorInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Vendor details are required");
  const row = input as Record<string, unknown>;
  const vendorCode = String(row.vendorCode ?? "").trim().toUpperCase();
  const name = String(row.name ?? "").trim();
  const mobile = text(row.mobile, 20, "Mobile");
  const alternateMobile = text(row.alternateMobile, 20, "Alternate mobile");
  const email = text(row.email, 160, "Email")?.toLowerCase() ?? null;
  const gstin = text(row.gstin, 15, "GSTIN")?.toUpperCase() ?? null;
  const pan = text(row.pan, 10, "PAN")?.toUpperCase() ?? null;
  const ifsc = text(row.ifsc, 11, "IFSC")?.toUpperCase() ?? null;
  const accountLastFour = text(row.accountLastFour, 4, "Account last four");
  const paymentTermsDays = row.paymentTermsDays === "" || row.paymentTermsDays == null ? null : Number(row.paymentTermsDays);
  const status = String(row.status ?? "ACTIVE").toUpperCase() as VendorStatus;
  if (!/^[A-Z0-9][A-Z0-9_-]{1,29}$/.test(vendorCode)) throw new Error("Vendor code must be 2-30 letters, numbers, hyphens, or underscores");
  if (name.length < 2 || name.length > 160) throw new Error("Vendor name must be 2-160 characters");
  if (mobile && !MOBILE.test(mobile)) throw new Error("Enter a valid mobile number format");
  if (alternateMobile && !MOBILE.test(alternateMobile)) throw new Error("Enter a valid alternate mobile number format");
  if (email && !EMAIL.test(email)) throw new Error("Enter a valid email format");
  if (gstin && !GSTIN.test(gstin)) throw new Error("GSTIN format is invalid; this check does not verify it with the GST portal");
  if (pan && !PAN.test(pan)) throw new Error("PAN format is invalid; this check does not verify it with the Income Tax portal");
  if (ifsc && !IFSC.test(ifsc)) throw new Error("IFSC format is invalid; this check does not verify it with the bank");
  if (accountLastFour && !/^[0-9]{4}$/.test(accountLastFour)) throw new Error("Account last four must contain exactly four digits");
  if (paymentTermsDays !== null && (!Number.isInteger(paymentTermsDays) || paymentTermsDays < 0 || paymentTermsDays > 3650)) throw new Error("Payment terms must be 0-3650 days");
  if (!VENDOR_STATUSES.includes(status)) throw new Error("Unsupported vendor status");
  return {
    vendorCode, name, contactPerson: text(row.contactPerson, 120, "Contact person"), mobile, alternateMobile, email,
    address: text(row.address, 1000, "Address"), gstin, pan, bankName: text(row.bankName, 160, "Bank name"), accountLastFour,
    ifsc, paymentTermsDays, notes: text(row.notes, 2000, "Notes"), status
  };
}

export function vendorWhere(search?: string, status?: string, includeSensitiveSearch = false): Prisma.VendorWhereInput {
  const where: Prisma.VendorWhereInput = {};
  if (status && VENDOR_STATUSES.includes(status as VendorStatus)) where.status = status;
  const query = search?.trim();
  if (query) where.OR = [
    { vendorCode: { contains: query } }, { name: { contains: query } },
    { contactPerson: { contains: query } }, { mobile: { contains: query } },
    ...(includeSensitiveSearch ? [{ gstin: { contains: query.toUpperCase() } }] : [])
  ];
  return where;
}

export function serializeVendor<T extends Record<string, unknown>>(vendor: T, includeSensitive: boolean) {
  const safe = {
    id: vendor.id, vendorCode: vendor.vendorCode, name: vendor.name, contactPerson: vendor.contactPerson,
    mobile: vendor.mobile, alternateMobile: vendor.alternateMobile, email: vendor.email, address: vendor.address,
    paymentTermsDays: vendor.paymentTermsDays, notes: vendor.notes, status: vendor.status,
    createdAt: vendor.createdAt, updatedAt: vendor.updatedAt,
    expenseCount: vendor.expenseCount, expenseTotal: vendor.expenseTotal
  };
  return includeSensitive ? { ...safe, gstin: vendor.gstin, pan: vendor.pan, bankName: vendor.bankName, accountLastFour: vendor.accountLastFour, ifsc: vendor.ifsc } : safe;
}
