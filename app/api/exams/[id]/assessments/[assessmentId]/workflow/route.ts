import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadScopedAssessment, marksError } from "@/lib/marks-api";
import { transitionAssessment } from "@/lib/marks";
import { publicAssessment } from "@/lib/exams";
import { AcademicIntegrityError, assertNoDelegatedFamilyConflict, marksAuthorityAuditContext, resolveMarksWriteAuthority } from "@/lib/academic-integrity";

export async function POST(request: NextRequest, { params }: { params: Promise<{ assessmentId: string }> }) {
  const body = await request.json(); const action = String(body.action ?? "") as "submit" | "approve" | "lock" | "cancel";
  const permission = action === "submit" ? "SUBMIT_MARKS" : action === "approve" ? "APPROVE_MARKS" : action === "lock" ? "LOCK_EXAMS" : "CONFIGURE_EXAM_ASSESSMENTS";
  const auth = await requireApiPermission(permission); if (auth.response) return auth.response;
  if (!["submit", "approve", "lock", "cancel"].includes(action)) return NextResponse.json({ error: "Unsupported assessment action." }, { status: 400 });
  try { const assessmentId = (await params).assessmentId; const target = await loadScopedAssessment(auth.user, assessmentId, "WRITE"); const authority = await resolveMarksWriteAuthority(prisma, auth.user, { kind: "LEGACY_ASSESSMENT", assessmentId: target.id, examId: target.examCycleId, academicYear: target.academicYear, className: target.className, section: target.section, subjectId: target.timetableSubjectId, subjectName: target.subjectName, componentName: target.componentName }, permission); if (action !== "submit" && authority.mode !== "LEADERSHIP") throw new AcademicIntegrityError("Only the Principal or Super Admin may approve, lock, or cancel marks."); if (action === "submit") { const students = await prisma.academicYearEnrollment.findMany({ where: { academicYear: target.academicYear, className: target.className, ...(target.section ? { section: target.section } : {}), status: "ACTIVE" }, select: { studentId: true } }); await assertNoDelegatedFamilyConflict(prisma, auth.user, students.map((row) => row.studentId), authority, `legacy-submit:${target.id}`); } const assessment = await transitionAssessment(prisma, assessmentId, action, body.expectedUpdatedAt, { id: auth.user.id, name: auth.user.name, auditContext: marksAuthorityAuditContext(authority) }, body.reason); return NextResponse.json({ assessment: publicAssessment(assessment) }); }
  catch (error) { const r = marksError(error); return NextResponse.json({ error: r.message }, { status: r.status }); }
}
