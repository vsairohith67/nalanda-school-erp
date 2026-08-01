import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { friendlyStaffError } from "@/lib/staff";
import { normalizeAliasValue } from "@/lib/auth-identifiers";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_STAFF");
  if (auth.response) return auth.response;
  try {
    const { id } = await params; const body = await request.json(); const action = String(body.action ?? "");
    if (action === "create-login") throw new Error("Create pending Teacher access through the governed Named Users workflow");
    if (!["unlink-user", "link-user", "link-timetable"].includes(action)) throw new Error("Unknown staff link action");
    const username = action === "link-user" ? normalizeAliasValue("USERNAME", required(body.username, "Teacher username")) : null;
    await prisma.$transaction(async (tx) => {
      const staff = await tx.staffMember.findUnique({ where: { id } });
      if (!staff) throw new Error("Staff member not found");
      if (action === "unlink-user") {
        await tx.staffMember.update({ where: { id }, data: { userId: null } });
      } else if (action === "link-user") {
        const now = new Date();
        const user = await tx.user.findUnique({
          where: { username: username! },
          include: {
            iamRoleAssignments: {
              where: {
                role: "TEACHER",
                status: "ACTIVE",
                validFrom: { lte: now },
                OR: [{ validUntil: null }, { validUntil: { gt: now } }]
              },
              select: { id: true }
            }
          }
        });
        if (!user || !user.isActive || user.lifecycleStatus !== "ACTIVE" || user.iamRoleAssignments.length === 0) {
          throw new Error("Choose an active user with a current Teacher role assignment");
        }
        const occupied = await tx.staffMember.findUnique({ where: { userId: user.id }, select: { id: true } });
        if (occupied && occupied.id !== id) throw new Error("This Teacher login is already linked to another staff profile");
        await tx.staffMember.update({ where: { id }, data: { userId: user.id } });
      } else {
        const timetableTeacherId = String(body.timetableTeacherId ?? "").trim() || null;
        if (timetableTeacherId && !(await tx.timetableTeacher.findUnique({ where: { id: timetableTeacherId }, select: { id: true } }))) throw new Error("Timetable teacher not found");
        const occupied = timetableTeacherId ? await tx.staffMember.findUnique({ where: { timetableTeacherId }, select: { id: true } }) : null;
        if (occupied && occupied.id !== id) throw new Error("This timetable teacher is already linked to another staff profile");
        await tx.staffMember.update({ where: { id }, data: { timetableTeacherId } });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: friendlyStaffError(error) }, { status: 400 }); }
}
function required(value: unknown, label: string) { const text = String(value ?? "").trim(); if (!text) throw new Error(`${label} is required`); return text; }
