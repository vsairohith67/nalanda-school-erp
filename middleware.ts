import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";
import { isPublicWebsitePath } from "@/lib/public-website-routing";
import {
  applicationOrigin,
  contentSecurityPolicy,
  isProviderWebhookPath,
  requestQueryBudgetIssue,
  requestJsonBudgetIssue,
  requestBodyTooLarge,
  unsafeRequestOriginAllowed
} from "@/lib/request-security";
import { enforceOperationRateLimit } from "@/lib/security-resilience";
import { emitSecurityResilienceEvent } from "@/lib/security-observability";
import { nativeDirectIngressAllowed, nativeDirectRateLimitActor, trustedClientIdentity, trustedProxyRequired } from "@/lib/trusted-client";

const publicPaths = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/setup",
  "/offline",
  "/offline/finance",
  "/maintenance",
  "/manifest.webmanifest",
  "/sw.js",
  "/nalanda-logo.jpg",
  "/nalanda-logo-transparent.png",
  "/api/auth/login",
  "/api/auth/recovery/request",
  "/api/auth/recovery/reset",
  "/api/health",
  "/api/health/live",
  "/api/health/ready",
  "/api/internal/health/dependencies",
  "/api/internal/metrics",
  "/api/deployment-health",
  "/api/release/client-version",
  "/api/setup"
];
const publicPathPrefixes = [
  "/api/public/admissions/",
  "/api/public/support/",
  "/api/event-media/public/",
  "/api/whatsapp/webhook/",
  "/api/sms-email/webhook/",
  "/icons/"
];
const offlinePublicShellPaths = new Set(["/offline", "/offline/finance"]);
const nativeRouteAuthorizedPaths = new Set([
  "/api/native-auth/request",
  "/api/native-auth/exchange",
  "/api/native-auth/refresh",
  "/api/native-auth/logout",
  "/api/native/v1/context",
  "/api/native/v1/reference-pack",
  "/api/native/v1/sync",
  "/api/native/v1/conflicts"
]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isOfflinePublicShell = offlinePublicShellPaths.has(pathname);
  const isNativeRouteAuthorized = nativeRouteAuthorizedPaths.has(pathname);
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const applySecurityHeaders = (response: NextResponse) => {
    response.headers.set("content-security-policy", contentSecurityPolicy(nonce));
    response.headers.set("cross-origin-opener-policy", "same-origin");
    response.headers.set("cross-origin-resource-policy", "same-origin");
    return response;
  };
  const clientIdentity = trustedClientIdentity(request.headers);
  const proxyHealthPath = pathname === "/api/health" || pathname.startsWith("/api/health/") || pathname === "/api/deployment-health";
  if (trustedProxyRequired() && !clientIdentity.trusted && !proxyHealthPath) {
    emitSecurityResilienceEvent("EDGE_ORIGIN_MISMATCH", { reason: clientIdentity.reason, routeFamily: pathname.startsWith("/api/") ? "api" : "page", status: 403 });
    const response = NextResponse.json({ error: "Trusted ingress is required." }, { status: 403 });
    response.headers.set("cache-control", "private, no-store");
    return applySecurityHeaders(response);
  }
  const directNativeIngress = isNativeRouteAuthorized && !clientIdentity.trusted && nativeDirectIngressAllowed();
  const directNativeActor = directNativeIngress ? nativeDirectRateLimitActor(request.headers) : null;
  if (isNativeRouteAuthorized && !clientIdentity.trusted && !directNativeIngress) {
    emitSecurityResilienceEvent("EDGE_ORIGIN_MISMATCH", { reason: "native-ingress-untrusted", routeFamily: "native", status: 403 });
    const response = NextResponse.json({ error: "Trusted native ingress is required.", code: "NATIVE_INGRESS_REJECTED" }, { status: 403 });
    response.headers.set("cache-control", "private, no-store");
    return applySecurityHeaders(response);
  }
  if (directNativeIngress && !directNativeActor) {
    emitSecurityResilienceEvent("EDGE_ORIGIN_MISMATCH", { reason: "native-local-client-id-missing", routeFamily: "native", status: 403 });
    const response = NextResponse.json({ error: "A valid local native client identity is required.", code: "NATIVE_CLIENT_ID_REQUIRED" }, { status: 403 });
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
  const sessionReference = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const session = isPublic || isNativeRouteAuthorized ? null : sessionReference;

  const rateLimit = await enforceOperationRateLimit(pathname, request.method, {
    ...(clientIdentity.trusted ? { ip: clientIdentity.source } : directNativeActor ? { ip: `local-native:${directNativeActor}` } : {}),
    ...(sessionReference ? { session: sessionReference.sessionId } : {})
  }, { dimensions: ["ip", "session", "endpoint", "operationCost"] });
  if (!rateLimit.allowed) {
    emitSecurityResilienceEvent("RATE_LIMIT_HIT", {
      policy: rateLimit.policy?.id,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      status: rateLimit.status
    });
    if (rateLimit.policy?.id === "bulk-export" || rateLimit.policy?.id === "real-data-import") {
      emitSecurityResilienceEvent("EXCESSIVE_EXPORT_IMPORT", { policy: rateLimit.policy.id, status: rateLimit.status });
    }
    if (rateLimit.policy?.id === "upload" || rateLimit.policy?.id === "event-media") {
      emitSecurityResilienceEvent("BLOCKED_UPLOAD", { policy: rateLimit.policy.id, status: rateLimit.status });
    }
    const response = NextResponse.json(
      { error: rateLimit.status === 429 ? "Too many requests. Please retry shortly." : "Abuse protection is temporarily unavailable. Please retry shortly." },
      { status: rateLimit.status }
    );
    response.headers.set("cache-control", "private, no-store");
    response.headers.set("retry-after", String(Math.max(1, rateLimit.retryAfterSeconds)));
    return applySecurityHeaders(response);
  }

  if (!isPublic && !isNativeRouteAuthorized && !session) {
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

  // Native protocol routes authenticate and authorize inside their route handlers
  // with opaque credentials and device signatures. They do not carry browser
  // cookies and therefore must not be coupled to the browser CSRF boundary.
  if (!isNativeRouteAuthorized && !unsafeRequestOriginAllowed(request)) {
    const response = NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
    response.headers.set("cache-control", "private, no-store");
    return applySecurityHeaders(response);
  }
  const queryIssue = requestQueryBudgetIssue(request.nextUrl);
  if (queryIssue) {
    const response = NextResponse.json({ error: queryIssue }, { status: 400 });
    response.headers.set("cache-control", "private, no-store");
    return applySecurityHeaders(response);
  }

  const maintenanceActive = process.env.NALANDA_MAINTENANCE_MODE === "true";
  const maintenanceAllowed = pathname === "/maintenance" || pathname === "/api/health" || pathname === "/api/deployment-health" || pathname === "/api/release/client-version" || pathname.startsWith("/technical-operations") || pathname === "/api/technical-operations" || pathname.startsWith("/api/technical-operations/") || pathname.startsWith("/_next/") || pathname.startsWith("/icons/") || pathname === "/manifest.webmanifest" || pathname === "/sw.js";
  if (maintenanceActive && !maintenanceAllowed) {
    if (pathname.startsWith("/api/") || !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const response = NextResponse.json({ error: "Nalanda ERP is in a governed maintenance window. Save work and retry after maintenance." }, { status: 503 });
      response.headers.set("cache-control", "private, no-store");
      response.headers.set("retry-after", "300");
      return applySecurityHeaders(response);
    }
    const response = NextResponse.redirect(new URL("/maintenance", applicationOrigin(request)));
    response.headers.set("cache-control", "no-store");
    return applySecurityHeaders(response);
  }

  if (await requestBodyTooLarge(request)) {
    if (/(?:upload|attachments|documents|pages|assets)/i.test(pathname)) emitSecurityResilienceEvent("BLOCKED_UPLOAD", { routeFamily: "api", status: 413 });
    if (/(?:import|export)/i.test(pathname)) emitSecurityResilienceEvent("EXCESSIVE_EXPORT_IMPORT", { routeFamily: "api", status: 413 });
    const response = NextResponse.json({ error: "Request body is too large" }, { status: 413 });
    response.headers.set("cache-control", "private, no-store");
    return applySecurityHeaders(response);
  }
  const jsonBudgetIssue = await requestJsonBudgetIssue(request);
  if (jsonBudgetIssue) {
    if (/(?:import|export)/i.test(pathname)) emitSecurityResilienceEvent("EXCESSIVE_EXPORT_IMPORT", { routeFamily: "api", status: 413 });
    const response = NextResponse.json({ error: jsonBudgetIssue }, { status: 413 });
    response.headers.set("cache-control", "private, no-store");
    return applySecurityHeaders(response);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  if (isPublicWebsite) requestHeaders.set("x-nalanda-public-website", "1");
  if (isOfflinePublicShell) requestHeaders.set("x-nalanda-offline-shell", "1");
  if (pathname === "/maintenance") requestHeaders.set("x-nalanda-maintenance-page", "1");
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (isPublicWebsite) {
    response.headers.set("cache-control", "public, max-age=0, must-revalidate");
    response.headers.set("x-nalanda-route-boundary", "public-content-only");
  }
  if (isOfflinePublicShell) {
    response.headers.set("cache-control", "public, max-age=0, must-revalidate");
    response.headers.set("x-nalanda-route-boundary", "offline-public-shell");
  }
  if (pathname.startsWith("/api/")) response.headers.set("cache-control", "private, no-store");
  if (pathname === "/forgot-password" || pathname === "/reset-password") {
    response.headers.set("cache-control", "private, no-store");
  }
  if (!isPublic && !isNativeRouteAuthorized && !pathname.startsWith("/_next/")) {
    response.headers.set("cache-control", "private, no-store");
  }
  if (isProviderWebhookPath(pathname)) response.headers.set("cache-control", "private, no-store");
  return applySecurityHeaders(response);
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image).*)"]
};
