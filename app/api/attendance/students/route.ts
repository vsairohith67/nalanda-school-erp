import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { activeStudentsForScope, attendanceScope, friendlyAttendanceError, validateAttendanceRecords } from "@/lib/student-attendance";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_STUDENT_ATTENDANCE"); if (auth.response) return auth.response;
  try {
    const scope = attendanceScope(Object.fromEntries(request.nextUrl.searchParams));
    const [students, session] = await Promise.all([
      activeStudentsForScope(prisma, scope),
      prisma.studentAttendanceSession.findUnique({ where: { attendanceDate_className_section_academicYear: scope }, include: { records: true } })
    ]);
    return NextResponse.json({ students, session });
  } catch (error) { return NextResponse.json({ error: friendlyAttendanceError(error) }, { status: 400 }); }
}

export async function POST(request: NextRequest) {
  const viewAuth = await requireApiPermission("VIEW_STUDENT_ATTENDANCE");
  if (viewAuth.response) return viewAuth.response;
  try {
    const body = await request.json(); const action = String(body.action ?? "");
    const permission = action === "submit" ? "SUBMIT_STUDENT_ATTENDANCE" : action === "lock" ? "LOCK_STUDENT_ATTENDANCE" : "MANAGE_STUDENT_ATTENDANCE";
    const auth = await requireApiPermission(permission); if (auth.response) return auth.response;
    if (action === "submit") {
      const manageAuth = await requireApiPermission("MANAGE_STUDENT_ATTENDANCE");
      if (manageAuth.response) return manageAuth.response;
    }
    const scope = attendanceScope(body);
    const result = await prisma.$transaction(async (tx) => {
      let session = await tx.studentAttendanceSession.upsert({
        where: { attendanceDate_className_section_academicYear: scope }, update: {},
        create: { ...scope, status: "DRAFT", takenByUserId: viewAuth.user.id }
      });
      if (action === "create") return session;
      if (action === "lock") {
        if (session.status !== "SUBMITTED") throw new Error("Only submitted attendance can be locked");
        return tx.studentAttendanceSession.update({ where: { id: session.id }, data: { status: "LOCKED", lockedAt: new Date(), lockedByUserId: auth.user.id } });
      }
      if (session.status !== "DRAFT") throw new Error(`${session.status === "LOCKED" ? "Locked" : "Submitted"} attendance cannot be edited`);
      if (action === "clear") { await tx.studentAttendanceRecord.deleteMany({ where: { sessionId: session.id } }); return session; }
      if (!['save', 'submit'].includes(action)) throw new Error("Unknown attendance action");
      const records = validateAttendanceRecords(body.records);
      const students = await activeStudentsForScope(tx, scope); const allowed = new Map(students.map((student) => [student.id, student]));
      if (records.some((row) => !allowed.has(row.studentId))) throw new Error("Attendance contains a student who is inactive, left, deleted, or outside this class");
      await tx.studentAttendanceRecord.deleteMany({ where: { sessionId: session.id, studentId: { notIn: records.map((row) => row.studentId) } } });
      for (const record of records) {
        const student = allowed.get(record.studentId)!;
        await tx.studentAttendanceRecord.upsert({
          where: { sessionId_studentId: { sessionId: session.id, studentId: record.studentId } },
          update: { status: record.status, remarks: record.remarks, admissionNo: student.admissionNo },
          create: { sessionId: session.id, studentId: record.studentId, admissionNo: student.admissionNo, status: record.status, remarks: record.remarks }
        });
      }
      if (action === "submit") {
        if (!students.length) throw new Error("This class has no active students to submit");
        if (records.length !== students.length) throw new Error("Mark every active student before submitting attendance");
        session = await tx.studentAttendanceSession.update({ where: { id: session.id }, data: { status: "SUBMITTED", submittedAt: new Date(), submittedByUserId: auth.user.id } });
      }
      return session;
    });
    return NextResponse.json({ session: result });
  } catch (error) { return NextResponse.json({ error: friendlyAttendanceError(error) }, { status: 400 }); }
}
