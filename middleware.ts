import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";
import { isPublicWebsitePath } from "@/lib/public-website-routing";
import {
  applicationOrigin,
  contentSecurityPolicy,
  isProviderWebhookPath,
  requestBodyTooLarge,
  unsafeRequestOriginAllowed
} from "@/lib/request-security";

const publicPaths = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/setup",
  "/offline",
  "/manifest.webmanifest",
  "/sw.js",
  "/nalanda-logo.jpg",
  "/nalanda-logo-transparent.png",
  "/api/auth/login",
  "/api/auth/recovery/request",
  "/api/auth/recovery/reset",
  "/api/deployment-health",
  "/api/setup"
];
const publicPathPrefixes = ["/api/whatsapp/webhook/", "/api/sms-email/webhook/", "/icons/"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const applySecurityHeaders = (response: NextResponse) => {
    response.headers.set("content-security-policy", contentSecurityPolicy(nonce));
    response.headers.set("cross-origin-opener-policy", "same-origin");
    response.headers.set("cross-origin-resource-policy", "same-origin");
    return response;
  };
  if (await requestBodyTooLarge(request)) {
    const response = NextResponse.json({ error: "Request body is too large" }, { status: 413 });
    response.headers.set("cache-control", "private, no-store");
    return applySecurityHeaders(response);
  }
  if (!unsafeRequestOriginAllowed(request)) {
    const response = NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
    response.headers.set("cache-control", "private, no-store");
    return applySecurityHeaders(response);
  }
  const isPublicWebsite = isPublicWebsitePath(pathname);
  const isPublic =
    isPublicWebsite ||
    publicPaths.includes(pathname) ||
    publicPathPrefixes.some((prefix) => pathname.startsWith(prefix)) ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico";
  const session = isPublic ? null : await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (!isPublic && !session) {
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json({ error: "Authentication required" }, { status: 401 });
      response.headers.set("cache-control", "private, no-store");
      return applySecurityHeaders(response);
    }
    const loginUrl = new URL("/login", applicationOrigin(request));
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("cache-control", "private, no-store");
    return applySecurityHeaders(response);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  if (isPublicWebsite) requestHeaders.set("x-nalanda-public-website", "1");
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (isPublicWebsite) {
    response.headers.set("cache-control", "public, max-age=0, must-revalidate");
    response.headers.set("x-nalanda-route-boundary", "public-content-only");
  }
  if (pathname.startsWith("/api/")) response.headers.set("cache-control", "private, no-store");
  if (pathname === "/forgot-password" || pathname === "/reset-password") {
    response.headers.set("cache-control", "private, no-store");
  }
  if (!isPublic && !pathname.startsWith("/_next/")) {
    response.headers.set("cache-control", "private, no-store");
  }
  if (isProviderWebhookPath(pathname)) response.headers.set("cache-control", "private, no-store");
  return applySecurityHeaders(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
