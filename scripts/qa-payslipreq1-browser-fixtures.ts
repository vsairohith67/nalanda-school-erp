import { createHash, randomBytes, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { hashPassword } from "../lib/password";
import { fileSha256 } from "./migration-check-utils";

const workspace = path.resolve("."), operational = path.join(workspace, "prisma", "dev.db"), root = path.join(workspace, "tmp", "payslipreq1-browser"), database = path.join(root, "payslipreq1-browser.db");
const credentialsPath = path.join(root, "credentials.json"), runtimePath = path.join(root, "runtime-env.json"), port = 3251;
const syntheticPdfPath = path.join(root, "synthetic-payslip.pdf");
const databaseUrl = (file: string) => `file:${file.replaceAll("\\", "/")}`;

function checkedRoot() { const expected = path.join(path.resolve(workspace), "tmp", "payslipreq1-browser"), resolved = path.resolve(root); if (resolved !== expected || !resolved.startsWith(`${path.join(path.resolve(workspace), "tmp")}${path.sep}`)) throw new Error("PAYSLIPREQ1_BROWSER_SCOPE_REFUSED"); return resolved; }
function cleanup() { const target = checkedRoot(); if (existsSync(target)) rmSync(target, { recursive: true, force: true }); }
function migrate(environment: NodeJS.ProcessEnv) { const pnpm = path.join(process.env.APPDATA ?? "", "npm", "node_modules", "pnpm", "bin", "pnpm.mjs"), result = spawnSync(process.execPath, [pnpm, "exec", "prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"], { cwd: workspace, env: environment, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true }); if (result.error || result.status !== 0) throw new Error(`PAYSLIPREQ1_BROWSER_MIGRATION_FAILED:${result.error?.message ?? `${result.stdout}\n${result.stderr}`}`); }

async function createUser(client: PrismaClient, role: "DIRECTOR" | "ACCOUNTANT" | "PRINCIPAL" | "ADMIN" | "VIEWER" | "TEACHER", label: string, password: string, options: { parent?: boolean; inactive?: boolean } = {}) {
  const username = `payslipreq1-browser-${label.toLowerCase()}`;
  const user = await client.user.create({ data: { iamPublicKey: randomUUID(), name: `PAYSLIPREQ1 Browser ${label}`, designation: role === "TEACHER" ? "Teacher" : `${role} synthetic QA`, username, passwordHash: await hashPassword(password), role, isActive: !options.inactive, lifecycleStatus: options.inactive ? "DISABLED" : "ACTIVE" } });
  await client.authLoginAlias.create({ data: { userId: user.id, type: "USERNAME", normalizedValue: username, displayMasked: username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } });
  await client.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: user.id, role, status: "ACTIVE", reason: "PAYSLIPREQ1 isolated Browser fixture", assignedByUserId: user.id, activeKey: `${user.id}:${role}` } });
  if (options.parent) await client.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: user.id, role: "PARENT", status: "ACTIVE", reason: "PAYSLIPREQ1 Staff and Parent context isolation", assignedByUserId: user.id, activeKey: `${user.id}:PARENT` } });
  return { user, username };
}

async function setup() {
  const before = { sha256: fileSha256(operational), size: statSync(operational).size };
  cleanup(); mkdirSync(checkedRoot(), { recursive: true }); copyFileSync(operational, database);
  const secret = randomBytes(48).toString("base64url"), qaLoginCredential = `${randomBytes(18).toString("base64url")}Aa1!`, origin = `http://localhost:${port}`;
  const qpdf = process.env.QPDF_EXECUTABLE_PATH;
  if (!qpdf || !path.isAbsolute(qpdf)) throw new Error("PAYSLIPREQ1_BROWSER_REQUIRES_FIXED_QPDF_PATH");
  const runtimeEnvironment: NodeJS.ProcessEnv = { NODE_ENV: "production", DATABASE_URL: databaseUrl(database), SESSION_SECRET: secret, AUTH_SECRET: secret, APP_ORIGIN: origin, PORT: String(port), QPDF_EXECUTABLE_PATH: qpdf, PAYSLIP_REQUEST_STORAGE_ROOT: path.join(root, "storage"), PAYSLIP_REQUEST_TEMP_ROOT: path.join(root, "processing"), PAYSLIP_REQUEST_KEYRING_JSON: JSON.stringify({ active: "QA_V1", keys: { QA_V1: randomBytes(32).toString("base64") } }) };
  const environment: NodeJS.ProcessEnv = { ...process.env, ...runtimeEnvironment };
  migrate(environment);
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText("PAYSLIPREQ1 synthetic Browser QA document", { x: 72, y: 770, size: 18, font });
  page.drawText("No Staff identity or salary values are present.", { x: 72, y: 735, size: 12, font });
  writeFileSync(syntheticPdfPath, await pdf.save());
  const client = new PrismaClient({ datasourceUrl: databaseUrl(database) });
  try {
    const director = await createUser(client, "DIRECTOR", "Director", qaLoginCredential), accountant = await createUser(client, "ACCOUNTANT", "Accountant", qaLoginCredential), principal = await createUser(client, "PRINCIPAL", "Principal", qaLoginCredential), admin = await createUser(client, "ADMIN", "Admin", qaLoginCredential), viewer = await createUser(client, "VIEWER", "Viewer", qaLoginCredential), teacher = await createUser(client, "TEACHER", "TeacherParent", qaLoginCredential, { parent: true }), inactive = await createUser(client, "TEACHER", "InactiveTeacher", qaLoginCredential, { inactive: true });
    const guardian = await client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: "PAYSLIPREQ1 Browser Synthetic Guardian", primaryMobile: "0000000000" } });
    const child = await client.student.create({ data: { admissionNo: "PAYSLIPREQ1-BROWSER-CHILD-001", studentName: "PAYSLIPREQ1 Browser Synthetic Child", fatherName: "Synthetic", className: "I", phone1: "0000000000" } });
    await client.studentGuardian.create({ data: { guardianId: guardian.id, studentId: child.id, isPrimaryContact: true } });
    await client.user.update({ where: { id: teacher.user.id }, data: { guardianId: guardian.id } });
    for (const permission of ["VIEW_PAYSLIP_REQUESTS", "PREPARE_PAYSLIP_REQUEST", "UPLOAD_PAYSLIP_DOCUMENT"]) await client.rolePermission.upsert({ where: { role_permission: { role: "ACCOUNTANT", permission } }, update: { enabled: true }, create: { role: "ACCOUNTANT", permission, enabled: true } });
    const staff = await client.staffMember.create({ data: { iamPublicKey: randomUUID(), staffCode: "PAYSLIPREQ1-BROWSER-001", fullName: "PAYSLIPREQ1 Browser Synthetic Teacher", displayName: "Synthetic Teacher", designation: "Teacher", department: "Academics", dateOfJoining: new Date("2025-06-12T00:00:00.000Z"), status: "ACTIVE", userId: teacher.user.id } });
    await client.staffMember.create({ data: { iamPublicKey: randomUUID(), staffCode: "PAYSLIPREQ1-BROWSER-002", fullName: "PAYSLIPREQ1 Browser Inactive Teacher", displayName: "Inactive Teacher", designation: "Teacher", dateOfJoining: new Date("2025-01-01T00:00:00.000Z"), status: "INACTIVE", userId: inactive.user.id } });
    await client.staffPayslipMonthAvailability.createMany({ data: ["2026-04", "2026-05", "2026-06", "2026-07"].map((salaryMonth) => ({ publicKey: randomUUID(), staffMemberId: staff.id, salaryMonth, status: "AVAILABLE", sourceType: "HISTORICAL_RECORD", authorizedByUserId: director.user.id, authorizationReason: "Director-authorised synthetic historical record" })) });
    await client.staffPayslipMonthAvailability.create({ data: { publicKey: randomUUID(), staffMemberId: staff.id, salaryMonth: "2026-03", status: "UNKNOWN", sourceType: "HISTORICAL_RECORD", authorizedByUserId: director.user.id, authorizationReason: "Synthetic unresolved record review" } });
    writeFileSync(credentialsPath, JSON.stringify({ password: qaLoginCredential, syntheticPdfPath, director: { username: director.username }, accountant: { username: accountant.username }, principal: { username: principal.username }, admin: { username: admin.username }, viewer: { username: viewer.username }, teacherParent: { username: teacher.username } }), { flag: "wx" });
    writeFileSync(runtimePath, JSON.stringify(runtimeEnvironment), { flag: "wx" });
    const after = { sha256: fileSha256(operational), size: statSync(operational).size };
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("PAYSLIPREQ1_BROWSER_OPERATIONAL_DATABASE_CHANGED");
    console.log(JSON.stringify({ result: "PAYSLIPREQ1_BROWSER_FIXTURES_READY", copiedDatabase: true, port, roles: ["DIRECTOR", "ACCOUNTANT", "PRINCIPAL", "ADMIN", "VIEWER", "TEACHER", "PARENT"], availableMonths: 4, operationalMutation: false, credentialPath: credentialsPath, runtimePath }));
  } finally { await client.$disconnect(); }
}

const mode = process.argv.find((value) => value === "setup" || value === "cleanup");
if (mode === "setup") setup().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
else if (mode === "cleanup") { cleanup(); console.log(JSON.stringify({ result: "PAYSLIPREQ1_BROWSER_FIXTURES_REMOVED", exists: existsSync(root) })); }
else { console.error("Use setup or cleanup"); process.exitCode = 1; }
