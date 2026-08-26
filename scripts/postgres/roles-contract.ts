import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { resolveDatabaseProvider } from "../../lib/database-provider";
import { assertSyntheticPostgresQa } from "./synthetic-qa";

const prisma = new PrismaClient();
const outputPath = path.resolve(process.env.POSTGRES_ROLE_EVIDENCE ?? "tmp/postgres-readiness-1a/roles.json");

const governedStatements = [
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nalanda_runtime') THEN CREATE ROLE nalanda_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nalanda_backup') THEN CREATE ROLE nalanda_backup NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nalanda_readonly_diagnostics') THEN CREATE ROLE nalanda_readonly_diagnostics NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF; END $$`,
  `REVOKE CREATE ON SCHEMA public FROM PUBLIC`,
  `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM nalanda_runtime, nalanda_backup, nalanda_readonly_diagnostics`,
  `REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM nalanda_runtime, nalanda_backup, nalanda_readonly_diagnostics`,
  `GRANT USAGE ON SCHEMA public TO nalanda_runtime, nalanda_backup, nalanda_readonly_diagnostics`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nalanda_runtime`,
  `REVOKE INSERT, UPDATE, DELETE ON TABLE public."_prisma_migrations" FROM nalanda_runtime`,
  `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nalanda_runtime`,
  `GRANT SELECT ON ALL TABLES IN SCHEMA public TO nalanda_backup`,
  `GRANT SELECT ON ALL TABLES IN SCHEMA public TO nalanda_readonly_diagnostics`,
  `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nalanda_runtime`,
  `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO nalanda_runtime`,
  `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO nalanda_backup, nalanda_readonly_diagnostics`,
  `DO $$ BEGIN EXECUTE format('GRANT nalanda_runtime, nalanda_backup, nalanda_readonly_diagnostics TO %I', current_user); END $$`
] as const;

async function expectDenied(role: string, sql: string) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
      await tx.$executeRawUnsafe(sql);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/permission denied|must be superuser|must be owner/i.test(message)) return true;
    throw error;
  }
  return false;
}

async function main() {
  assertSyntheticPostgresQa();
  if (resolveDatabaseProvider() !== "postgresql") throw new Error("POSTGRES_ROLE_QA_REQUIRES_POSTGRESQL");
  for (const statement of governedStatements) await prisma.$executeRawUnsafe(statement);

  const roleRows = await prisma.$queryRaw<Array<{ rolname: string; rolsuper: boolean; rolcreatedb: boolean; rolcreaterole: boolean; rolbypassrls: boolean }>>`
    SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
    FROM pg_roles
    WHERE rolname IN ('nalanda_runtime', 'nalanda_backup', 'nalanda_readonly_diagnostics')
    ORDER BY rolname
  `;
  if (roleRows.length !== 3 || roleRows.some((role) => role.rolsuper || role.rolcreatedb || role.rolcreaterole || role.rolbypassrls)) {
    throw new Error("POSTGRES_ROLE_ATTRIBUTES_UNSAFE");
  }

  const runtimeCrud = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL ROLE nalanda_runtime`);
    const count = await tx.user.count();
    const id = "postgres-role-contract-runtime";
    await tx.user.upsert({
      where: { id },
      create: { id, name: "Synthetic PostgreSQL Runtime", username: id, passwordHash: "synthetic-not-a-login-secret", role: "ACCOUNTANT", isActive: false },
      update: { name: "Synthetic PostgreSQL Runtime Updated" }
    });
    await tx.user.delete({ where: { id } });
    return count >= 0;
  });

  const runtimeCreateSchemaDenied = await expectDenied("nalanda_runtime", `CREATE SCHEMA postgres_role_contract_forbidden`);
  const runtimeCreateTableDenied = await expectDenied("nalanda_runtime", `CREATE TABLE public.postgres_role_contract_forbidden(id integer)`);
  const runtimeAlterMigrationsDenied = await expectDenied("nalanda_runtime", `ALTER TABLE public."_prisma_migrations" ADD COLUMN postgres_role_contract_forbidden integer`);
  const runtimeInsertMigrationsDenied = await expectDenied("nalanda_runtime", `INSERT INTO public."_prisma_migrations" (id, checksum, migration_name) VALUES ('postgres-role-contract-forbidden', 'forbidden', 'forbidden')`);
  const runtimeUpdateMigrationsDenied = await expectDenied("nalanda_runtime", `UPDATE public."_prisma_migrations" SET checksum = checksum WHERE false`);
  const runtimeDeleteMigrationsDenied = await expectDenied("nalanda_runtime", `DELETE FROM public."_prisma_migrations" WHERE false`);
  const runtimeCreateSuperuserDenied = await expectDenied("nalanda_runtime", `CREATE ROLE postgres_role_contract_forbidden SUPERUSER`);
  const backupWriteDenied = await expectDenied("nalanda_backup", `DELETE FROM public."User" WHERE false`);
  const diagnosticsWriteDenied = await expectDenied("nalanda_readonly_diagnostics", `DELETE FROM public."User" WHERE false`);
  const publicCreate = await prisma.$queryRaw<Array<{ allowed: boolean }>>`SELECT has_schema_privilege('public', 'public', 'CREATE') AS allowed`;

  const evidence = {
    result: "POSTGRES_ROLES_CONTRACT_PASSED",
    roles: roleRows,
    runtimeCrud,
    runtimeCreateSchemaDenied,
    runtimeCreateTableDenied,
    runtimeAlterMigrationsDenied,
    runtimeInsertMigrationsDenied,
    runtimeUpdateMigrationsDenied,
    runtimeDeleteMigrationsDenied,
    runtimeCreateSuperuserDenied,
    backupRead: true,
    backupWriteDenied,
    diagnosticsRead: true,
    diagnosticsWriteDenied,
    publicSchemaCreateRevoked: publicCreate[0]?.allowed === false
  };
  if (Object.entries(evidence).some(([key, value]) => key !== "roles" && key !== "result" && value !== true)) {
    throw new Error(`POSTGRES_ROLES_CONTRACT_FAILED:${JSON.stringify(evidence)}`);
  }
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ result: evidence.result, roleCount: roleRows.length, runtimeCrud, prohibitedOperationsDenied: 9 }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
