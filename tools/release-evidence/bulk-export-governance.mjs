import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = process.cwd();
const manifestPath = path.join(workspaceRoot, "tools", "release-evidence", "bulk-export-contracts.json");
const apiRoot = path.join(workspaceRoot, "app", "api");
const MAX_FILES = 5_000;
const MAX_SOURCE_BYTES = 512 * 1024;

function relative(file) {
  return path.relative(workspaceRoot, file).replaceAll(path.sep, "/");
}

function readBounded(file) {
  const metadata = lstatSync(file);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_SOURCE_BYTES) {
    throw new Error(`BULK_EXPORT_SOURCE_UNSAFE:${relative(file)}`);
  }
  return readFileSync(file, "utf8");
}

function walk(directory, output = []) {
  if (output.length > MAX_FILES) throw new Error("BULK_EXPORT_DISCOVERY_LIMIT_EXCEEDED");
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, output);
    else if (entry.isFile() && entry.name === "route.ts") output.push(absolute);
  }
  return output;
}

export function discoverExportLikeRoutes() {
  return walk(apiRoot)
    .filter((file) => {
      const sourcePath = relative(file);
      const source = readBounded(file);
      return /\/(?:export|download|backup|error-workbook)(?:\/|$)/.test(sourcePath)
        || /Content-Disposition|text\/csv/i.test(source);
    })
    .map(relative)
    .sort();
}

function dependencySources(sourcePath, depth = 0, seen = new Set()) {
  if (depth > 3 || seen.size > 80) return [];
  const absolute = path.join(workspaceRoot, sourcePath);
  if (seen.has(absolute) || !existsSync(absolute)) return [];
  seen.add(absolute);
  const source = readBounded(absolute);
  const sources = [source];
  for (const match of source.matchAll(/from\s*["']@\/(lib\/[A-Za-z0-9_./-]+)["']/g)) {
    const base = path.join(workspaceRoot, match[1]);
    const candidate = existsSync(`${base}.ts`) ? `${base}.ts` : existsSync(path.join(base, "index.ts")) ? path.join(base, "index.ts") : null;
    if (candidate) sources.push(...dependencySources(relative(candidate), depth + 1, seen));
  }
  return sources;
}

function validateSurface(surface, errors) {
  const label = String(surface?.id ?? "UNKNOWN");
  const required = ["id", "sourcePath", "route", "method", "module", "format", "classification", "permission", "objectScope", "boundedBehavior", "releaseState"];
  for (const field of required) if (typeof surface?.[field] !== "string" || !surface[field].trim()) errors.push(`${label}:MISSING_${field.toUpperCase()}`);
  if (!existsSync(path.join(workspaceRoot, String(surface?.sourcePath ?? "")))) {
    errors.push(`${label}:SOURCE_MISSING`);
    return;
  }
  if (!['BULK_EXPORT', 'NOT_A_BULK_EXPORT'].includes(surface.classification)) errors.push(`${label}:CLASSIFICATION_INVALID`);
  if (surface.classification !== "BULK_EXPORT") return;
  if (!Array.isArray(surface.sensitiveFieldExclusions) || surface.sensitiveFieldExclusions.length === 0) errors.push(`${label}:SENSITIVE_EXCLUSIONS_MISSING`);
  if (typeof surface.noStore !== "boolean" || !surface.noStore) errors.push(`${label}:PRIVATE_NO_STORE_REQUIRED`);
  if (typeof surface.audited !== "boolean") errors.push(`${label}:AUDIT_CLASSIFICATION_MISSING`);
  if (surface.maxRows !== null && (!Number.isInteger(surface.maxRows) || surface.maxRows < 1)) errors.push(`${label}:MAX_ROWS_INVALID`);
  if (/CSV/.test(surface.format) && surface.csvFormulaSafe !== true) errors.push(`${label}:CSV_FORMULA_SAFETY_REQUIRED`);

  const sources = dependencySources(surface.sourcePath);
  const routeSource = sources[0] ?? "";
  const joined = sources.join("\n");
  if (!new RegExp(`export\\s+async\\s+function\\s+${surface.method}\\b`).test(routeSource)) errors.push(`${label}:HTTP_METHOD_NOT_EXPORTED`);
  if (!/(?:requireApi|requireAcademicReportAccess|optionalOperationsActor|parentMeetingApiAuth|auth\.|auth=|auth\s*=)/.test(routeSource)) errors.push(`${label}:SERVER_AUTH_EVIDENCE_MISSING`);
  if (!/(?:private[^\n"']*no-store|no-store|PRIVATE_HEADERS|privateFinanceJson)/i.test(routeSource)) errors.push(`${label}:NO_STORE_SOURCE_EVIDENCE_MISSING`);
  const formulaSafeEvidence = /(?:csvCell|safeCsv|csvEscape|formulaSafe|formulaNeutral|spreadsheetFormula|DANGEROUS_CSV|FORMULA_PREFIX)/i.test(joined)
    || joined.includes("/^[=+\\-@]/");
  if (/CSV/.test(surface.format) && !formulaSafeEvidence) errors.push(`${label}:CSV_NEUTRALISATION_SOURCE_EVIDENCE_MISSING`);
  if (/(?:searchParams|nextUrl)/.test(routeSource) && /(?:get|has)\(["'](?:fields?|select|include)["']\)/.test(routeSource)) errors.push(`${label}:CLIENT_FIELD_SELECTION_PRESENT`);
}

export function validateBulkExportGovernance() {
  const manifest = JSON.parse(readBounded(manifestPath));
  const discovered = discoverExportLikeRoutes();
  const surfaces = Array.isArray(manifest.surfaces) ? manifest.surfaces : [];
  const errors = [];
  const duplicate = (values) => values.filter((value, index) => values.indexOf(value) !== index);
  for (const value of duplicate(surfaces.map((surface) => surface.id))) errors.push(`DUPLICATE_ID:${value}`);
  for (const value of duplicate(surfaces.map((surface) => surface.sourcePath))) errors.push(`DUPLICATE_SOURCE:${value}`);
  const represented = new Set(surfaces.map((surface) => surface.sourcePath));
  for (const sourcePath of discovered) if (!represented.has(sourcePath)) errors.push(`UNCLASSIFIED_EXPORT_LIKE_ROUTE:${sourcePath}`);
  for (const sourcePath of represented) if (!discovered.includes(sourcePath)) errors.push(`STALE_EXPORT_CLASSIFICATION:${sourcePath}`);
  for (const surface of surfaces) validateSurface(surface, errors);

  const bulk = surfaces.filter((surface) => surface.classification === "BULK_EXPORT");
  const nonBulk = surfaces.filter((surface) => surface.classification === "NOT_A_BULK_EXPORT");
  const mappedBulkFlag = bulk.filter((surface) => surface.featureFlag === "bulk-exports");
  const releaseFlag = manifest.bulkExportFlag;
  if (releaseFlag?.key !== "bulk-exports" || releaseFlag.committedDefaultState !== false || releaseFlag.committedRolloutPercentage !== 0) errors.push("BULK_EXPORT_FLAG_CONTRACT_INVALID");
  if (releaseFlag?.currentMappedSurfaceCount !== mappedBulkFlag.length) errors.push("BULK_EXPORT_FLAG_MAPPING_COUNT_MISMATCH");
  if (manifest.discovery?.discoveredCount !== discovered.length || manifest.discovery?.bulkExportCount !== bulk.length || manifest.discovery?.notBulkExportCount !== nonBulk.length) errors.push("BULK_EXPORT_MANIFEST_TOTALS_STALE");
  return { schemaVersion: 1, status: errors.length ? "FAIL" : "PASS", discoveredCount: discovered.length, bulkExportCount: bulk.length, notBulkExportCount: nonBulk.length, bulkExportFlagMappedSurfaceCount: mappedBulkFlag.length, errors: [...new Set(errors)].sort() };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const result = validateBulkExportGovernance();
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.status !== "PASS") process.exitCode = 1;
}
