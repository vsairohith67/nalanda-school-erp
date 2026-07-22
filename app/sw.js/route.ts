import { buildServiceWorkerSource } from "@/lib/pwa-service-worker";

export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(buildServiceWorkerSource(), {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
      "service-worker-allowed": "/",
      "content-security-policy": "default-src 'self'; script-src 'self'; worker-src 'self'",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer"
    }
  });
}

