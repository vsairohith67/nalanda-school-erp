import packageJson from "../package.json";

export const NALANDA_PWA_CACHE_PREFIX = "nalanda-pwa-";

export function normalisePwaVersion(value: string) {
  const safe = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe || "development";
}

export const PWA_BUILD_VERSION = normalisePwaVersion(
  process.env.NEXT_PUBLIC_PWA_BUILD_VERSION || packageJson.version
);

export const PWA_STATIC_CACHE_NAME = `${NALANDA_PWA_CACHE_PREFIX}static-${PWA_BUILD_VERSION}`;

