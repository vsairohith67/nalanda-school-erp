import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { validateNewPassword } from "@/lib/user-management";
import { friendlyStaffError } from "@/lib/staff";
import { maskAlias, normalizeAliasValue } from "@/lib/auth-identifiers";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_STAFF");
  if (auth.response) return auth.response;
  try {
    const { id } = await params; const body = await request.json(); const action = String(body.action ?? "");
    if (!["unlink-user", "link-user", "create-login", "link-timetable"].includes(action)) throw new Error("Unknown staff link action");
    if (action === "create-login" && !["SUPER_ADMIN", "DIRECTOR", "ADMIN"].includes(auth.user.role)) throw new Error("Only Super Admin, Director, or Admin can create teacher logins");
    const username = action === "link-user" || action === "create-login" ? normalizeAliasValue("USERNAME", required(body.username, action === "link-user" ? "Teacher username" : "Username")) : null;
    const password = action === "create-login" ? String(body.password ?? "") : null;
    if (password !== null) validateNewPassword(password);
    const passwordHash = password === null ? null : await hashPassword(password);
    await prisma.$transaction(async (tx) => {
      const staff = await tx.staffMember.findUnique({ where: { id } });
      if (!staff) throw new Error("Staff member not found");
      if (action === "unlink-user") {
        await tx.staffMember.update({ where: { id }, data: { userId: null } });
      } else if (action === "link-user") {
        const user = await tx.user.findUnique({ where: { username: username! } });
        if (!user || user.role !== "TEACHER") throw new Error("Choose an existing Teacher-role user");
        const occupied = await tx.staffMember.findUnique({ where: { userId: user.id }, select: { id: true } });
        if (occupied && occupied.id !== id) throw new Error("This Teacher login is already linked to another staff profile");
        await tx.staffMember.update({ where: { id }, data: { userId: user.id } });
      } else if (action === "create-login") {
        if (staff.userId) throw new Error("This staff profile already has a linked login");
        const user = await tx.user.create({ data: { name: staff.displayName ?? staff.fullName, username: username!, email: staff.email, role: "TEACHER", passwordHash: passwordHash!, isActive: true } });
        await tx.authLoginAlias.create({ data: { id: `auth2b_username_${user.id}`, userId: user.id, type: "USERNAME", normalizedValue: username!, displayMasked: maskAlias("USERNAME", username!), status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } });
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
