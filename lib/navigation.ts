export function safeInternalPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export function isExactActiveRoute(pathname: string, href: string) {
  const normalize = (value: string) => value.length > 1 ? value.replace(/\/+$/, "") : value;
  return normalize(pathname) === normalize(href);
}

export function defaultPathForRole(role: string) {
  if (role === "PARENT") return "/parent";
  if (role === "TEACHER") return "/teacher";
  return "/dashboard";
}
