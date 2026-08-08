import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { safeClientError } from "@/lib/client-errors";
import { privateFinanceJson } from "@/lib/finance-privacy";
import { prisma } from "@/lib/prisma";
import { previewFamilyCollection } from "@/lib/family-collections";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("CREATE_FAMILY_COLLECTIONS");
  if (auth.response) return auth.response;
  try {
    const preview = await previewFamilyCollection(prisma, await request.json());
    return privateFinanceJson({ preview: publicPreview(preview) });
  } catch (error) {
    return privateFinanceJson({ error: safeClientError(error, "Unable to preview family collection") }, { status: status(error) });
  }
}

function publicPreview(preview: Awaited<ReturnType<typeof previewFamilyCollection>>) {
  return {
    planHash: preview.planHash,
    policyVersion: preview.policyVersion,
    familyCreditPaise: preview.familyCreditPaise,
    totalPaise: preview.totalPaise,
    payer: preview.payer,
    collectionDate: preview.collectionDate,
    instruments: preview.instruments.map(({ referenceKey: _referenceKey, ...row }) => row),
    allocations: preview.allocations,
    shares: preview.shares,
    remainingByStudent: preview.remainingByStudent,
    eligibleDues: preview.eligibleDues.map(({ studentKey: _studentKey, dueSnapshotHash: _dueSnapshotHash, ...row }) => row)
  };
}

function status(error: unknown) {
  return error && typeof error === "object" && "status" in error ? Number((error as { status: unknown }).status) : 400;
}
