"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  BarChart3,
  ClipboardList,
  ClipboardCheck,
  ListChecks,
  Download,
  FileSearch,
  ShieldCheck,
  IndianRupee,
  LayoutDashboard,
  PlusCircle,
  Receipt,
  Search,
  Settings,
  CalendarDays,
  CalendarOff,
  Users,
  UserCog,
  UsersRound,
  Home,
  Megaphone,
  Bot,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import type { AuthUser } from "@/lib/auth";
import { type CanonicalPermission } from "@/lib/permissions";
import type { SchoolSettingsValue } from "@/lib/school-settings";
import type { SystemHealth, SystemHealthIssue } from "@/lib/system-health";
import type { AppInfo } from "@/lib/app-info";
import { ProductionWarningBanner } from "@/components/production-warning-banner";
import { NotificationBell } from "@/components/notification-bell";
import { defaultPathForRole, isExactActiveRoute } from "@/lib/navigation";
import { isPublicWebsitePath } from "@/lib/public-website-routing";
import { groupedVisibleNavigationItems, visibleNavigationItems, type NavigationIcon, type NavigationItem } from "@/lib/access-rules";
import { roleDashboardTitle } from "@/lib/role-presentation";

const OFFICIAL_LOGO_PATH = "/nalanda-logo-transparent.png";

const icons: Record<NavigationIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  students: Users,
  add: PlusCircle,
  payments: Receipt,
  rupee: IndianRupee,
  dues: ClipboardList,
  collection: BarChart3,
  ledger: Search,
  audit: FileSearch,
  guardians: UsersRound,
  staff: UserCog,
  attendance: ClipboardCheck,
  leave: CalendarOff,
  notices: Megaphone,
  timetable: CalendarDays,
  settings: Settings,
  users: UserCog,
  roles: ShieldCheck,
  importExport: Download,
  importVerification: ClipboardCheck,
  pilot: ListChecks
  ,udise: ClipboardList
  ,library: ClipboardList
  ,aiAssistant: Bot
  ,feeRegisterOcr: FileSearch
  ,cloudBackup: ShieldCheck
  ,website: Sparkles
  ,calendar: CalendarDays
};

function ShellBrand({ settings }: { settings: SchoolSettingsValue }) {
  return (
    <div className="brand">
      <div className="brand-main">
        <div className="brand-logo">
          <Image src={OFFICIAL_LOGO_PATH} alt="" width={54} height={54} priority />
        </div>
        <div className="brand-name" aria-label={settings.schoolName}>
          <strong>{settings.schoolName}</strong>
        </div>
      </div>
      <span className="brand-product">Education Management System</span>
    </div>
  );
}

function AcademicYearControl({ academicYear }: { academicYear: string }) {
  return (
    <label className="academic-year-control" title="Current academic year">
      <span className="sr-only">Academic year</span>
      <select aria-label="Academic year" defaultValue={academicYear}>
        <option value={academicYear}>{academicYear}</option>
      </select>
    </label>
  );
}

function ShellHeader({
  user,
  permissions,
  settings,
  menuButtonRef,
  mobileNavOpen,
  onOpenMobileNav,
  sidebarCollapsed,
  onToggleSidebar
}: {
  user: AuthUser;
  permissions: CanonicalPermission[];
  settings: SchoolSettingsValue;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  mobileNavOpen: boolean;
  onOpenMobileNav: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}) {
  const SidebarToggleIcon = sidebarCollapsed ? PanelLeftOpen : PanelLeftClose;
  const notificationHref = user.role === "PARENT"
    ? "/parent/notifications"
    : user.role === "TEACHER"
      ? "/teacher/notifications"
      : "/notifications";
  return (
    <header className="topbar">
      <div className="mobile-header-cluster">
        <button
          ref={menuButtonRef}
          type="button"
          className="icon-button mobile-menu-toggle"
          aria-label="Open navigation menu"
          aria-expanded={mobileNavOpen}
          aria-controls="mobile-navigation"
          onClick={onOpenMobileNav}
        >
          <Menu size={20} aria-hidden />
        </button>
        <Link className="mobile-brand-mark" href={defaultPathForRole(user.role)} aria-label={`${settings.schoolName} home`}>
          <Image src={OFFICIAL_LOGO_PATH} alt="" width={38} height={38} priority />
        </Link>
      </div>
      <div className="topbar-identity">
        <Image src={OFFICIAL_LOGO_PATH} alt="" width={40} height={40} priority />
        <span>
          <strong>{settings.schoolName}</strong>
          <small>{roleDashboardTitle(user.role)}</small>
        </span>
      </div>
      <div className="top-actions">
        {onToggleSidebar ? (
          <button
            type="button"
            className="icon-button sidebar-toggle desktop-sidebar-toggle"
            aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            onClick={onToggleSidebar}
          >
            <SidebarToggleIcon size={18} aria-hidden />
          </button>
        ) : null}
        <AcademicYearControl academicYear={settings.academicYear} />
        <span className="desktop-theme-toggle"><ThemeToggle /></span>
        {permissions.includes("VIEW_OWN_NOTIFICATIONS") ? <NotificationBell href={notificationHref} /> : null}
        <UserMenu user={user} />
      </div>
    </header>
  );
}

export function AppShell({
  children,
  user,
  permissions,
  settings,
  health,
  healthBannerIssues,
  appInfo,
  pilotMode
}: {
  children: React.ReactNode;
  user: AuthUser | null;
  permissions: CanonicalPermission[];
  settings: SchoolSettingsValue;
  health: SystemHealth | null;
  healthBannerIssues: SystemHealthIssue[];
  appInfo: AppInfo;
  pilotMode: boolean;
}) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavWasOpen = useRef(false);

  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".nav");
    const active = nav?.querySelector<HTMLElement>("a[aria-current='page']");
    if (!nav || !active) return;
    nav.scrollTo({
      top: Math.max(0, active.offsetTop - nav.clientHeight / 2 + active.clientHeight / 2)
    });
  }, [pathname]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) {
      let focusFrame: number | null = null;
      if (mobileNavWasOpen.current) {
        focusFrame = window.requestAnimationFrame(() => mobileMenuButtonRef.current?.focus());
      }
      mobileNavWasOpen.current = false;
      return () => {
        if (focusFrame !== null) window.cancelAnimationFrame(focusFrame);
      };
    }
    mobileNavWasOpen.current = true;
    const drawer = document.getElementById("mobile-navigation");
    const focusableSelector = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
    const focusable = () => Array.from(drawer?.querySelectorAll<HTMLElement>(focusableSelector) ?? []).filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    function handleDrawerKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileNavOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const controls = focusable();
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleDrawerKeydown);
    return () => document.removeEventListener("keydown", handleDrawerKeydown);
  }, [mobileNavOpen]);

  if (isPublicWebsitePath(pathname)) return children;
  if (
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/setup" ||
    pathname === "/offline"
  ) return children;
  if (!user) return null;
  if (user.role === "PARENT") {
    return (
      <div className={`app-shell parent-app-shell ${mobileNavOpen ? "mobile-nav-open" : ""}`}>
        <a className="app-skip-link" href="#main-content">Skip to main content</a>
        <button
          type="button"
          className="nav-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setMobileNavOpen(false)}
        />
        <aside className="sidebar parent-sidebar" id="mobile-navigation">
          <button type="button" className="icon-button drawer-close" aria-label="Close navigation menu" onClick={() => setMobileNavOpen(false)}><X size={18} aria-hidden /></button>
          <ShellBrand settings={settings} />
          <nav className="nav parent-nav" aria-label="Parent navigation">
            <Link
              href="/parent"
              className={pathname === "/parent" ? "active" : ""}
              aria-current={pathname === "/parent" ? "page" : undefined}
              onClick={() => setMobileNavOpen(false)}
            >
              <Home size={17} aria-hidden />
              Parent Portal
            </Link>
            <Link href="/parent/library" className={pathname === "/parent/library" ? "active" : ""} aria-current={pathname === "/parent/library" ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><ClipboardList size={17} aria-hidden />Parent Library</Link>
            <Link href="/parent/homework" className={pathname.startsWith("/parent/homework") ? "active" : ""} aria-current={pathname.startsWith("/parent/homework") ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><ClipboardList size={17} aria-hidden />Homework</Link>
            {permissions.includes("VIEW_OWN_CLASSWORK") ? <Link href="/my-classwork" className={pathname.startsWith("/my-classwork") ? "active" : ""} aria-current={pathname.startsWith("/my-classwork") ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><ClipboardList size={17} aria-hidden />My Classwork</Link> : null}
            {permissions.includes("VIEW_OWN_ATTENDANCE") ? <Link href="/parent/attendance" className={pathname.startsWith("/parent/attendance") ? "active" : ""} aria-current={pathname.startsWith("/parent/attendance") ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><ClipboardCheck size={17} aria-hidden />Attendance</Link> : null}
            {permissions.includes("VIEW_OWN_EXAM_TIMETABLE") ? <Link href="/parent/exam-timetable" className={pathname.startsWith("/parent/exam-timetable") ? "active" : ""} aria-current={pathname.startsWith("/parent/exam-timetable") ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><CalendarDays size={17} aria-hidden />Exam Timetable</Link> : null}
            {permissions.includes("VIEW_OWN_REPORT_CARDS") ? <Link href="/parent/results/trends" className={pathname.startsWith("/parent/results/trends") ? "active" : ""} aria-current={pathname.startsWith("/parent/results/trends") ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><ClipboardCheck size={17} aria-hidden />Published Progress</Link> : null}
            <Link href="/parent/certificates" className={pathname.startsWith("/parent/certificates") ? "active" : ""} aria-current={pathname.startsWith("/parent/certificates") ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><ClipboardList size={17} aria-hidden />Certificates</Link>
            <Link href="/parent/class-x-documents" className={pathname.startsWith("/parent/class-x-documents") ? "active" : ""} aria-current={pathname.startsWith("/parent/class-x-documents") ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><ClipboardList size={17} aria-hidden />Class X Documents</Link>
            <Link href="/parent/id-cards" className={pathname.startsWith("/parent/id-cards") ? "active" : ""} aria-current={pathname.startsWith("/parent/id-cards") ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><ClipboardList size={17} aria-hidden />ID Cards</Link>
            <Link href="/parent/notifications" className={pathname.startsWith("/parent/notifications") ? "active" : ""} aria-current={pathname.startsWith("/parent/notifications") ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><Megaphone size={17} aria-hidden />Notifications</Link>
            {permissions.includes("MANAGE_OWN_WHATSAPP_CONSENT") && permissions.includes("MANAGE_OWN_SMS_EMAIL_CONSENT") ? <Link href="/parent/communication-preferences" className={pathname === "/parent/communication-preferences" ? "active" : ""} aria-current={pathname === "/parent/communication-preferences" ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><Settings size={17} aria-hidden />Communication Preferences</Link> : null}
            <Link href="/install-app" className={pathname === "/install-app" ? "active" : ""} aria-current={pathname === "/install-app" ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><Download size={17} aria-hidden />Install App</Link>
          </nav>
        </aside>
        <main className="content" id="main-content" tabIndex={-1}>
          <ShellHeader
            user={user}
            permissions={permissions}
            settings={settings}
            menuButtonRef={mobileMenuButtonRef}
            mobileNavOpen={mobileNavOpen}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
          {children}
        </main>
      </div>
    );
  }
  const teacherInternalNavItems = user.role === "TEACHER" ? visibleNavigationItems(permissions, user.role) : [];
  if (user.role === "TEACHER" && teacherInternalNavItems.length === 0) {
    return (
      <div className={`app-shell parent-app-shell ${mobileNavOpen ? "mobile-nav-open" : ""}`}>
        <a className="app-skip-link" href="#main-content">Skip to main content</a>
        <button
          type="button"
          className="nav-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setMobileNavOpen(false)}
        />
        <aside className="sidebar parent-sidebar" id="mobile-navigation">
          <button type="button" className="icon-button drawer-close" aria-label="Close navigation menu" onClick={() => setMobileNavOpen(false)}><X size={18} aria-hidden /></button>
          <ShellBrand settings={settings} />
          <nav className="nav parent-nav" aria-label="Teacher navigation"><Link href="/teacher" className={pathname === "/teacher" ? "active" : ""} aria-current={pathname === "/teacher" ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><Home size={17} aria-hidden />Teacher Portal</Link><Link href="/teacher/notifications" className={pathname.startsWith("/teacher/notifications") ? "active" : ""} aria-current={pathname.startsWith("/teacher/notifications") ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><Megaphone size={17} aria-hidden />Notifications</Link>{permissions.includes("VIEW_CLASSWORK") ? <Link href="/teacher/classwork" className={pathname.startsWith("/teacher/classwork") ? "active" : ""} aria-current={pathname.startsWith("/teacher/classwork") ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><ClipboardList size={17} aria-hidden />Classwork</Link> : null}{permissions.includes("MANAGE_OWN_WHATSAPP_CONSENT") && permissions.includes("MANAGE_OWN_SMS_EMAIL_CONSENT") ? <Link href="/teacher/communication-preferences" className={pathname === "/teacher/communication-preferences" ? "active" : ""} aria-current={pathname === "/teacher/communication-preferences" ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><Settings size={17} aria-hidden />Communication Preferences</Link> : null}{permissions.includes("VIEW_OWN_EXAM_MARKS") ? <Link href="/teacher/marks" className={pathname.startsWith("/teacher/marks") ? "active" : ""} aria-current={pathname.startsWith("/teacher/marks") ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><ClipboardCheck size={17} aria-hidden />Marks</Link> : null}{permissions.includes("VIEW_OWN_EXAM_MARKS") ? <Link href="/teacher/academic-reports" className={pathname.startsWith("/teacher/academic-reports") ? "active" : ""} aria-current={pathname.startsWith("/teacher/academic-reports") ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><ClipboardCheck size={17} aria-hidden />Academic Reports</Link> : null}{permissions.includes("VIEW_OWN_EXAM_ASSIGNMENTS") ? <Link href="/teacher/exam-assignments" className={pathname.startsWith("/teacher/exam-assignments") ? "active" : ""} aria-current={pathname.startsWith("/teacher/exam-assignments") ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><ClipboardCheck size={17} aria-hidden />Exam Assignments</Link> : null}<Link href="/teacher/homework" className={pathname.startsWith("/teacher/homework") ? "active" : ""} aria-current={pathname.startsWith("/teacher/homework") ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><ClipboardList size={17} aria-hidden />Homework</Link><Link href="/teacher/library" className={pathname === "/teacher/library" ? "active" : ""} aria-current={pathname === "/teacher/library" ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><ClipboardList size={17} aria-hidden />My Library</Link><Link href="/teacher/id-card" className={pathname === "/teacher/id-card" ? "active" : ""} aria-current={pathname === "/teacher/id-card" ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><ClipboardList size={17} aria-hidden />My ID Card</Link><Link href="/install-app" className={pathname === "/install-app" ? "active" : ""} aria-current={pathname === "/install-app" ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><Download size={17} aria-hidden />Install App</Link></nav>
        </aside>
        <main className="content" id="main-content" tabIndex={-1}>
          <ShellHeader
            user={user}
            permissions={permissions}
            settings={settings}
            menuButtonRef={mobileMenuButtonRef}
            mobileNavOpen={mobileNavOpen}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
          {children}
        </main>
      </div>
    );
  }
  const navGroups = groupedVisibleNavigationItems(permissions, user.role);
  const renderNavLink = (item: NavigationItem) => {
    const Icon = icons[item.icon];
    const active = isExactActiveRoute(pathname, item.href);
    return (
      <Link
        href={item.href}
        className={active ? "active" : ""}
        aria-current={active ? "page" : undefined}
        key={item.href}
        onClick={() => setMobileNavOpen(false)}
      >
        <Icon size={17} aria-hidden />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${mobileNavOpen ? "mobile-nav-open" : ""}`}>
      <a className="app-skip-link" href="#main-content">Skip to main content</a>
      <button
        type="button"
        className="nav-backdrop"
        aria-label="Close navigation menu"
        onClick={() => setMobileNavOpen(false)}
      />
      <aside className="sidebar" id="mobile-navigation">
        <button
          type="button"
          className="icon-button drawer-close"
          aria-label="Close navigation menu"
          onClick={() => setMobileNavOpen(false)}
        >
          <X size={18} aria-hidden />
        </button>
        <ShellBrand settings={settings} />
        <nav className="nav" aria-label="Main navigation">
          {user.role === "TEACHER" ? <Link href="/teacher" className={pathname === "/teacher" ? "active" : ""} aria-current={pathname === "/teacher" ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><Home size={17} aria-hidden /><span>Teacher Portal</span></Link> : null}
          {user.role === "TEACHER" ? <Link href="/teacher/library" className={pathname === "/teacher/library" ? "active" : ""} aria-current={pathname === "/teacher/library" ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><ClipboardList size={17} aria-hidden /><span>My Library</span></Link> : null}
          {user.role === "TEACHER" ? <Link href="/teacher/homework" className={pathname.startsWith("/teacher/homework") ? "active" : ""} aria-current={pathname.startsWith("/teacher/homework") ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><ClipboardList size={17} aria-hidden /><span>Homework</span></Link> : null}
          {user.role === "TEACHER" && permissions.includes("VIEW_CLASSWORK") ? <Link href="/teacher/classwork" className={pathname.startsWith("/teacher/classwork") ? "active" : ""} aria-current={pathname.startsWith("/teacher/classwork") ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><ClipboardList size={17} aria-hidden /><span>Classwork</span></Link> : null}
          {user.role === "TEACHER" ? <Link href="/teacher/notifications" className={pathname.startsWith("/teacher/notifications") ? "active" : ""} aria-current={pathname.startsWith("/teacher/notifications") ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><Megaphone size={17} aria-hidden /><span>Notifications</span></Link> : null}
          {user.role === "TEACHER" && permissions.includes("MANAGE_OWN_WHATSAPP_CONSENT") && permissions.includes("MANAGE_OWN_SMS_EMAIL_CONSENT") ? <Link href="/teacher/communication-preferences" className={pathname === "/teacher/communication-preferences" ? "active" : ""} aria-current={pathname === "/teacher/communication-preferences" ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><Settings size={17} aria-hidden /><span>Communication Preferences</span></Link> : null}
          {user.role === "TEACHER" ? <Link href="/teacher/id-card" className={pathname === "/teacher/id-card" ? "active" : ""} aria-current={pathname === "/teacher/id-card" ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><ClipboardList size={17} aria-hidden /><span>My ID Card</span></Link> : null}
          {user.role === "TEACHER" && permissions.includes("VIEW_OWN_EXAM_MARKS") ? <Link href="/teacher/marks" className={pathname.startsWith("/teacher/marks") ? "active" : ""} aria-current={pathname.startsWith("/teacher/marks") ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><ClipboardCheck size={17} aria-hidden /><span>Marks</span></Link> : null}
          {user.role === "TEACHER" && permissions.includes("VIEW_OWN_EXAM_MARKS") ? <Link href="/teacher/academic-reports" className={pathname.startsWith("/teacher/academic-reports") ? "active" : ""} aria-current={pathname.startsWith("/teacher/academic-reports") ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><ClipboardCheck size={17} aria-hidden /><span>Academic Reports</span></Link> : null}
          {user.role === "TEACHER" && permissions.includes("VIEW_OWN_EXAM_ASSIGNMENTS") ? <Link href="/teacher/exam-assignments" className={pathname.startsWith("/teacher/exam-assignments") ? "active" : ""} aria-current={pathname.startsWith("/teacher/exam-assignments") ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><ClipboardCheck size={17} aria-hidden /><span>Exam Assignments</span></Link> : null}
          {navGroups.map((group) => (
            <section className="nav-group" aria-labelledby={`nav-group-${group.id}`} key={group.id}>
              <h2 id={`nav-group-${group.id}`}>{group.label}</h2>
              <div className="nav-group-links">
                {group.items.map(renderNavLink)}
              </div>
            </section>
          ))}
        </nav>
        <div className="app-version">
          <span>{appInfo.name} v{appInfo.version}</span>
          <span>{appInfo.buildMode} - {appInfo.databaseProvider}</span>
          {health?.sampleDataDetected ? <strong>Sample data detected</strong> : null}
        </div>
      </aside>
      <main className="content" id="main-content" tabIndex={-1}>
        <ShellHeader
          user={user}
          permissions={permissions}
          settings={settings}
          menuButtonRef={mobileMenuButtonRef}
          mobileNavOpen={mobileNavOpen}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
        />
        {health ? (
          <ProductionWarningBanner issues={healthBannerIssues} />
        ) : null}
        {pilotMode ? (
          <div className="pilot-mode-banner" role="status">
            <strong>PILOT DATABASE MODE - safe for testing</strong>
            <span>Do not treat this copied database as the official live record.</span>
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
