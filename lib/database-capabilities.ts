import { Prisma, type PrismaClient } from "@prisma/client";
import { resolveDatabaseProvider, type DatabaseProvider } from "@/lib/database-provider";

type QueryClient = Pick<PrismaClient, "$queryRaw"> | { $queryRaw?: (...args: any[]) => Promise<unknown> };

async function rows(client: QueryClient, query: ReturnType<typeof Prisma.sql>) {
  if (typeof client.$queryRaw !== "function") return null;
  return client.$queryRaw(query) as Promise<Array<Record<string, unknown>>>;
}

export async function databaseTableExists(
  client: QueryClient,
  table: string,
  provider: DatabaseProvider = resolveDatabaseProvider()
) {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,62}$/.test(table)) throw new Error("DATABASE_TABLE_PROBE_REFUSED");
  const result = provider === "sqlite"
    ? await rows(client, Prisma.sql`SELECT 1 AS "present" FROM sqlite_master WHERE type = 'table' AND name = ${table} LIMIT 1`)
    : await rows(client, Prisma.sql`SELECT 1 AS "present" FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = ${table} LIMIT 1`);
  return result === null ? true : result.length === 1;
}

export async function databaseColumnExists(
  client: QueryClient,
  table: string,
  column: string,
  provider: DatabaseProvider = resolveDatabaseProvider()
) {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,62}$/.test(table) || !/^[A-Za-z][A-Za-z0-9_]{0,62}$/.test(column)) {
    throw new Error("DATABASE_COLUMN_PROBE_REFUSED");
  }
  const result = provider === "sqlite"
    ? await rows(client, Prisma.sql`SELECT 1 AS "present" FROM pragma_table_info(${table}) WHERE name = ${column} LIMIT 1`)
    : await rows(client, Prisma.sql`SELECT 1 AS "present" FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ${table} AND column_name = ${column} LIMIT 1`);
  return result === null ? true : result.length === 1;
}

export async function databaseIntegritySummary(
  client: Pick<PrismaClient, "$queryRaw">,
  provider: DatabaseProvider = resolveDatabaseProvider()
) {
  if (provider === "sqlite") {
    const integrity = await client.$queryRaw<Array<{ quick_check: string }>>(Prisma.sql`PRAGMA quick_check`);
    const foreignKeys = await client.$queryRaw<unknown[]>(Prisma.sql`PRAGMA foreign_key_check`);
    return { provider, healthy: integrity.every((row) => row.quick_check === "ok") && foreignKeys.length === 0, affectedCount: foreignKeys.length + (integrity.every((row) => row.quick_check === "ok") ? 0 : 1) };
  }
  const [connection] = await client.$queryRaw<Array<{ ok: number }>>(Prisma.sql`SELECT 1::int AS ok`);
  const [constraints] = await client.$queryRaw<Array<{ count: number }>>(Prisma.sql`SELECT COUNT(*)::int AS count FROM pg_constraint WHERE connamespace = current_schema()::regnamespace AND NOT convalidated`);
  const affectedCount = Number(constraints?.count ?? 0) + (connection?.ok === 1 ? 0 : 1);
  return { provider, healthy: affectedCount === 0, affectedCount };
}

export async function databaseSizeBytes(
  client: Pick<PrismaClient, "$queryRaw">,
  provider: DatabaseProvider = resolveDatabaseProvider()
) {
  if (provider !== "postgresql") return null;
  const [row] = await client.$queryRaw<Array<{ bytes: bigint }>>(Prisma.sql`SELECT pg_database_size(current_database()) AS bytes`);
  return Number(row?.bytes ?? 0);
}
