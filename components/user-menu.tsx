"use client";

import { Download, KeyRound, LogOut, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AuthUser } from "@/lib/auth";
import Link from "next/link";
import { logoutErrorMessage, postLogout } from "@/lib/logout-action-state";
import { clearNalandaPwaCaches } from "@/lib/pwa-client";

export function UserMenu({ user }: { user: AuthUser }) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const logoutInFlight = useRef(false);
  const redirectFallbackTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (redirectFallbackTimer.current) window.clearTimeout(redirectFallbackTimer.current);
  }, []);

  async function logout() {
    if (logoutInFlight.current) return;
    logoutInFlight.current = true;
    setLoggingOut(true);
    setLogoutError("");
    try {
      const [cacheResult, logoutResult] = await Promise.allSettled([
        clearNalandaPwaCaches(),
        postLogout()
      ]);
      void cacheResult;
      if (logoutResult.status === "rejected") throw logoutResult.reason;
      redirectFallbackTimer.current = window.setTimeout(() => {
        if (window.location.pathname !== "/login") {
          logoutInFlight.current = false;
          setLoggingOut(false);
          setLogoutError("Logout completed, but the login page did not open. Please try again.");
        }
      }, 4000);
      window.location.replace("/login");
    } catch (error) {
      logoutInFlight.current = false;
      setLoggingOut(false);
      setLogoutError(logoutErrorMessage(error));
    }
  }

  return (
    <details className="user-menu">
      <summary>
        <UserRound size={17} aria-hidden />
        <span>
          <strong>{user.name}</strong>
          <small>{user.role}</small>
        </span>
      </summary>
      <div className="user-menu-popover">
        <div>
          <strong>{user.name}</strong>
          <span>@{user.username}</span>
          <span>{user.role}</span>
        </div>
        <Link className="button secondary" href="/change-password">
          <KeyRound size={16} aria-hidden />
          Change Password
        </Link>
        <Link className="button secondary" href="/install-app">
          <Download size={16} aria-hidden />
          Install App
        </Link>
        <button type="button" className="secondary" onClick={logout} disabled={loggingOut}>
          <LogOut size={16} aria-hidden />
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
        {logoutError ? <div className="error" role="alert">{logoutError}</div> : null}
      </div>
    </details>
  );
}
