import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizeCode } from "@/lib/certificate-templates";
import { isIdentityCardType, type IdentityCardType } from "@/lib/id-card-templates";

type Client = PrismaClient | Prisma.TransactionClient;

export function formatIdentityCardNumber(series: { prefix: string; nextNumber: number; paddingLength: number; suffix: string | null }) {
  if (!Number.isInteger(series.nextNumber) || series.nextNumber < 1) throw new Error("ID-card series next number must be positive.");
  return `${series.prefix}${String(series.nextNumber).padStart(Math.max(1, Math.min(10, series.paddingLength)), "0")}${series.suffix ?? ""}`;
}

export async function resolveIdentityCardSeries(client: Client, cardType: IdentityCardType, academicYear?: string | null) {
  const rows = await (client as any).identityCardNumberSeries.findMany({
    where: { cardType, status: "ACTIVE", isDefault: true, OR: [{ academicYear: academicYear || null }, { academicYear: null }] },
    orderBy: [{ academicYear: "desc" }, { createdAt: "asc" }]
  });
  const exact = academicYear ? rows.filter((row: any) => row.academicYear === academicYear) : [];
  const applicable = exact.length ? exact : rows.filter((row: any) => row.academicYear == null);
  if (!applicable.length) throw new Error(`No active default ID-card number series exists for ${cardType}.`);
  if (applicable.length > 1) throw new Error(`Multiple active default ID-card number series exist for ${cardType}${academicYear ? ` and ${academicYear}` : ""}. Resolve the configuration before issue.`);
  return applicable[0];
}

export async function previewIdentityCardNumber(client: Client, cardType: IdentityCardType, academicYear?: string | null) {
  const series = await resolveIdentityCardSeries(client, cardType, academicYear);
  return { seriesId: series.id, cardNumber: formatIdentityCardNumber(series), nextNumber: series.nextNumber };
}

export async function allocateIdentityCardNumber(client: Client, cardType: IdentityCardType, academicYear?: string | null) {
  const series = await resolveIdentityCardSeries(client, cardType, academicYear);
  const updated = await (client as any).identityCardNumberSeries.updateMany({
    where: { id: series.id, nextNumber: series.nextNumber, status: "ACTIVE" },
    data: { nextNumber: { increment: 1 } }
  });
  if (updated.count !== 1) throw new Error("ID-card number was allocated by another issue operation. Please retry.");
  return { seriesId: series.id, cardNumber: formatIdentityCardNumber(series) };
}

export function validateIdentityCardSeriesInput(input: any) {
  const cardType = String(input?.cardType ?? "").toUpperCase();
  if (!isIdentityCardType(cardType)) throw new Error("Card type must be STUDENT or STAFF.");
  const nextNumber = Number(input?.nextNumber ?? 1), paddingLength = Number(input?.paddingLength ?? 4);
  if (!Number.isInteger(nextNumber) || nextNumber < 1) throw new Error("Next number must be a positive integer.");
  if (!Number.isInteger(paddingLength) || paddingLength < 1 || paddingLength > 10) throw new Error("Padding length must be from 1 to 10.");
  return {
    seriesCode: normalizeCode(input?.seriesCode, "Series code"),
    cardType,
    academicYear: String(input?.academicYear ?? "").trim() || null,
    prefix: String(input?.prefix ?? "").trim().slice(0, 30),
    nextNumber,
    paddingLength,
    suffix: String(input?.suffix ?? "").trim().slice(0, 20) || null,
    resetPolicy: String(input?.resetPolicy) === "ACADEMIC_YEAR" ? "ACADEMIC_YEAR" : "NEVER",
    status: String(input?.status) === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    isDefault: input?.isDefault !== false
  };
}
