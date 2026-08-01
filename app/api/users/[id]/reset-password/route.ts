import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";

export async function POST() {
  const auth = await requireApiPermission("RESET_USER_PASSWORDS");
  if (auth.response) return auth.response;
  const response = NextResponse.json({ error: "Legacy password reset is disabled; use a governed invitation or temporary-password lifecycle action" }, { status: 410 });
  response.headers.set("cache-control", "private, no-store");
  return response;
}
