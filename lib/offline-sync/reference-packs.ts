import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { allocateFees } from "@/lib/fee-allocation";
import type { OfflineSyncDevice } from "@prisma/client";

const SOFT_STALE_MS = 24 * 60 * 60 * 1000;
const HARD_EXPIRY_MS = 72 * 60 * 60 * 1000;
const MAX_STUDENTS = 800;

type SnapshotClaims = { v: 1; userId: string; deviceId: string; issuedAt: number; softAt: number; hardAt: number; cutoff: string };
type CursorClaims = { v: 1; userId: string; deviceId: string; after: string };

function secret() {
  const value = process.env.SESSION_SECRET ?? process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("OFFLINE_REFERENCE_SIGNING_SECRET_UNAVAILABLE");
  return value;
}

function encode(claims: SnapshotClaims | CursorClaims) {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function decode<T extends SnapshotClaims | CursorClaims>(token: string): T {
  const [payload, supplied, extra] = token.split(".");
  if (!payload || !supplied || extra) throw new Error("REFERENCE_TOKEN_INVALID");
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const received = Buffer.from(supplied, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error("REFERENCE_TOKEN_INVALID");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
}

function assertBound(claims: { v: number; userId: string; deviceId: string }, userId: string, deviceId: string) {
  if (claims.v !== 1 || claims.userId !== userId || claims.deviceId !== deviceId) throw new Error("REFERENCE_TOKEN_SCOPE_INVALID");
}

export function verifyReferenceSnapshot(token: string, userId: string, deviceId: string, now = Date.now()) {
  const claims = decode<SnapshotClaims>(token);
  assertBound(claims, userId, deviceId);
  if (!Number.isSafeInteger(claims.hardAt) || now >= claims.hardAt) throw new Error("REFERENCE_PACK_HARD_EXPIRED");
  return { ...claims, stale: now >= claims.softAt };
}

export async function buildReferencePack(input: { userId: string; device: OfflineSyncDevice; cursor?: string | null }) {
  const now = Date.now();
  const cutoff = new Date();
  let after: Date | null = null;
  if (input.cursor) {
    const claims = decode<CursorClaims>(input.cursor);
    assertBound(claims, input.userId, input.device.id);
    after = new Date(claims.after);
    if (Number.isNaN(after.getTime()) || after > cutoff) throw new Error("REFERENCE_CURSOR_INVALID");
  }
  const changed = after ? { updatedAt: { gt: after, lte: cutoff } } : { updatedAt: { lte: cutoff } };
  const [students, feeStructures, vendors, categories, departments, miscItems] = await Promise.all([
    prisma.student.findMany({
      where: after ? changed : { deletedAt: null, status: "Active", ...changed },
      select: { id: true, admissionNo: true, studentName: true, className: true, section: true, academicYear: true, status: true, studentType: true, discountPercent: true, deletedAt: true, updatedAt: true },
      orderBy: { updatedAt: "asc" }, take: MAX_STUDENTS
    }),
    prisma.feeStructure.findMany({ where: after ? changed : { active: true, ...changed }, select: { id: true, academicYear: true, className: true, termAmount: true, term1Month: true, term2Month: true, term3Month: true, term4Month: true, active: true, updatedAt: true }, take: 500 }),
    prisma.vendor.findMany({ where: after ? changed : { status: "ACTIVE", ...changed }, select: { id: true, vendorCode: true, name: true, status: true, updatedAt: true }, take: 500 }),
    prisma.expenseCategory.findMany({ where: after ? changed : { status: "ACTIVE", ...changed }, select: { id: true, code: true, name: true, status: true, updatedAt: true }, take: 500 }),
    prisma.expenseDepartment.findMany({ where: after ? changed : { status: "ACTIVE", ...changed }, select: { id: true, code: true, name: true, status: true, updatedAt: true }, take: 500 }),
    prisma.miscIncomeItem.findMany({ where: after ? changed : { status: "ACTIVE", ...changed }, select: { id: true, itemCode: true, name: true, category: true, studentLinkPolicy: true, status: true, updatedAt: true, rates: { where: { status: "ACTIVE" }, select: { id: true, academicYear: true, amount: true, effectiveFrom: true, effectiveTo: true, updatedAt: true } } }, take: 500 })
  ]);
  const activeStudents = students.filter((row) => !row.deletedAt && row.status === "Active");
  const activeFeeStructures = feeStructures.filter((row) => row.active);
  const activeVendors = vendors.filter((row) => row.status === "ACTIVE");
  const activeCategories = categories.filter((row) => row.status === "ACTIVE");
  const activeDepartments = departments.filter((row) => row.status === "ACTIVE");
  const activeMiscItems = miscItems.filter((row) => row.status === "ACTIVE");
  const structureMap = new Map(activeFeeStructures.map((row) => [`${row.academicYear}:${row.className}`, row]));
  const admissions = activeStudents.map((row) => row.admissionNo);
  const payments = admissions.length ? await prisma.payment.findMany({ where: { admissionNo: { in: admissions }, deletedAt: null }, select: { admissionNo: true, amountPaid: true, feeType: true, isCancelled: true, deletedAt: true } }) : [];
  const paymentMap = new Map<string, typeof payments>();
  for (const payment of payments) paymentMap.set(payment.admissionNo, [...(paymentMap.get(payment.admissionNo) ?? []), payment]);
  const snapshot = encode({ v: 1, userId: input.userId, deviceId: input.device.id, issuedAt: now, softAt: now + SOFT_STALE_MS, hardAt: now + HARD_EXPIRY_MS, cutoff: cutoff.toISOString() });
  const nextCursor = encode({ v: 1, userId: input.userId, deviceId: input.device.id, after: cutoff.toISOString() });
  return {
    schemaVersion: 1,
    mode: after ? "INCREMENTAL" : "FULL",
    snapshotVersion: snapshot,
    generatedAt: new Date(now).toISOString(),
    softStaleAt: new Date(now + SOFT_STALE_MS).toISOString(),
    hardExpiresAt: new Date(now + HARD_EXPIRY_MS).toISOString(),
    cursor: nextCursor,
    truncated: students.length >= MAX_STUDENTS,
    tombstones: {
      students: students.filter((row) => row.deletedAt || row.status !== "Active").map((row) => row.id),
      feeStructures: feeStructures.filter((row) => !row.active).map((row) => row.id),
      vendors: vendors.filter((row) => row.status !== "ACTIVE").map((row) => row.id),
      expenseCategories: categories.filter((row) => row.status !== "ACTIVE").map((row) => row.id),
      expenseDepartments: departments.filter((row) => row.status !== "ACTIVE").map((row) => row.id),
      miscIncomeItems: miscItems.filter((row) => row.status !== "ACTIVE").map((row) => row.id)
    },
    students: activeStudents.map((student) => {
      const structure = structureMap.get(`${student.academicYear}:${student.className}`);
      const due = structure ? allocateFees(student, structure, paymentMap.get(student.admissionNo) ?? []) : null;
      return { id: student.id, admissionNo: student.admissionNo, name: student.studentName, className: student.className, section: student.section, academicYear: student.academicYear, status: student.status, entityVersion: student.updatedAt.toISOString(), due: due ? { totalPending: due.totalPending, dueStatus: due.dueStatus, terms: due.terms } : null };
    }),
    feeStructures: activeFeeStructures.map(({ active: _active, ...row }) => ({ ...row, entityVersion: row.updatedAt.toISOString(), updatedAt: undefined })),
    vendors: activeVendors.map((row) => ({ id: row.id, code: row.vendorCode, name: row.name, status: row.status, entityVersion: row.updatedAt.toISOString() })),
    expenseCategories: activeCategories.map((row) => ({ id: row.id, code: row.code, name: row.name, status: row.status, entityVersion: row.updatedAt.toISOString() })),
    expenseDepartments: activeDepartments.map((row) => ({ id: row.id, code: row.code, name: row.name, status: row.status, entityVersion: row.updatedAt.toISOString() })),
    miscIncomeItems: activeMiscItems.map((row) => ({ id: row.id, code: row.itemCode, name: row.name, category: row.category, studentLinkPolicy: row.studentLinkPolicy, status: row.status, entityVersion: row.updatedAt.toISOString(), rates: row.rates.map((rate) => ({ id: rate.id, academicYear: rate.academicYear, amount: rate.amount.toFixed(2), effectiveFrom: rate.effectiveFrom, effectiveTo: rate.effectiveTo, entityVersion: rate.updatedAt.toISOString() })) })),
    dictionaries: { paymentMethods: ["Cash", "UPI", "NEFT", "RTGS", "IMPS", "Bank Transfer", "Cheque", "Other"], feeTypes: ["Current Year Fee"], termHints: ["Auto", "Term 1", "Term 2", "Term 3", "Term 4", "Multiple"], receivedAccounts: ["Cash", "Director Sir GPay", "NPS Current Account UPI", "NPS Bank Account", "Other"] }
  };
}
