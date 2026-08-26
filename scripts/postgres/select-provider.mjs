#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const providerArgument = process.argv.find((value) => value.startsWith("--provider="))?.slice("--provider=".length);
const requested = (providerArgument ?? process.env.DATABASE_PROVIDER ?? "sqlite").trim().toLowerCase();
const action = process.argv[2] ?? "generate";
const allowedProviders = new Set(["sqlite", "postgresql"]);

function fail(code) {
  console.error(code);
  process.exit(1);
}

if (!allowedProviders.has(requested)) fail("DATABASE_PROVIDER_INVALID");
if (!new Set(["generate", "migrate", "status"]).has(action)) fail("DATABASE_PROVIDER_ACTION_INVALID");

const databaseUrl = (process.env.DATABASE_URL ?? "").trim();
const directUrl = (process.env.DIRECT_URL ?? "").trim();
const deployment = ((process.env.DEPLOYMENT_ENVIRONMENT ?? process.env.NALANDA_ENVIRONMENT) ?? "").trim().toLowerCase();
if (databaseUrl && requested === "sqlite" && !databaseUrl.startsWith("file:")) fail("DATABASE_PROVIDER_URL_MISMATCH");
if (databaseUrl && requested === "postgresql" && !/^postgres(?:ql)?:\/\//i.test(databaseUrl)) fail("DATABASE_PROVIDER_URL_MISMATCH");
if (action !== "generate" && !databaseUrl) fail("DATABASE_URL_REQUIRED");
if (action !== "generate" && requested === "postgresql" && !/^postgres(?:ql)?:\/\//i.test(directUrl)) fail("DIRECT_URL_REQUIRED");

function boundedPositiveInteger(url, name, maximum, code) {
  const value = Number(url.searchParams.get(name));
  if (!Number.isInteger(value) || value < 1 || value > maximum) fail(code);
}

function deploymentPostgresUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${label}_INVALID`);
  }
  if (!new Set(["require", "verify-ca", "verify-full"]).has((parsed.searchParams.get("sslmode") ?? "").toLowerCase())) fail("POSTGRESQL_DEPLOYMENT_TLS_REQUIRED");
  if ((parsed.searchParams.get("sslaccept") ?? "").toLowerCase() !== "strict") fail("POSTGRESQL_DEPLOYMENT_TLS_CERTIFICATE_VALIDATION_REQUIRED");
  return parsed;
}

if (requested === "postgresql" && ["staging", "production"].includes(deployment)) {
  if (!databaseUrl || !directUrl) fail("POSTGRESQL_DEPLOYMENT_URLS_REQUIRED");
  const runtime = deploymentPostgresUrl(databaseUrl, "DATABASE_URL");
  const migrator = deploymentPostgresUrl(directUrl, "DIRECT_URL");
  if (!runtime.username || !migrator.username || runtime.username === migrator.username) fail("POSTGRESQL_DEPLOYMENT_DISTINCT_IDENTITIES_REQUIRED");
  boundedPositiveInteger(runtime, "connection_limit", 50, "POSTGRESQL_RUNTIME_CONNECTION_LIMIT_REQUIRED");
  boundedPositiveInteger(runtime, "pool_timeout", 60, "POSTGRESQL_RUNTIME_POOL_TIMEOUT_REQUIRED");
  boundedPositiveInteger(runtime, "connect_timeout", 30, "POSTGRESQL_RUNTIME_CONNECT_TIMEOUT_REQUIRED");
  boundedPositiveInteger(migrator, "connect_timeout", 30, "POSTGRESQL_MIGRATOR_CONNECT_TIMEOUT_REQUIRED");
}

const schema = requested === "sqlite" ? "prisma/schema.prisma" : "prisma/postgresql/schema.prisma";
if (!existsSync(path.join(workspace, schema))) fail("DATABASE_PROVIDER_SCHEMA_MISSING");
if (requested === "postgresql") {
  const check = spawnSync(process.execPath, ["scripts/postgres/schema-contract.mjs", "--check"], {
    cwd: workspace,
    env: { ...process.env, DATABASE_PROVIDER: requested },
    encoding: "utf8",
    windowsHide: true
  });
  if (check.status !== 0) fail(check.stderr.trim() || check.stdout.trim() || "POSTGRES_SCHEMA_CONTRACT_FAILED");
}

const prismaEntry = path.join(workspace, "node_modules", "prisma", "build", "index.js");
const prismaAction = action === "generate" ? ["generate"] : ["migrate", action === "migrate" ? "deploy" : "status"];
const placeholder = "postgresql://provider-generation.invalid/nalanda_generation_only";
const environment = {
  ...process.env,
  DATABASE_PROVIDER: requested,
  ...(action === "generate" && requested === "sqlite" && !databaseUrl ? { DATABASE_URL: "file:./provider-generation.db" } : {}),
  ...(action === "generate" && requested === "postgresql" && !databaseUrl ? { DATABASE_URL: placeholder } : {}),
  ...(action === "generate" && requested === "postgresql" && !directUrl ? { DIRECT_URL: placeholder } : {})
};
const result = spawnSync(process.execPath, [prismaEntry, ...prismaAction, "--schema", schema], {
  cwd: workspace,
  env: environment,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
  windowsHide: true
});
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
if (result.error) fail(`DATABASE_PROVIDER_COMMAND_START_FAILED:${result.error.message}`);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`DATABASE_PROVIDER_SELECTED:${requested}:${action}`);
