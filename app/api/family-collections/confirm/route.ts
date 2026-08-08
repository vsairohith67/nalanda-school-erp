import { NextRequest } from "next/server";
import { hasUserPermission, requireApiPermission } from "@/lib/auth";
import { safeClientError } from "@/lib/client-errors";
import { privateFinanceJson } from "@/lib/finance-privacy";
import { prisma } from "@/lib/prisma";
import { confirmFamilyCollection } from "@/lib/family-collections";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("CONFIRM_FAMILY_COLLECTIONS");
  if (auth.response) return auth.response;
  if (!(await hasUserPermission(auth.user, "ISSUE_FAMILY_RECEIPTS"))) {
    return privateFinanceJson({ error: "Family receipt issue permission is required" }, { status: 403 });
  }
  try {
    const collection = await confirmFamilyCollection(prisma, await request.json(), {
      id: auth.user.id,
      name: auth.user.name,
      role: auth.user.role
    });
    return privateFinanceJson({ collection }, { status: 201 });
  } catch (error) {
    return privateFinanceJson({ error: safeClientError(error, "Unable to confirm family collection") }, { status: status(error) });
  }
}

function status(error: unknown) {
  return error && typeof error === "object" && "status" in error ? Number((error as { status: unknown }).status) : 400;
}
