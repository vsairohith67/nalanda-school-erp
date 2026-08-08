import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { safeClientError } from "@/lib/client-errors";
import { privateFinanceJson } from "@/lib/finance-privacy";
import { prisma } from "@/lib/prisma";
import { findFamilyEligibility } from "@/lib/family-collections";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("CREATE_FAMILY_COLLECTIONS");
  if (auth.response) return auth.response;
  try {
    const guardianQuery = request.nextUrl.searchParams.get("guardian")?.trim();
    const admissionNo = request.nextUrl.searchParams.get("admissionNo")?.trim();
    return privateFinanceJson({ rows: await findFamilyEligibility(prisma, { guardianQuery, admissionNo }) });
  } catch (error) {
    return privateFinanceJson({ error: safeClientError(error, "Unable to resolve family eligibility") }, { status: status(error) });
  }
}

function status(error: unknown) {
  return error && typeof error === "object" && "status" in error ? Number((error as { status: unknown }).status) : 400;
}
