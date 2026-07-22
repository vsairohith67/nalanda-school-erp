export const LOGOUT_TIMEOUT_MS = 8000;

export function logoutErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Logout is taking too long. Please try again.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Unable to logout. Please try again.";
}

export async function postLogout(
  fetcher: typeof fetch = fetch,
  timeoutMs = LOGOUT_TIMEOUT_MS
) {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(String(data.error || "Unable to logout. Please try again."));
    }
  } finally {
    globalThis.clearTimeout(timer);
  }
}
