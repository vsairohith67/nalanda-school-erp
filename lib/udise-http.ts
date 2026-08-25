import { NextResponse } from "next/server";

export const UDISE_PRIVATE_HEADERS = Object.freeze({
  "cache-control": "private, no-store",
  pragma: "no-cache",
  "x-content-type-options": "nosniff",
  vary: "Cookie"
});

export function udisePrivateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: UDISE_PRIVATE_HEADERS });
}
