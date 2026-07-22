import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { updateLibraryChargeRule } from "@/lib/library-charge-rules";
import { prisma } from "@/lib/prisma";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const auth = await requireApiPermission("ASSESS_LIBRARY_CHARGES"); if (auth.response) return auth.response; try { const row = await updateLibraryChargeRule(prisma, (await params).id, await request.json()); return NextResponse.json({ rule: { id: row.id, ruleCode: row.ruleCode } }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to update rule") }, { status: 400 }); } }
