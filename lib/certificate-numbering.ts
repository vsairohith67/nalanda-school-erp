import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizeCode, type CertificateType } from "@/lib/certificate-templates";

type Client = PrismaClient | Prisma.TransactionClient;

async function applicableSeries(client: Client, certificateType: CertificateType, academicYear: string) {
  const rows = await (client as any).certificateNumberSeries.findMany({ where: { certificateType, status: "ACTIVE", isDefault: true, OR: [{ academicYear }, { academicYear: null }] }, orderBy: [{ academicYear: "desc" }, { createdAt: "asc" }] });
  const exact = rows.filter((row: any) => row.academicYear === academicYear);
  const applicable = exact.length ? exact : rows.filter((row: any) => row.academicYear == null);
  if (!applicable.length) throw new Error(`No active default number series exists for ${certificateType}.`);
  if (applicable.length > 1) throw new Error(`Multiple active default number series exist for ${certificateType} and ${academicYear}. Resolve the configuration before issue.`);
  return applicable[0];
}

export function formatCertificateNumber(series: { prefix: string; nextNumber: number; paddingLength: number; suffix: string | null }) {
  if (!Number.isInteger(series.nextNumber) || series.nextNumber < 1) throw new Error("Certificate number series next number must be positive.");
  const digits = String(series.nextNumber).padStart(Math.max(1, Math.min(10, series.paddingLength)), "0");
  return `${series.prefix}${digits}${series.suffix ?? ""}`;
}

export async function previewCertificateNumber(client: Client, certificateType: CertificateType, academicYear: string) {
  const series = await applicableSeries(client, certificateType, academicYear);
  return { seriesId: series.id, certificateNumber: formatCertificateNumber(series), nextNumber: series.nextNumber };
}

export async function allocateCertificateNumber(client: Client, certificateType: CertificateType, academicYear: string) {
  const series = await applicableSeries(client, certificateType, academicYear);
  const updated = await (client as any).certificateNumberSeries.updateMany({ where: { id: series.id, nextNumber: series.nextNumber, status: "ACTIVE" }, data: { nextNumber: { increment: 1 } } });
  if (updated.count !== 1) throw new Error("Certificate number was allocated by another issue operation. Please retry.");
  return { seriesId: series.id, certificateNumber: formatCertificateNumber(series) };
}

export function validateNumberSeriesInput(input: any) {
  const certificateType = String(input?.certificateType ?? "").toUpperCase() as CertificateType;
  if (!["BONAFIDE", "STUDY", "CONDUCT", "TRANSFER"].includes(certificateType)) throw new Error("Unsupported certificate type.");
  const nextNumber = Number(input?.nextNumber ?? 1), paddingLength = Number(input?.paddingLength ?? 4);
  if (!Number.isInteger(nextNumber) || nextNumber < 1) throw new Error("Next number must be a positive integer.");
  if (!Number.isInteger(paddingLength) || paddingLength < 1 || paddingLength > 10) throw new Error("Padding length must be from 1 to 10.");
  return { seriesCode: normalizeCode(input?.seriesCode, "Series code"), certificateType, academicYear: String(input?.academicYear ?? "").trim() || null, prefix: String(input?.prefix ?? "").slice(0, 30), nextNumber, paddingLength, suffix: String(input?.suffix ?? "").slice(0, 20) || null, resetPolicy: ["NEVER", "ACADEMIC_YEAR", "FINANCIAL_YEAR"].includes(String(input?.resetPolicy)) ? String(input.resetPolicy) : "NEVER", status: input?.status === "INACTIVE" ? "INACTIVE" : "ACTIVE", isDefault: input?.isDefault !== false };
}
