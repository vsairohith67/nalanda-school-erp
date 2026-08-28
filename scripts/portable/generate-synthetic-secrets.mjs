import { randomBytes } from "node:crypto";
import { lstat, mkdir, open, realpath, rm } from "node:fs/promises";
import path from "node:path";

const workspace = path.resolve(".");
const root = path.resolve(process.env.PORTABLE_SYNTHETIC_SECRET_ROOT || path.join(workspace, "tmp", "portable-staging", "secrets"));
const allowed = path.resolve(workspace, "tmp", "portable-staging");
const relative = path.relative(allowed, root);
if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("SYNTHETIC_SECRET_ROOT_INVALID");
if (process.env.NALANDA_SYNTHETIC_STAGING !== "true") throw new Error("SYNTHETIC_SECRET_OPT_IN_REQUIRED");

await mkdir(allowed, { recursive: true, mode: 0o700 });
const allowedStat = await lstat(allowed);
if (!allowedStat.isDirectory() || allowedStat.isSymbolicLink() || await realpath(allowed) !== allowed) throw new Error("SYNTHETIC_SECRET_PARENT_UNSAFE");

const existing = await lstat(root).catch(() => null);
if (existing) {
  if (process.argv[2] !== "--replace-local") throw new Error("SYNTHETIC_SECRET_ROOT_EXISTS");
  const resolved = await realpath(root);
  if (resolved !== root || existing.isSymbolicLink()) throw new Error("SYNTHETIC_SECRET_ROOT_UNSAFE");
  await rm(root, { recursive: true, force: false });
}
await mkdir(root, { recursive: false, mode: 0o700 });

const token = (bytes = 36) => randomBytes(bytes).toString("base64url");
const postgresRuntime = token(30);
const postgresMigrator = token(30);
const postgresBootstrap = token(30);
const postgresBackup = token(30);
const postgresBackupMaintenance = token(30);
const valkeyPassword = token(30);
const minioRootAccess = randomBytes(12).toString("hex");
const minioRootSecret = token(36);
const minioKmsSecret = `portable-synthetic-key:${randomBytes(32).toString("base64")}`;
const s3Access = randomBytes(12).toString("hex");
const s3Secret = token(36);
const s3BackupAccess = randomBytes(12).toString("hex");
const s3BackupSecret = token(36);
const s3BackupMaintenanceAccess = randomBytes(12).toString("hex");
const s3BackupMaintenanceSecret = token(36);
const databaseName = "nalanda_portable_synthetic";
const files = new Map([
  ["postgres_runtime_password", postgresRuntime],
  ["postgres_migrator_password", postgresMigrator],
  ["postgres_bootstrap_password", postgresBootstrap],
  ["postgres_backup_password", postgresBackup],
  ["postgres_backup_maintenance_password", postgresBackupMaintenance],
  ["valkey_password", valkeyPassword],
  ["minio_root_access_key", minioRootAccess],
  ["minio_root_secret_key", minioRootSecret],
  ["minio_kms_secret_key", minioKmsSecret],
  ["s3_access_key_id", s3Access],
  ["s3_secret_access_key", s3Secret],
  ["s3_backup_access_key_id", s3BackupAccess],
  ["s3_backup_secret_access_key", s3BackupSecret],
  ["s3_backup_maintenance_access_key_id", s3BackupMaintenanceAccess],
  ["s3_backup_maintenance_secret_access_key", s3BackupMaintenanceSecret],
  ["auth_secret", token(48)],
  ["auth_verification_secret", token(48)],
  ["proxy_shared_secret", token(48)],
  ["internal_health_token", token(48)],
  ["backup_encryption_key", randomBytes(32).toString("base64")],
  ["synthetic_director_password", token(24)],
  ["database_url", `postgresql://nalanda_runtime:${encodeURIComponent(postgresRuntime)}@postgres:5432/${databaseName}?schema=public&connection_limit=20&pool_timeout=20&connect_timeout=10`],
  ["backup_database_url", `postgresql://nalanda_backup:${encodeURIComponent(postgresBackup)}@postgres:5432/${databaseName}?schema=public&connection_limit=4&pool_timeout=20&connect_timeout=10`],
  ["backup_maintenance_database_url", `postgresql://nalanda_backup_maintenance:${encodeURIComponent(postgresBackupMaintenance)}@postgres:5432/${databaseName}?schema=public&connection_limit=2&pool_timeout=20&connect_timeout=10`],
  ["direct_url", `postgresql://nalanda_migrator:${encodeURIComponent(postgresMigrator)}@postgres:5432/${databaseName}?schema=public&connect_timeout=10`],
  ["valkey_url", `redis://:${encodeURIComponent(valkeyPassword)}@valkey:6379/0`]
]);

for (const [name, value] of files) {
  const handle = await open(path.join(root, name), "wx", 0o600);
  try { await handle.writeFile(`${value}\n`, "utf8"); await handle.sync(); }
  finally { await handle.close(); }
}
console.log(JSON.stringify({ result: "SYNTHETIC_SECRETS_CREATED", root, files: [...files.keys()].sort(), remoteUse: false }));
