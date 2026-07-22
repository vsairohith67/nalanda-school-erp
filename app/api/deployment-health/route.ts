import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const release = process.env.NALANDA_DEPLOYMENT_ID?.trim();
  return NextResponse.json(
    {
      status: "ok",
      service: "nalanda-erp",
      ...(release && /^staging-[a-z0-9._-]+$/i.test(release) ? { release } : {})
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}
