import { NextResponse } from "next/server";
import { sessionCookieName, sessionCookieSecure } from "@/lib/session-token";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName(), "", {
    httpOnly: true,
    sameSite: "strict",
    secure: sessionCookieSecure(),
    path: "/",
    expires: new Date(0)
  });
  return response;
}
