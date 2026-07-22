import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activeStaffMembers, attendanceDay, friendlyStaffAttendanceError, validateStaffAttendanceRecords } from "@/lib/staff-attendance";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_STAFF_ATTENDANCE"); if (auth.response) return auth.response;
  try { const attendanceDate = attendanceDay(request.nextUrl.searchParams.get("attendanceDate")); const [staff, session] = await Promise.all([activeStaffMembers(prisma), prisma.staffAttendanceSession.findUnique({ where: { attendanceDate }, include: { records: true } })]); return NextResponse.json({ staff, session }); }
  catch (error) { return NextResponse.json({ error: friendlyStaffAttendanceError(error) }, { status: 400 }); }
}

export async function POST(request: NextRequest) {
  const body = await request.json(); const action = String(body.action ?? "");
  const permission = action === "submit" ? "SUBMIT_STAFF_ATTENDANCE" : action === "lock" ? "LOCK_STAFF_ATTENDANCE" : "MANAGE_STAFF_ATTENDANCE";
  const auth = await requireApiPermission(permission); if (auth.response) return auth.response;
  try {
    const attendanceDate = attendanceDay(body.attendanceDate); const result = await prisma.$transaction(async (tx) => {
      if (action === "create") return tx.staffAttendanceSession.upsert({ where: { attendanceDate }, update: {}, create: { attendanceDate, academicYear: String(body.academicYear ?? "").trim() || null, takenByUserId: auth.user.id } });
      let session = await tx.staffAttendanceSession.findUnique({ where: { attendanceDate } }); if (!session) throw new Error("Create a draft staff attendance session first");
      if (action === "lock") { if (session.status !== "SUBMITTED") throw new Error("Only submitted staff attendance can be locked"); return tx.staffAttendanceSession.update({ where: { id: session.id }, data: { status: "LOCKED", lockedAt: new Date(), lockedByUserId: auth.user.id } }); }
      if (session.status !== "DRAFT") throw new Error(`${session.status === "LOCKED" ? "Locked" : "Submitted"} staff attendance cannot be edited`);
      if (action === "clear") { await tx.staffAttendanceRecord.deleteMany({ where: { sessionId: session.id } }); return session; }
      if (!['save', 'submit'].includes(action)) throw new Error("Unknown staff attendance action");
      const records = validateStaffAttendanceRecords(body.records); const staff = await activeStaffMembers(tx); const allowed = new Map(staff.map((member) => [member.id, member]));
      if (records.some((row) => !allowed.has(row.staffMemberId))) throw new Error("Attendance contains a staff member who is inactive, left, or unavailable");
      await tx.staffAttendanceRecord.deleteMany({ where: { sessionId: session.id, staffMemberId: { notIn: records.map((row) => row.staffMemberId) } } });
      for (const record of records) { const member = allowed.get(record.staffMemberId)!; await tx.staffAttendanceRecord.upsert({ where: { sessionId_staffMemberId: { sessionId: session.id, staffMemberId: record.staffMemberId } }, update: { ...record, staffCode: member.staffCode }, create: { sessionId: session.id, ...record, staffCode: member.staffCode } }); }
      if (action === "submit") { if (!staff.length) throw new Error("There are no active staff members to submit"); if (records.length !== staff.length) throw new Error("Mark every active staff member before submitting attendance"); session = await tx.staffAttendanceSession.update({ where: { id: session.id }, data: { status: "SUBMITTED", submittedAt: new Date(), submittedByUserId: auth.user.id } }); }
      return session;
    }); return NextResponse.json({ session: result });
  } catch (error) { return NextResponse.json({ error: friendlyStaffAttendanceError(error) }, { status: 400 }); }
}
