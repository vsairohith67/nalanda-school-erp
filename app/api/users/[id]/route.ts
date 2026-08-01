import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";

export async function PUT() {
  const auth = await requireApiPermission("MANAGE_IAM_USERS");
  if (auth.response) return auth.response;
  const response = NextResponse.json({ error: "Use the governed opaque-handle Named Users workflow" }, { status: 410 });
  response.headers.set("cache-control", "private, no-store");
  return response;
}
