import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { normalizeMemberCode, effectiveMemberStatus } from "@/lib/library-members";
import { prisma } from "@/lib/prisma";
export async function GET(request: NextRequest) { const auth = await requireApiPermission("USE_LIBRARY_SCANNER"); if (auth.response) return auth.response; try { const memberCode = normalizeMemberCode(request.nextUrl.searchParams.get("memberCode")); const member = await prisma.libraryMember.findUnique({ where: { memberCode }, include: { _count: { select: { loans: { where: { status: "ISSUED" } } } } } }); if (!member) return NextResponse.json({ error: "No exact member-code match" }, { status: 404 }); return NextResponse.json({ member: { memberCode: member.memberCode, memberType: member.memberType, status: effectiveMemberStatus(member), activeLoanCount: member._count.loans } }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Invalid member code") }, { status: 400 }); } }
