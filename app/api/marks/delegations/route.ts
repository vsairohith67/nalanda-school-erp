import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { AcademicIntegrityError, grantMarksDelegation, listMarksDelegationAdministration, revokeMarksDelegation } from "@/lib/academic-integrity";
import { prisma } from "@/lib/prisma";

function errorResponse(error: unknown) {
  if (error instanceof AcademicIntegrityError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  return NextResponse.json({ error: "The marks delegation change could not be completed safely." }, { status: 400 });
}

export async function GET() {
  const auth = await requireApiPermission("ENTER_MARKS");
  if (auth.response || !auth.user) return auth.response;
  try { return NextResponse.json(await listMarksDelegationAdministration(prisma, auth.user)); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("ENTER_MARKS");
  if (auth.response || !auth.user) return auth.response;
  try { return NextResponse.json(await grantMarksDelegation(prisma, auth.user, await request.json()), { status: 201 }); }
  catch (error) { return errorResponse(error); }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiPermission("ENTER_MARKS");
  if (auth.response || !auth.user) return auth.response;
  try { return NextResponse.json(await revokeMarksDelegation(prisma, auth.user, await request.json())); }
  catch (error) { return errorResponse(error); }
}
