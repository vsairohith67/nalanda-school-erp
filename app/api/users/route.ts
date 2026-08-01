import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listNamedUsers } from "@/lib/iam/users";

export async function GET() {
  const auth = await requireApiPermission("VIEW_IAM_ACCESS");
  if (auth.response) return auth.response;
  return privateJson({ users: await listNamedUsers(prisma, {}) });
}

export async function POST() {
  const auth = await requireApiPermission("MANAGE_IAM_USERS");
  if (auth.response) return auth.response;
  return privateJson({ error: "Use the governed Named Users workflow for pending activation, role assignments and access history" }, 410);
}

function privateJson(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "private, no-store");
  return response;
}
