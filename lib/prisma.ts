import { PrismaClient } from "@prisma/client";
import { assertQa20cIsolatedEnvironment } from "@/lib/qa20c-isolation";
import { assertDatabaseProviderConfiguration } from "@/lib/database-provider";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

assertQa20cIsolatedEnvironment(process.env, { logEvidence: true });
assertDatabaseProviderConfiguration(process.env);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    transactionOptions: {
      maxWait: 2_000,
      timeout: 10_000
    }
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
