import { PWA_PUBLIC_CACHE_PATHS } from "@/lib/pwa-cache-policy";
import {
  NALANDA_PWA_CACHE_PREFIX,
  PWA_BUILD_VERSION,
  PWA_STATIC_CACHE_NAME
} from "@/lib/pwa-version";

const PRECACHE_PATHS = [
  "/offline",
  "/manifest.webmanifest",
  "/nalanda-logo.jpg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png"
];

export const PWA_MESSAGE_TYPES = [
  "SKIP_WAITING",
  "CLEAR_NALANDA_PWA_CACHES",
  "GET_PWA_VERSION"
] as const;

export function buildServiceWorkerSource() {
  return `
"use strict";
const PWA_VERSION = ${JSON.stringify(PWA_BUILD_VERSION)};
const CACHE_PREFIX = ${JSON.stringify(NALANDA_PWA_CACHE_PREFIX)};
const STATIC_CACHE = ${JSON.stringify(PWA_STATIC_CACHE_NAME)};
const OFFLINE_PATH = "/offline";
const PRECACHE_PATHS = ${JSON.stringify(PRECACHE_PATHS)};
const PUBLIC_CACHE_PATHS = new Set(${JSON.stringify([...PWA_PUBLIC_CACHE_PATHS])});
const MESSAGE_TYPES = new Set(${JSON.stringify(PWA_MESSAGE_TYPES)});

function isNalandaCacheName(name) {
  return name.startsWith(CACHE_PREFIX);
}

function isSafeStaticRequest(request) {
  if (request.method !== "GET" || request.mode === "navigate") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.search || url.hash) return false;
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname === "/login" ||
    url.pathname === OFFLINE_PATH ||
    url.pathname.startsWith("/_next/image")
  ) return false;
  return url.pathname.startsWith("/_next/static/") || PUBLIC_CACHE_PATHS.has(url.pathname);
}

function isSafeStaticResponse(request, response) {
  if (!isSafeStaticRequest(request)) return false;
  if (!response || !response.ok || response.status !== 200 || response.redirected) return false;
  const cacheControl = (response.headers.get("cache-control") || "").toLowerCase();
  if (cacheControl.includes("no-store") || cacheControl.includes("private")) return false;
  if (response.headers.get("set-cookie")) return false;
  const path = new URL(request.url).pathname;
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (path === "/manifest.webmanifest") {
    return contentType.includes("application/manifest+json") || contentType.includes("application/json");
  }
  return !["text/html", "application/json", "application/pdf", "text/csv", "application/octet-stream"]
    .some((type) => contentType.includes(type));
}

async function fetchApprovedPrecachePath(path) {
  const request = new Request(path, { method: "GET", cache: "reload", credentials: "omit" });
  const response = await fetch(request);
  if (!response.ok || response.status !== 200 || response.redirected) return;
  const cacheControl = (response.headers.get("cache-control") || "").toLowerCase();
  if (cacheControl.includes("private") || response.headers.get("set-cookie")) return;
  const cache = await caches.open(STATIC_CACHE);
  await cache.put(path, response);
}

async function clearNalandaCaches(keepCurrent) {
  const names = await caches.keys();
  await Promise.all(names
    .filter((name) => isNalandaCacheName(name) && (!keepCurrent || name !== STATIC_CACHE))
    .map((name) => caches.delete(name)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(Promise.allSettled(PRECACHE_PATHS.map(fetchApprovedPrecachePath)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await clearNalandaCaches(true);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => {
      const cached = await caches.match(OFFLINE_PATH, { cacheName: STATIC_CACHE });
      return cached || new Response(
        "<!doctype html><html lang=\\"en\\"><meta charset=\\"utf-8\\"><title>Nalanda ERP - Offline</title><body><main><h1>Nalanda Public School ERP</h1><p>You are offline.</p><p>Reconnect to continue securely. School records are not stored for offline use.</p></main></body></html>",
        { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
      );
    }));
    return;
  }

  if (!isSafeStaticRequest(request)) return;
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith((async () => {
      const cached = await caches.match(request, { cacheName: STATIC_CACHE });
      if (cached) return cached;
      const response = await fetch(request);
      if (isSafeStaticResponse(request, response)) {
        const cache = await caches.open(STATIC_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request, { cacheName: STATIC_CACHE });
    const network = fetch(request).then(async (response) => {
      if (isSafeStaticResponse(request, response)) {
        const cache = await caches.open(STATIC_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    });
    if (cached) {
      event.waitUntil(network.catch(() => undefined));
      return cached;
    }
    return network;
  })());
});

self.addEventListener("message", (event) => {
  const type = typeof event.data === "string" ? event.data : event.data && event.data.type;
  if (!MESSAGE_TYPES.has(type)) return;
  if (type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (type === "CLEAR_NALANDA_PWA_CACHES") {
    event.waitUntil(clearNalandaCaches(false).then(() => {
      if (event.ports && event.ports[0]) event.ports[0].postMessage({ ok: true });
    }));
    return;
  }
  if (type === "GET_PWA_VERSION" && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ version: PWA_VERSION, cacheName: STATIC_CACHE });
  }
});
`.trimStart();
}

