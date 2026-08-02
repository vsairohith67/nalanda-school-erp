import { existsSync, statSync } from "node:fs";
import { fileSha256 } from "./migration-check-utils";

export type SqliteSnapshot = Array<{ path: string; size: number; hash: string }>;

export function sqliteArtifacts(database: string) { return [database, `${database}-journal`, `${database}-wal`, `${database}-shm`]; }

export function assertSqliteCopyReady(database: string, code: string) {
  if (!existsSync(database)) throw new Error(`${code}_DATABASE_MISSING`);
  const sidecars = sqliteArtifacts(database).slice(1).filter(existsSync);
  if (sidecars.length) throw new Error(`${code}_SQLITE_SIDECAR_PRESENT:${sidecars.map((path) => path.split(/[\\/]/).pop()).join(",")}`);
}

export function snapshotSqliteArtifacts(database: string): SqliteSnapshot {
  return sqliteArtifacts(database).filter(existsSync).map((path) => ({ path, size: statSync(path).size, hash: fileSha256(path) }));
}

export function assertSqliteSnapshotUnchanged(before: SqliteSnapshot, after: SqliteSnapshot, code: string) {
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(code);
}
