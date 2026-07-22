import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { createLibraryPolicy } from "@/lib/library-policies";
import { publicLibraryPolicy } from "@/lib/library-api";
import { prisma } from "@/lib/prisma";
export async function GET() { const auth = await requireApiPermission("VIEW_LIBRARY_CIRCULATION"); if (auth.response) return auth.response; const policies = await prisma.libraryPolicy.findMany({ orderBy: [{ memberType: "asc" }, { priority: "desc" }, { policyCode: "asc" }] }); return NextResponse.json({ policies: policies.map(publicLibraryPolicy) }); }
export async function POST(request: NextRequest) { const auth = await requireApiPermission("MANAGE_LIBRARY_POLICIES"); if (auth.response) return auth.response; try { return NextResponse.json({ policy: publicLibraryPolicy(await createLibraryPolicy(prisma, await request.json(), auth.user.id)) }, { status: 201 }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to create policy") }, { status: 400 }); } }
