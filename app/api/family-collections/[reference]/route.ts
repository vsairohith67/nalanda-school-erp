import { NextRequest } from "next/server";
import { hasUserPermission, requireUser } from "@/lib/auth";
import { safeClientError } from "@/lib/client-errors";
import { familyReceiptForUser } from "@/lib/family-collections";
import { privateFinanceJson } from "@/lib/finance-privacy";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const user = await requireUser();
  const allowed = user.role === "PARENT"
    ? await hasUserPermission(user, "VIEW_OWN_FAMILY_RECEIPTS")
    : await hasUserPermission(user, "VIEW_FAMILY_COLLECTIONS");
  if (!allowed) return privateFinanceJson({ error: "Not authorized" }, { status: 403 });
  try {
    const collection = await familyReceiptForUser(prisma, decodeURIComponent((await params).reference), user, request.nextUrl.searchParams.get("child") ?? undefined);
    return privateFinanceJson({ collection });
  } catch (error) {
    return privateFinanceJson({ error: safeClientError(error, "Family receipt was not found") }, { status: status(error) });
  }
}

function status(error: unknown) {
  return error && typeof error === "object" && "status" in error ? Number((error as { status: unknown }).status) : 400;
}
