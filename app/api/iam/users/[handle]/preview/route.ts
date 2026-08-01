import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { previewNamedUserAccess } from "@/lib/iam/users";
import { safeClientError } from "@/lib/client-errors";

export async function GET(request: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  const auth = await requireApiPermission("VIEW_IAM_ACCESS");
  if (auth.response) return auth.response;
  try {
    const decisions = await previewNamedUserAccess(prisma, (await params).handle, request.nextUrl.searchParams.get("role") ?? undefined);
    return privateJson({ decisions });
  } catch (error) {
    return privateJson({ error: safeClientError(error, "Effective access preview is unavailable") }, 404);
  }
}

function privateJson(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "private, no-store");
  return response;
}
