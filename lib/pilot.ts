import { constants } from "node:fs";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export function formatPilotDatabaseFilename(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    "nalanda-pilot",
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes())
  ].join("-") + ".db";
}

export function isPilotDatabaseUrl(databaseUrl: string | undefined | null) {
  if (!databaseUrl) return false;
  const normalized = databaseUrl.toLowerCase().replaceAll("\\", "/").split(/[?#]/, 1)[0];
  const filename = normalized.split("/").pop() ?? "";
  return normalized.includes("pilot-data") || filename.includes("pilot");
}

export function resolveSqliteDatabasePath(databaseUrl: string, projectDirectory = process.cwd()) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("DATABASE_URL must use a local SQLite file: path.");
  }

  const configuredPath = decodeURIComponent(databaseUrl.slice("file:".length).split(/[?#]/, 1)[0]);
  if (!configuredPath) throw new Error("DATABASE_URL does not include a SQLite database file.");

  if (path.isAbsolute(configuredPath)) return path.normalize(configuredPath);
  return path.resolve(projectDirectory, "prisma", configuredPath);
}

export async function readProjectDatabaseUrl(
  projectDirectory = process.cwd(),
  environment: NodeJS.ProcessEnv = process.env
) {
  if (environment.DATABASE_URL?.trim()) return environment.DATABASE_URL.trim();

  const envPath = path.join(projectDirectory, ".env");
  let envText: string;
  try {
    envText = await readFile(envPath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error(`DATABASE_URL is not set and ${envPath} was not found.`);
    }
    throw error;
  }

  const line = envText.split(/\r?\n/).find((entry) => /^\s*DATABASE_URL\s*=/.test(entry));
  const value = line?.replace(/^\s*DATABASE_URL\s*=\s*/, "").trim();
  const unquoted = value?.replace(/^(['"])(.*)\1$/, "$2").trim();
  if (!unquoted) throw new Error(`DATABASE_URL is missing from ${envPath}.`);
  return unquoted;
}

export async function createPilotDatabaseCopy(input: {
  sourcePath: string;
  destinationPath: string;
}) {
  try {
    const source = await stat(input.sourcePath);
    if (!source.isFile()) throw new Error(`Database path is not a file: ${input.sourcePath}`);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error(`Database file not found: ${input.sourcePath}`);
    }
    throw error;
  }

  await mkdir(path.dirname(input.destinationPath), { recursive: true });
  try {
    await copyFile(input.sourcePath, input.destinationPath, constants.COPYFILE_EXCL);
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") {
      throw new Error(`Pilot database already exists and was not overwritten: ${input.destinationPath}`);
    }
    throw error;
  }

  return input.destinationPath;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
