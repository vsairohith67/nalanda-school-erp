import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { changeLibraryCopyCondition, serializeLibraryCopy } from "@/lib/library-accession";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) { const auth = await requireApiPermission("MANAGE_LIBRARY_COPIES"); if (auth.response) return auth.response; try { const { id } = await context.params; const body = await request.json(); const copy = await changeLibraryCopyCondition(prisma, id, body.condition, auth.user.id, body.reason); return NextResponse.json({ copy: serializeLibraryCopy(copy) }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to change condition") }, { status: 400 }); } }
