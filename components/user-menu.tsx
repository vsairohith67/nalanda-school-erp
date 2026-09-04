"use client";

import { ChevronDown, Download, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AuthUser } from "@/lib/auth";
import Link from "next/link";
import { logoutErrorMessage, postLogout } from "@/lib/logout-action-state";
import { clearNalandaPwaCaches } from "@/lib/pwa-client";
import { roleDisplayLabel, userInitials } from "@/lib/role-presentation";
import { ThemeToggle } from "@/components/theme-toggle";
import { ActiveContextSwitcher } from "@/components/iam/active-context-switcher";
import { lockOfflineVaultAcrossTabs } from "@/lib/offline-sync/client/coordinator";

export function UserMenu({ user }: { user: AuthUser }) {
  const roleContext = roleDisplayLabel(user.role);
  const activeRole = user.role;
  const designation = user.designation ?? roleContext;
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
      lockOfflineVaultAcrossTabs("LOGOUT");
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
    <details className="user-menu" suppressHydrationWarning>
      <summary aria-label={`Account menu for ${user.name}, ${designation}, ${roleContext} context`}>
        <span className="user-avatar" aria-hidden>{userInitials(user.name)}</span>
        <span className="user-menu-summary-copy">
          <strong>{user.name}</strong>
          <small>{designation}</small>
        </span>
        <ChevronDown className="user-menu-chevron" size={15} aria-hidden />
      </summary>
      <div className="user-menu-popover">
        <div className="user-menu-identity">
          <strong>{user.name}</strong>
          <span>@{user.username}</span>
          <span>{designation}</span>
          {designation !== roleContext ? <span>{roleContext} context</span> : null}
        </div>
        <ActiveContextSwitcher activeRole={activeRole} />
        <Link className="button secondary" href="/change-password">
          <KeyRound size={16} aria-hidden />
          Change Password
        </Link>
        <Link className="button secondary" href="/account-security">
          <ShieldCheck size={16} aria-hidden />
          Account Security
        </Link>
        <Link className="button secondary" href="/access-context">
          <ShieldCheck size={16} aria-hidden />
          Access Context
        </Link>
        <Link className="button secondary" href="/install-app">
          <Download size={16} aria-hidden />
          Install App
        </Link>
        <div className="user-menu-theme">
          <span>Appearance</span>
          <ThemeToggle />
        </div>
        <button type="button" className="secondary" onClick={logout} disabled={loggingOut}>
          <LogOut size={16} aria-hidden />
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
        {logoutError ? <div className="error" role="alert">{logoutError}</div> : null}
      </div>
    </details>
  );
}
