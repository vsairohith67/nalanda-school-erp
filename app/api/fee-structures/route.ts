import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ACADEMIC_YEAR } from "@/lib/constants";
import { requireApiPermission } from "@/lib/auth";
import { logFeeStructureSecurityEvent, validateFeeStructurePayload } from "@/lib/fee-structures";

export async function GET() {
  const auth = await requireApiPermission("VIEW_FEE_STRUCTURES");
  if (auth.response) return auth.response;
  const rows = await prisma.feeStructure.findMany({ where: { active: true }, orderBy: { className: "asc" } });
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_FEE_STRUCTURES");
  if (auth.response) return auth.response;
  const body = await request.json();
  if (Array.isArray(body.rows)) {
    try {
      const advancedOverride = body.advancedOverride === true;
      const { academicYear, rows } = validateFeeStructurePayload({
        academicYear: body.academicYear ?? ACADEMIC_YEAR,
        rows: body.rows,
        advancedOverride
      });
      const saved = await prisma.$transaction(rows.map((row) => prisma.feeStructure.upsert({
        where: { academicYear_className: { academicYear, className: row.className } },
        update: { ...row, active: true },
        create: { academicYear, ...row }
      })));
      logFeeStructureSecurityEvent({ actorUserId: auth.user.id, academicYear, classNames: rows.map((row) => row.className), changeMode: "BULK", advancedOverride });
      return NextResponse.json(saved);
    } catch (error) {
      return NextResponse.json({
        error: safeClientError(error, "Unable to save fee structures")
      }, { status: 400 });
    }
  }
  try {
    const advancedOverride = body.advancedOverride === true || ["term1Month", "term2Month", "term3Month", "term4Month"].some((key) => body[key] != null && body[key] !== "");
    const parsed = validateFeeStructurePayload({
      academicYear: body.academicYear ?? ACADEMIC_YEAR,
      rows: [body],
      advancedOverride,
      requireAllClasses: false
    });
    const row = parsed.rows[0];
    const saved = await prisma.feeStructure.upsert({
      where: { academicYear_className: { academicYear: parsed.academicYear, className: row.className } },
      update: { ...row, active: true },
      create: { academicYear: parsed.academicYear, ...row }
    });
    logFeeStructureSecurityEvent({ actorUserId: auth.user.id, academicYear: parsed.academicYear, classNames: [row.className], changeMode: "SINGLE", advancedOverride });
    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json({ error: safeClientError(error, "Unable to save fee structure") }, { status: 400 });
  }
}
