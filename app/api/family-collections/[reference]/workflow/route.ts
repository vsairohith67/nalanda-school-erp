import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { safeClientError } from "@/lib/client-errors";
import { correctFamilyCollection, reverseFamilyCollection } from "@/lib/family-collections";
import { privateFinanceJson } from "@/lib/finance-privacy";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "").toUpperCase();
  const permission = action === "REVERSE" ? "CANCEL_FINAL_RECEIPT" : action === "CORRECT" ? "CORRECT_FINAL_RECEIPT" : null;
  if (!permission) return privateFinanceJson({ error: "Family workflow action is not supported" }, { status: 400 });
  const auth = await requireApiPermission(permission);
  if (auth.response) return auth.response;
  try {
    const reference = decodeURIComponent((await params).reference);
    const actor = { id: auth.user.id, name: auth.user.name, role: auth.user.role };
    const collection = action === "REVERSE"
      ? await reverseFamilyCollection(prisma, reference, body, actor)
      : await correctFamilyCollection(prisma, reference, body, actor);
    return privateFinanceJson({ collection });
  } catch (error) {
    return privateFinanceJson({ error: safeClientError(error, "Unable to govern family collection") }, { status: status(error) });
  }
}

function status(error: unknown) {
  return error && typeof error === "object" && "status" in error ? Number((error as { status: unknown }).status) : 400;
}
