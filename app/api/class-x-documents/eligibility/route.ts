import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { buildClassXEligibilitySnapshot } from "@/lib/class-x-document-packages";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_CLASS_X_PACKAGES"); if (auth.response) return auth.response;
  try { const body = await request.json(); return NextResponse.json({ eligibility: await buildClassXEligibilitySnapshot(prisma, String(body.studentId ?? ""), String(body.academicYear ?? "")) }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to preview Class X source") }, { status: 400 }); }
}
