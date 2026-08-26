import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { resolveDatabaseProvider } from "../../lib/database-provider";

const prisma = new PrismaClient();
const expectedModels = (readFileSync("prisma/schema.prisma", "utf8").match(/^model\s+/gm) ?? []).length;
const expectedTriggers = JSON.parse(readFileSync("prisma/postgresql/trigger-manifest.json", "utf8")).triggerCount;

async function main() {
  if (resolveDatabaseProvider() !== "postgresql") throw new Error("POSTGRES_QA_REQUIRES_POSTGRESQL");
  const [version, tables, triggers, invalidIndexes, unvalidatedConstraints, migrations, size] = await Promise.all([
    prisma.$queryRaw<Array<{ version: string; major: number }>>`SELECT current_setting('server_version') AS version, current_setting('server_version_num')::integer / 10000 AS major`,
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*)::bigint AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'`,
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*)::bigint AS count FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND NOT t.tgisinternal AND t.tgenabled <> 'D'`,
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*)::bigint AS count FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND NOT i.indisvalid`,
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*)::bigint AS count FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND NOT c.convalidated`,
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*)::bigint AS count FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
    prisma.$queryRaw<Array<{ bytes: bigint }>>`SELECT pg_database_size(current_database())::bigint AS bytes`
  ]);
  const evidence = {
    result: "POSTGRES_BASELINE_QA_PASSED",
    serverVersion: version[0]?.version,
    serverMajor: version[0]?.major,
    tables: Number(tables[0]?.count ?? -1),
    expectedModels,
    activeTriggers: Number(triggers[0]?.count ?? -1),
    expectedTriggers,
    invalidIndexes: Number(invalidIndexes[0]?.count ?? -1),
    unvalidatedConstraints: Number(unvalidatedConstraints[0]?.count ?? -1),
    migrations: Number(migrations[0]?.count ?? -1),
    databaseBytes: Number(size[0]?.bytes ?? 0),
    providerFingerprint: createHash("sha256").update(`${version[0]?.major}:${Number(tables[0]?.count)}:${Number(triggers[0]?.count)}:${Number(migrations[0]?.count)}`).digest("hex").toUpperCase()
  };
  if (evidence.serverMajor !== 17 || evidence.tables !== expectedModels || evidence.activeTriggers !== expectedTriggers || evidence.invalidIndexes !== 0 || evidence.unvalidatedConstraints !== 0 || evidence.migrations !== 1) {
    throw new Error(`POSTGRES_BASELINE_QA_FAILED:${JSON.stringify(evidence)}`);
  }
  const output = path.resolve(process.env.POSTGRES_QA_EVIDENCE ?? "tmp/postgres-readiness-1a/baseline-qa.json");
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(evidence));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
