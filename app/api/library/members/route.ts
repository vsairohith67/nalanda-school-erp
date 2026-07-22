import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { createLibraryMember, libraryMemberInclude } from "@/lib/library-members";
import { publicLibraryMember } from "@/lib/library-api";
import { prisma } from "@/lib/prisma";
export async function GET(request: NextRequest) { const auth = await requireApiPermission("VIEW_LIBRARY_CIRCULATION"); if (auth.response) return auth.response; const q = request.nextUrl.searchParams.get("q")?.trim(); const members = await prisma.libraryMember.findMany({ where: q ? { OR: [{ memberCode: { contains: q } }, { student: { studentName: { contains: q } } }, { staffMember: { fullName: { contains: q } } }] } : undefined, include: libraryMemberInclude, orderBy: { memberCode: "asc" } }); return NextResponse.json({ members: members.map(publicLibraryMember) }); }
export async function POST(request: NextRequest) { const auth = await requireApiPermission("MANAGE_LIBRARY_MEMBERS"); if (auth.response) return auth.response; try { return NextResponse.json({ member: publicLibraryMember(await createLibraryMember(prisma, await request.json(), auth.user.id)) }, { status: 201 }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to create membership") }, { status: 400 }); } }
