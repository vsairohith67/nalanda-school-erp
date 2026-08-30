import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./product-experience.css";
import { AppShell } from "@/components/app-shell";
import { ThemeProvider } from "@/components/theme-provider";
import { getCurrentUser, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";
import { permissionSetCan } from "@/lib/role-permissions";
import { enabledOptionalOperationsFeatures } from "@/lib/optional-operations-feature-flags";
import type { CanonicalPermission } from "@/lib/permissions";
import { BANNER_HEALTH_CODES, getSystemHealth } from "@/lib/system-health";
import { getAppInfo } from "@/lib/app-info";
import { isPilotDatabaseUrl } from "@/lib/pilot";
import { PwaRuntime } from "@/components/pwa-runtime";
import { ModalAccessibilityGuard } from "@/components/modal-accessibility-guard";
import { SecurityDialogProvider } from "@/components/security-dialog-provider";
import { headers } from "next/headers";
import { parentMeetingsEnabled } from "@/lib/parent-meeting-feature";
import { isOfflineSyncEnabled } from "@/lib/offline-sync/feature-flag";
import { isBiometricAttendanceEnabled } from "@/lib/biometric-attendance/feature-flag";
import { PRODUCT_BRAND } from "@/config/product-brand";
import { ProductExperienceRuntime } from "@/components/product-experience-runtime";

// The shared layout resolves the authenticated user and role permissions.
// Force per-request rendering so a previously rendered private page can never
// outlive logout, password changes, account disabling, or role changes.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: PRODUCT_BRAND.productName,
  description: PRODUCT_BRAND.technicalDescriptor,
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/nalanda-logo.jpg", type: "image/jpeg" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f766e" },
    { media: "(prefers-color-scheme: dark)", color: "#172438" }
  ]
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const staging = process.env.NALANDA_ENVIRONMENT?.toUpperCase() === "STAGING";
  const syntheticReview = process.env.NALANDA_SYNTHETIC_REVIEW === "true";
  const syntheticBanner = staging || syntheticReview;
  if (requestHeaders.get("x-nalanda-maintenance-page") === "1") {
    return (
      <html lang="en" suppressHydrationWarning>
        <body>{syntheticBanner ? <div className="staging-environment-banner" role="status">SYNTHETIC REVIEW · No real records · No live providers</div> : null}{children}</body>
      </html>
    );
  }
  if (requestHeaders.get("x-nalanda-public-website") === "1") {
    return (
      <html lang="en" suppressHydrationWarning>
        <body className="public-website-body">{syntheticBanner ? <div className="staging-environment-banner" role="status">SYNTHETIC REVIEW · No real records · No live providers</div> : null}{children}</body>
      </html>
    );
  }
  // The service worker may cache only this deliberately public shell. It contains
  // no session, user, permission, settings, health, or other server-derived data;
  // every offline-sync API continues to authenticate and authorize independently.
  if (requestHeaders.get("x-nalanda-offline-shell") === "1") {
    return (
      <html lang="en" suppressHydrationWarning>
        <body>
          {syntheticBanner ? <div className="staging-environment-banner" role="status">SYNTHETIC REVIEW · No real records · No live providers</div> : null}
          <ThemeProvider>
            <ModalAccessibilityGuard />
            <SecurityDialogProvider>
              <PwaRuntime>{children}</PwaRuntime>
            </SecurityDialogProvider>
          </ThemeProvider>
        </body>
      </html>
    );
  }
  const [user, settings] = await Promise.all([getCurrentUser(), getSchoolSettings(prisma)]);
  const effectivePermissions = user
    ? await getCurrentUserEffectivePermissions()
    : new Set<CanonicalPermission>();
  const health = user && permissionSetCan(effectivePermissions, "VIEW_SYSTEM_HEALTH")
    ? await getSystemHealth(prisma)
    : null;
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {syntheticBanner ? <div className="staging-environment-banner" role="status">SYNTHETIC REVIEW · No real records · No live providers</div> : null}
        <ThemeProvider>
          <ModalAccessibilityGuard />
          <ProductExperienceRuntime />
          <SecurityDialogProvider>
            <PwaRuntime>
              <AppShell
                user={user}
                permissions={[...effectivePermissions]}
                settings={settings}
                health={health}
                healthBannerIssues={health?.issues.filter((issue) => BANNER_HEALTH_CODES.has(issue.code)) ?? []}
                appInfo={getAppInfo()}
                pilotMode={Boolean(user && permissionSetCan(effectivePermissions, "VIEW_SYSTEM_HEALTH")
                  && isPilotDatabaseUrl(process.env.DATABASE_URL))}
                enabledOptionalOperationsFeatures={user ? enabledOptionalOperationsFeatures(user.role) : []}
                parentMeetingsEnabled={parentMeetingsEnabled()}
                offlineSyncEnabled={isOfflineSyncEnabled()}
                biometricAttendanceEnabled={isBiometricAttendanceEnabled()}
              >
                {children}
              </AppShell>
            </PwaRuntime>
          </SecurityDialogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
