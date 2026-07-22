export const PWA_PUBLIC_CACHE_PATHS = new Set([
  "/manifest.webmanifest",
  "/nalanda-logo.jpg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png"
]);

export const PWA_OFFLINE_PATH = "/offline";

export type PwaRequestLike = {
  url: string;
  method?: string;
  mode?: string;
};

export type PwaResponseLike = {
  ok: boolean;
  status: number;
  redirected?: boolean;
  headers: { get(name: string): string | null };
};

export function isNalandaCacheName(name: string) {
  return name.startsWith("nalanda-pwa-");
}

export function isSafePwaStaticRequest(
  request: PwaRequestLike,
  origin: string
) {
  if ((request.method ?? "GET").toUpperCase() !== "GET") return false;
  const url = new URL(request.url, origin);
  if (url.origin !== origin || url.search || url.hash) return false;
  if (request.mode === "navigate") return false;
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname === "/login" ||
    url.pathname === PWA_OFFLINE_PATH ||
    url.pathname.startsWith("/_next/image")
  ) {
    return false;
  }
  return url.pathname.startsWith("/_next/static/") || PWA_PUBLIC_CACHE_PATHS.has(url.pathname);
}

export function isSafePwaStaticResponse(
  request: PwaRequestLike,
  response: PwaResponseLike,
  origin: string
) {
  if (!isSafePwaStaticRequest(request, origin)) return false;
  if (!response.ok || response.status !== 200 || response.redirected) return false;
  const cacheControl = (response.headers.get("cache-control") ?? "").toLowerCase();
  if (cacheControl.includes("no-store") || cacheControl.includes("private")) return false;
  if (response.headers.get("set-cookie")) return false;

  const pathname = new URL(request.url, origin).pathname;
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (pathname === "/manifest.webmanifest") {
    return contentType.includes("application/manifest+json") || contentType.includes("application/json");
  }
  return ![
    "text/html",
    "application/json",
    "application/pdf",
    "text/csv",
    "application/octet-stream"
  ].some((type) => contentType.includes(type));
}

export function isSafeOfflinePrecacheResponse(response: PwaResponseLike) {
  if (!response.ok || response.status !== 200 || response.redirected) return false;
  const cacheControl = (response.headers.get("cache-control") ?? "").toLowerCase();
  return !cacheControl.includes("private") && !response.headers.get("set-cookie");
}

