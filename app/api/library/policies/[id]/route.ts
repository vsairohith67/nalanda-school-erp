import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { updateLibraryPolicy } from "@/lib/library-policies";
import { publicLibraryPolicy } from "@/lib/library-api";
import { prisma } from "@/lib/prisma";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const auth = await requireApiPermission("MANAGE_LIBRARY_POLICIES"); if (auth.response) return auth.response; try { return NextResponse.json({ policy: publicLibraryPolicy(await updateLibraryPolicy(prisma, (await params).id, await request.json())) }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to update policy") }, { status: 400 }); } }
