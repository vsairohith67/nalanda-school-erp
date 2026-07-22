import { describe, expect, it, vi } from "vitest";
import { logoutErrorMessage, postLogout } from "../lib/logout-action-state";

describe("logout action state", () => {
  it("posts to the logout API with an abort signal", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true
    });

    await postLogout(fetcher as unknown as typeof fetch);

    expect(fetcher).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal: expect.any(AbortSignal)
    });
  });

  it("surfaces API errors so the button can be retried", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Logout failed" })
    });

    await expect(postLogout(fetcher as unknown as typeof fetch)).rejects.toThrow("Logout failed");
  });

  it("uses a clear timeout message for hung logout requests", () => {
    expect(logoutErrorMessage(new DOMException("Timed out", "AbortError"))).toBe(
      "Logout is taking too long. Please try again."
    );
  });
});
