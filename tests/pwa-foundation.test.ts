import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPwaManifest, PWA_ICON_PATHS } from "../lib/pwa-manifest";
import {
  isNalandaCacheName,
  isSafeOfflinePrecacheResponse,
  isSafePwaStaticRequest,
  isSafePwaStaticResponse,
  PWA_OFFLINE_PATH
} from "../lib/pwa-cache-policy";
import { buildServiceWorkerSource, PWA_MESSAGE_TYPES } from "../lib/pwa-service-worker";
import {
  NALANDA_PWA_CACHE_PREFIX,
  normalisePwaVersion,
  PWA_STATIC_CACHE_NAME
} from "../lib/pwa-version";
import { GET as getServiceWorker } from "../app/sw.js/route";

const origin = "https://erp.nalandaps.com";
const request = (path: string, extra: Record<string, string> = {}) => ({
  url: `${origin}${path}`,
  method: "GET",
  mode: "no-cors",
  ...extra
});
const response = (headers: Record<string, string> = {}, extra: Record<string, unknown> = {}) => ({
  ok: true,
  status: 200,
  redirected: false,
  headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  ...extra
});
const source = (path: string) => readFileSync(path, "utf8");

function pngDimensions(path: string) {
  const bytes = readFileSync(path);
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("PWA manifest and icon assets", () => {
  it("uses the required identity, launch scope and standalone display", () => {
    expect(buildPwaManifest()).toMatchObject({
      name: "Nalanda Public School ERP",
      short_name: "Nalanda ERP",
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "any",
      lang: "en-IN",
      dir: "ltr"
    });
  });

  it("declares local PNG icons with exact dimensions and maskable purposes", () => {
    const icons = buildPwaManifest().icons ?? [];
    expect(icons).toHaveLength(4);
    expect(icons.filter((icon) => icon.purpose === "maskable")).toHaveLength(2);
    for (const icon of icons) {
      expect(icon.src).toMatch(/^\/icons\/[^/]+\.png$/);
      expect(icon.type).toBe("image/png");
      expect(icon.sizes).toMatch(/^(192|512)x\1$/);
      const size = Number(icon.sizes?.split("x")[0]);
      expect(pngDimensions(`public${icon.src}`)).toEqual({ width: size, height: size });
    }
  });

  it("provides the Apple touch icon and no external manifest resources", () => {
    expect(pngDimensions("public/icons/apple-touch-icon.png")).toEqual({ width: 180, height: 180 });
    expect(PWA_ICON_PATHS).toContain("/icons/apple-touch-icon.png");
    expect(JSON.stringify(buildPwaManifest())).not.toMatch(/https?:\/\//);
  });

  it("does not declare privileged shortcuts, handlers, share targets or record screenshots", () => {
    const manifest = buildPwaManifest() as Record<string, unknown>;
    for (const key of ["shortcuts", "file_handlers", "protocol_handlers", "share_target", "screenshots"]) {
      expect(manifest).not.toHaveProperty(key);
    }
  });
});

describe("static-only cache policy", () => {
  it("allows only same-origin immutable build assets and explicit public assets", () => {
    expect(isSafePwaStaticRequest(request("/_next/static/chunks/app-a1.js"), origin)).toBe(true);
    expect(isSafePwaStaticRequest(request("/icons/icon-192.png"), origin)).toBe(true);
    expect(isSafePwaStaticRequest(request("/nalanda-logo.jpg"), origin)).toBe(true);
    expect(isSafePwaStaticRequest(request("/manifest.webmanifest"), origin)).toBe(true);
  });

  it.each([
    ["/", "navigate"],
    ["/parent", "navigate"],
    ["/teacher", "navigate"],
    ["/students", "navigate"],
    ["/login", "no-cors"],
    ["/api/parent/dashboard", "cors"],
    ["/_next/image?url=%2Fnalanda-logo.jpg&w=256&q=75", "no-cors"],
    ["/api/backup", "cors"],
    ["/api/cloud-backup/health", "cors"],
    ["/api/cloud-backup/artifacts/opaque/verify", "cors"],
    ["/reports/export.csv", "no-cors"],
    [PWA_OFFLINE_PATH, "navigate"]
  ])("rejects network-only or sensitive path %s", (path, mode) => {
    expect(isSafePwaStaticRequest(request(path, { mode }), origin)).toBe(false);
  });

  it("rejects non-GET, cross-origin and query-bearing cache keys", () => {
    expect(isSafePwaStaticRequest(request("/icons/icon-192.png", { method: "POST" }), origin)).toBe(false);
    expect(isSafePwaStaticRequest({ url: "https://cdn.example/icon.png", method: "GET" }, origin)).toBe(false);
    expect(isSafePwaStaticRequest(request("/icons/icon-192.png?student=1"), origin)).toBe(false);
  });

  it("rejects redirects, errors, cookies, private/no-store and document/download responses", () => {
    const staticRequest = request("/_next/static/chunks/app-a1.js");
    expect(isSafePwaStaticResponse(staticRequest, response({ "content-type": "text/javascript" }), origin)).toBe(true);
    expect(isSafePwaStaticResponse(staticRequest, response({}, { ok: false, status: 500 }), origin)).toBe(false);
    expect(isSafePwaStaticResponse(staticRequest, response({}, { redirected: true }), origin)).toBe(false);
    expect(isSafePwaStaticResponse(staticRequest, response({ "set-cookie": "session=secret" }), origin)).toBe(false);
    expect(isSafePwaStaticResponse(staticRequest, response({ "cache-control": "private" }), origin)).toBe(false);
    expect(isSafePwaStaticResponse(staticRequest, response({ "cache-control": "no-store" }), origin)).toBe(false);
    for (const contentType of ["text/html", "application/json", "application/pdf", "text/csv", "application/octet-stream"]) {
      expect(isSafePwaStaticResponse(staticRequest, response({ "content-type": contentType }), origin)).toBe(false);
    }
  });

  it("treats the generic offline page as a narrow precache exception", () => {
    expect(isSafeOfflinePrecacheResponse(response({ "content-type": "text/html" }))).toBe(true);
    expect(isSafeOfflinePrecacheResponse(response({ "set-cookie": "session=secret" }))).toBe(false);
    expect(isSafePwaStaticRequest(request(PWA_OFFLINE_PATH), origin)).toBe(false);
  });
});

describe("service worker lifecycle and protocol", () => {
  const worker = buildServiceWorkerSource();

  it("uses a versioned Nalanda-only cache namespace", () => {
    expect(PWA_STATIC_CACHE_NAME).toMatch(/^nalanda-pwa-static-/);
    expect(normalisePwaVersion(" QA 19D / B ")).toBe("QA-19D-B");
    expect(isNalandaCacheName(PWA_STATIC_CACHE_NAME)).toBe(true);
    expect(isNalandaCacheName("unrelated-cache")).toBe(false);
    expect(worker).toContain(`startsWith(CACHE_PREFIX)`);
  });

  it("installs, waits for explicit activation, claims clients and removes only old Nalanda caches", () => {
    expect(worker).toContain('addEventListener("install"');
    expect(worker).toContain('addEventListener("activate"');
    expect(worker).toContain("self.clients.claim()");
    expect(worker).not.toMatch(/install[\s\S]{0,500}skipWaiting/);
    expect(worker).toContain("isNalandaCacheName(name)");
  });

  it("uses network-only navigation with only the generic offline fallback", () => {
    expect(worker).toContain('request.mode === "navigate"');
    expect(worker).toContain("fetch(request).catch");
    expect(worker).toContain('caches.match(OFFLINE_PATH, { cacheName: STATIC_CACHE })');
    expect(worker).not.toContain('caches.match(request, { cacheName: STATIC_CACHE });\n      return cached || fetch(request)');
  });

  it("allowlists exactly the expected update and cache-control messages", () => {
    expect(PWA_MESSAGE_TYPES).toEqual([
      "SKIP_WAITING",
      "CLEAR_NALANDA_PWA_CACHES",
      "GET_PWA_VERSION"
    ]);
    expect(worker).toContain("if (!MESSAGE_TYPES.has(type)) return");
  });

  it("contains no push, notification permission, background sync or offline mutation queue", () => {
    expect(worker).not.toMatch(/addEventListener\(["']push/);
    expect(worker).not.toMatch(/notificationclick|PushManager|pushManager|requestPermission|SyncManager|periodicSync/);
    expect(worker).not.toMatch(/offline.{0,20}(queue|replay)|queue.{0,20}(POST|mutation)/i);
  });

  it("serves the worker with strict no-store and same-origin security headers", async () => {
    const result = await getServiceWorker();
    expect(result.headers.get("content-type")).toContain("application/javascript");
    expect(result.headers.get("cache-control")).toContain("no-store");
    expect(result.headers.get("service-worker-allowed")).toBe("/");
    expect(result.headers.get("content-security-policy")).toContain("script-src 'self'");
    expect(result.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("PWA UI, access and privacy integration", () => {
  it("keeps authentication responses explicitly private and non-cacheable", () => {
    const config = source("next.config.ts");
    expect(config).toContain('source: "/api/auth/:path*"');
    expect(config).toMatch(
      /source: "\/api\/auth\/:path\*"[\s\S]{0,240}Cache-Control[\s\S]{0,120}private, no-store/
    );
  });

  it("keeps offline public while install requires login and diagnostics require system health", () => {
    expect(source("middleware.ts")).toContain('"/offline"');
    expect(source("app/install-app/page.tsx")).toContain("await requireUser()");
    expect(source("app/settings/pwa/page.tsx")).toContain('requirePermission("VIEW_SYSTEM_HEALTH")');
  });

  it("uses accessible in-app update and cache dialogs without native dialogs", () => {
    const ui = source("components/pwa-runtime.tsx") + source("components/pwa-cache-controls.tsx");
    expect(ui).toContain('role="dialog"');
    expect(ui).toContain('aria-modal="true"');
    expect(ui).toContain("Confirm Update Now");
    expect(ui).toContain("Clear Offline App Assets");
    expect(ui).not.toMatch(/window\.(alert|confirm|prompt)\s*\(/);
  });

  it("does not automatically reload, activate or resubmit when connection changes", () => {
    const runtime = source("components/pwa-runtime.tsx");
    expect(runtime).toContain("if (!updateRequested.current || reloaded.current) return");
    expect(runtime).toContain("window.location.reload()");
    const onlineHandler = runtime.match(/const handleOnline = \(\) => \{([\s\S]*?)\n    \};/)?.[1] ?? "";
    expect(onlineHandler).not.toMatch(/reload|submit|requestSubmit/);
  });

  it("stores only a non-sensitive install dismissal preference", () => {
    const install = source("components/pwa-install-manager.tsx");
    expect(install).toContain("nalanda-pwa-install-dismissed-at");
    expect(install).toContain("window.localStorage.setItem(INSTALL_DISMISSAL_KEY, new Date().toISOString())");
    expect(install).not.toMatch(/localStorage\.setItem\([^,]+,\s*(user|route|token|password|record)/i);
  });

  it("integrates Nalanda-only cache clearing with server-authoritative logout", () => {
    const userMenu = source("components/user-menu.tsx");
    const client = source("lib/pwa-client.ts");
    expect(userMenu).toContain("clearNalandaPwaCaches()");
    expect(userMenu).toContain("postLogout()");
    expect(client).toContain("startsWith(NALANDA_PWA_CACHE_PREFIX)");
    expect(client).toContain(".filter((name) => name.startsWith(NALANDA_PWA_CACHE_PREFIX))");
    expect(NALANDA_PWA_CACHE_PREFIX).toBe("nalanda-pwa-");
  });

  it("keeps the offline page generic and free of record fields", () => {
    const offline = source("app/offline/page.tsx");
    expect(offline).toContain("School records are not stored for offline use.");
    expect(offline).not.toMatch(/studentName|admissionNo|staffName|receiptNo|guardianId|last viewed/i);
  });

  it("keeps offline recovery actions at the mobile touch-target minimum", () => {
    expect(source("app/globals.css")).toMatch(
      /\.offline-card :is\(\.button, button\)\s*\{\s*min-height: 44px;\s*\}/
    );
  });
});
