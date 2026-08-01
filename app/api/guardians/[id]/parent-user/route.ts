import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";

export async function POST() {
  const auth = await requireApiPermission("MANAGE_IAM_USERS");
  if (auth.response) return auth.response;
  const response = NextResponse.json({ error: "Create or link pending Parent access through the governed Named Users workflow" }, { status: 410 });
  response.headers.set("cache-control", "private, no-store");
  return response;
}
