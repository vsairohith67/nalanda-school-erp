import { NextResponse } from "next/server";

export function publicWebsiteApiFailure(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "The website-content action failed safely.";
  const safe = /unique constraint|prisma|database|sql|stack|filesystem|path/i.test(message)
    ? "A page, post, slug or code already uses that value."
    : message.slice(0, 500);
  return NextResponse.json({ error: safe }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };
