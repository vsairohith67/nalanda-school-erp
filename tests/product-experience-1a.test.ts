import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { PRODUCT_BRAND } from "@/config/product-brand";
import { PERSONA_ACCEPTANCE_RULES, PRODUCT_EXPERIENCE_PERSONAS } from "@/config/product-experience-personas";

const root = path.resolve(".");
const source = (file: string) => readFileSync(path.join(root, file), "utf8");

function walk(directory: string): string[] {
  return readdirSync(path.join(root, directory)).flatMap((entry) => {
    if (["node_modules", "target", "dist", "gen"].includes(entry)) return [];
    const relative = path.join(directory, entry);
    return statSync(path.join(root, relative)).isDirectory() ? walk(relative) : [relative];
  });
}

describe("PRODUCT-EXPERIENCE-1A product contract", () => {
  it("centralises the approved user-facing names without changing identifiers", () => {
    expect(PRODUCT_BRAND).toMatchObject({
      schoolName: "NALANDA PUBLIC SCHOOL",
      productName: "Nalanda School Management System",
      technicalDescriptor: "Secure School ERP & Operations Platform",
      nativeShortName: "Nalanda School"
    });
    expect(PRODUCT_BRAND.fullSchoolNameFontFamily).toContain("Georgia");
    const runtime = [...walk("app"), ...walk("components"), ...walk("lib"), ...walk("apps/nalanda-cross-platform")]
      .filter((file) => /\.(?:ts|tsx|rs|json|html|css)$/.test(file))
      .map(source)
      .join("\n");
    expect(runtime).not.toMatch(/Nalanda Public School ERP|Nalanda ERP|NPS ERP|NPS School ERP/);
    expect(source("app/layout.tsx")).toContain("PRODUCT_BRAND.productName");
    expect(source("app/login/page.tsx")).toContain("PRODUCT_BRAND.productName");
    expect(source("components/app-shell.tsx")).toContain("PRODUCT_BRAND.productName");
    expect(source("lib/pwa-manifest.ts")).toContain("PRODUCT_BRAND.nativeShortName");
    const tauri = JSON.parse(source("apps/nalanda-cross-platform/src-tauri/tauri.conf.json"));
    expect(tauri.productName).toBe(PRODUCT_BRAND.nativeShortName);
    expect(tauri.identifier).toBe("com.nalandaps.erp");
  });

  it("applies Georgia Bold to the full school name in UI and generated documents", () => {
    const css = source("app/product-experience.css");
    expect(css).toContain("--font-school-name: Georgia");
    expect(css).toMatch(/\.full-school-name,[\s\S]*?font-weight:\s*700/);
    expect(source("lib/report-pdf.ts")).toContain('"georgiab.ttf"');
    expect(source("lib/report-card-refined-source-lock.ts")).toContain('"georgiab.ttf"');
    expect(source("lib/onboarding-workbooks.ts")).toContain('name: "Georgia", bold: true');
    expect(source("components/safe-exit-workspace.tsx")).toContain("gate-pass-print");
    expect(source("app/globals.css")).toMatch(/\.gate-pass-print h2\{font-family:Georgia,serif;font-weight:700/);
  });

  it("registers every current page with required workflow and accessibility fields", () => {
    const register = JSON.parse(source("config/product-experience-screen-register.json"));
    const pages = walk("app").filter((file) => /(?:^|[\\/])page\.tsx$/.test(file));
    expect(register.promptId).toBe("PRODUCT-EXPERIENCE-1A");
    expect(register.completeness).toEqual({ pageFiles: pages.length, registeredScreens: pages.length, omittedScreens: 0 });
    expect(register.screens).toHaveLength(pages.length);
    expect(pages.length).toBeGreaterThan(350);
    expect(source("scripts/list-routes.ts")).toContain('const isApi = /(^|\\/)route\\.ts$/.test(relative)');
    for (const screen of register.screens) {
      expect(screen).toMatchObject({ route: expect.any(String), file: expect.any(String), module: expect.any(String), primaryTask: expect.any(String), risk: expect.any(String) });
      expect(screen.roles.length).toBeGreaterThan(0);
      expect(screen.availability).toMatchObject({ webDesktop: true, webMobile: expect.any(String), windowsInstalled: expect.any(String), androidInstalled: expect.any(String), iosInstalled: expect.any(String) });
      expect(screen.states).toEqual({ empty: expect.any(String), loading: expect.any(String), error: expect.any(String) });
      expect(screen.accessibility).toMatchObject({ status: expect.any(String), heading: expect.any(String), forms: expect.any(String), tables: expect.any(String), manualReviewRequired: expect.any(Boolean) });
    }
  });

  it("defines all ten personas with ten bounded critical tasks", () => {
    expect(Object.keys(PRODUCT_EXPERIENCE_PERSONAS)).toEqual([
      "SUPER_ADMIN", "PRINCIPAL", "DIRECTOR", "ACCOUNTANT", "COMPUTER_OPERATOR", "TEACHER", "PARENT", "GATE_STAFF", "VIEWER", "MARKS_ENTRY_OPERATOR"
    ]);
    for (const persona of Object.values(PRODUCT_EXPERIENCE_PERSONAS)) {
      expect(persona.criticalTasks).toHaveLength(10);
      for (const task of persona.criticalTasks) {
        expect(task.targetSteps).toBeLessThanOrEqual(PERSONA_ACCEPTANCE_RULES.maximumPrimaryTaskSteps);
        expect(task.riskChecks.length).toBeGreaterThan(0);
      }
    }
    expect(PRODUCT_EXPERIENCE_PERSONAS.MARKS_ENTRY_OPERATOR.purpose).toContain("permission profile, not a new database role");
    const fixture = source("scripts/prepare-product-experience-1a-synthetic.ts");
    for (const syntheticPersona of ["Synthetic Super Admin", "Synthetic Principal", "Synthetic Director", "Synthetic Accountant", "Synthetic Computer Operator", "Synthetic Teacher", "Synthetic Parent", "Synthetic Gate Staff", "Synthetic Viewer", "Synthetic Marks Entry Operator"]) {
      expect(fixture).toContain(syntheticPersona);
    }
    expect(fixture).toContain("grantMarksDelegation");
    expect(fixture).toContain("ACTIVE_EXACT_SYNTHETIC_SCOPE");
  });

  it("keeps Student and Staff 360 sections lazy and permission bounded", () => {
    const student = source("app/students/[id]/page.tsx");
    expect(student).toContain('requirePermission("VIEW_STUDENTS")');
    expect(student).toContain('["PARENT", "TEACHER", "STUDENT"].includes(user.role)');
    expect(student.indexOf('if (section === "guardians")')).toBeLessThan(student.indexOf("prisma.studentGuardian.findMany"));
    expect(student.indexOf('if (section === "fees")')).toBeLessThan(student.indexOf("prisma.payment.findMany"));
    expect(student).toContain('if (section === "results") return permissionSetCan(permissions, "VIEW_REPORT_CARDS")');
    expect(student).not.toContain('permissionSetCan(permissions, "VIEW_EXAM_REPORTS") || permissionSetCan(permissions, "VIEW_REPORT_CARDS")');
    for (const permission of ["VIEW_LIBRARY_CIRCULATION", "VIEW_LIBRARY_INCIDENTS", "VIEW_LIBRARY_CHARGES"]) expect(student).toContain(`permissionSetCan(permissions, "${permission}")`);
    expect(student).toContain('canCirculation ? prisma.libraryMember.findUnique');
    expect(student).toContain('canIncidents ? prisma.libraryMember.findUnique');
    expect(student).toContain('canCharges ? prisma.libraryMember.findUnique');
    expect(student).toContain('canCertificates ? prisma.studentCertificate.count');
    expect(student).toContain('canCards ? prisma.identityCard.count');
    expect(student).toContain('canPackages ? prisma.classXDocumentPackage.count');
    expect(student).toContain('canReports ? prisma.studentReportCard.count');
    expect(student).not.toMatch(/aadhaar|aadhar/i);
    expect(student).toContain("Private file download remains in each owning module");

    const staff = source("app/staff/[id]/page.tsx");
    expect(staff).toContain('permissionSetCan(permissions, "VIEW_PAYROLL")');
    expect(staff).not.toContain('permissionSetCan(permissions, "VIEW_ID_CARDS") || permissionSetCan(permissions, "VIEW_LIBRARY")');
    expect(staff).toContain('canCards ? prisma.identityCard.count');
    expect(staff).toContain('canCirculation ? prisma.libraryMember.findUnique');
    expect(staff).toContain('canCharges ? prisma.libraryMember.findUnique');
    expect(staff).toContain('canManage ? prisma.staffMember.findUnique');
    expect(staff).not.toContain('user: { select: { id: true } }');
    expect(staff).not.toContain('accountLinked');
    expect(staff).toContain('Account linkage details require Staff management permission.');
    expect(staff).toContain('const account = privateStaff?.user ?? null');
    expect(staff.indexOf('if (section === "attendance")')).toBeLessThan(staff.indexOf("prisma.staffAttendanceRecord.findMany"));
    expect(staff).not.toMatch(/baseSalary|grossSalary|netSalary|bankAccount/i);
    expect(staff).toContain("No biometric template, image, card secret, device password or vendor database is stored here");
    const staffDetail = source("components/staff-detail.tsx");
    expect(staffDetail).not.toContain("<h3");
    expect(staffDetail).toContain("Private contact, address, emergency-contact and HR notes require Staff management permission");
    const staffService = source("lib/staff.ts");
    expect(staffService).toContain("class StaffValidationError extends Error");
    expect(staffService).toContain('return "Unable to save staff member. Review the fields and try again."');
    expect(staffService).not.toContain("return message;\n}");
  });

  it("prioritises actionable dashboard work and limits dashboard density", () => {
    const dashboard = source("app/dashboard/page.tsx");
    expect(dashboard).toContain('user.role === "SUPER_ADMIN" ? 4 : 6');
    for (const destination of ["/super-admin/command-center", "/super-admin/my-work", "/super-admin/search", "/super-admin/ai", "/technical-operations", "/release-operations"]) {
      expect(dashboard).toContain(destination);
    }
    expect(dashboard).toContain("Current work and urgent exceptions");
    expect(dashboard).toContain('<h1 id="dashboard-heading">');
    expect(source("app/globals.css")).toContain("grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr));");
    expect(source("app/globals.css")).toContain("grid-template-columns: repeat(auto-fit, minmax(min(100%, 9.5rem), 1fr));");
    expect(source("app/globals.css")).toMatch(/\.dashboard-welcome \{[\s\S]*?flex-wrap: wrap;/);
    expect(source("components/app-shell.tsx")).not.toContain('href="/teacher/exam-assignments" className="nav-item"');
  });

  it("uses text, icon and semantic tone for important states", () => {
    const ui = source("components/ui.tsx");
    const css = source("app/product-experience.css");
    expect(ui).toContain('aria-label={`Status: ${label}`}');
    expect(ui).toContain("<Icon aria-hidden />{label}");
    for (const status of ["success", "warning", "error", "pending", "draft", "locked", "offline", "rejected", "disabled", "degraded", "unavailable"]) {
      expect(`${ui}\n${css}`).toContain(status);
    }
  });

  it("protects dirty forms and preserves recoverable submissions", () => {
    const runtime = source("components/product-experience-runtime.tsx");
    const submitBlock = runtime.match(/const onSubmit[\s\S]*?const onReset/)?.[0] ?? "";
    expect(runtime).toContain('form.dataset.dirty = "true"');
    expect(runtime).toContain('window.confirm("You have unsaved changes. Leave this page and discard them?")');
    expect(runtime).toContain('window.addEventListener("beforeunload"');
    expect(runtime).toContain("usePathname");
    expect(runtime).toContain('announcementRef.current.textContent = ""');
    expect(submitBlock).not.toContain('form.dataset.dirty = "false"');
    expect(runtime).not.toMatch(/\.reset\(\)|value\s*=\s*["']{2}/);
    const staff = source("components/staff-detail.tsx");
    expect(staff).toContain("try {");
    expect(staff).toContain("finally {");
    expect(staff).toContain("Your entered values remain on this page");
  });

  it("provides a keyboard and mobile alternative for table workflows", () => {
    const runtime = source("components/product-experience-runtime.tsx");
    const css = source("app/product-experience.css");
    expect(runtime).toContain("cell.dataset.label");
    expect(runtime).toContain('wrapper.setAttribute("role", "region")');
    expect(css).toContain('.table-wrap[data-mobile-table="cards"] td::before');
    expect(css).toContain("position: sticky");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("--touch-target: 44px");
    expect(css).toMatch(/:is\(button, \.button,[\s\S]*?min-height: var\(--control-height\)/);
    expect(css).toMatch(/\.table-wrap td a,[\s\S]*?min-height: var\(--touch-target\)[\s\S]*?min-width: var\(--touch-target\)/);
    expect(source("app/payments/page.tsx")).toContain(`<h2>{payments.length} Payment Rows</h2>`);
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));");
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.workspace-tabs \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?overflow: visible;/);
  });

  it("improves installed-app safe areas, resizing, dark mode and touch targets", () => {
    const css = source("apps/nalanda-cross-platform/src/styles.css");
    const app = source("apps/nalanda-cross-platform/src/App.tsx");
    const workflow = source(".github/workflows/cross-platform-apps.yml");
    expect(css).toContain("env(safe-area-inset-top)");
    expect(css).toContain("100dvh");
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("prefers-reduced-motion");
    expect(app).toContain("PRODUCT_BRAND.productName");
    expect(app).not.toContain("Priya");
    expect(workflow).toContain("Exercise the packaged app in an Android emulator");
    expect(workflow).toContain("adb shell am force-stop");
    expect(workflow).toContain("android-synthetic-tablet.png");
    expect(workflow).toContain("Exercise the packaged app in iPhone and iPad simulators");
    expect(workflow).toContain("xcrun simctl install");
    expect(workflow).toContain("xcrun simctl ui");
  });

  it("keeps security and activation boundaries intact", () => {
    expect(source("middleware.ts")).toContain("!session");
    expect(source("app/parent/page.tsx")).toMatch(/guardian|linked/i);
    expect(source("app/api/native/v1/sync/route.ts")).toContain('resolveNativeSession(request, "offline:sync")');
    expect(source("lib/offline-sync/sync-service.ts")).not.toMatch(/MARKS|STUDENT_ATTENDANCE/);
    const flags = JSON.parse(source("config/release-feature-flags.json"));
    expect(flags.find((flag: { key: string }) => flag.key === "cross-platform-apps-1a")).toMatchObject({ defaultState: false, rolloutPercentage: 0 });
    expect(flags.find((flag: { key: string }) => flag.key === "offline-sync-1a")).toMatchObject({ defaultState: false, rolloutPercentage: 0 });
  });

  it("records every proven scoped defect and separates the confirmed backlog", () => {
    const register = JSON.parse(source("config/product-experience-bugs.json"));
    expect(register.summary).toEqual({ critical: 0, high: 8, medium: 35, fixed: 43, unresolved: 0 });
    expect(register.bugs).toHaveLength(43);
    expect(new Set(register.bugs.map((bug: { id: string }) => bug.id)).size).toBe(43);
    for (const bug of register.bugs) {
      expect(bug).toMatchObject({
        id: expect.stringMatching(/^PX-\d{3}$/),
        platform: expect.any(String), role: expect.any(String), route: expect.any(String),
        severity: expect.stringMatching(/^(HIGH|MEDIUM)$/), reproduction: expect.any(String),
        expected: expect.any(String), actual: expect.any(String), rootCause: expect.any(String),
        fixCommit: expect.any(String), regressionTest: expect.any(String)
      });
    }
    const backlog = JSON.parse(source("config/product-experience-backlog.json"));
    expect(backlog.items).toHaveLength(5);
    expect(backlog.items.every((item: { blocksProductExperience1A: boolean }) => item.blocksProductExperience1A === false)).toBe(true);
    expect(backlog.items.some((item: { gate: string }) => item.gate === "BIOMETRIC-STAFF-ATTENDANCE-1A")).toBe(true);
  });
});
