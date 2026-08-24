import { PrismaClient } from "@prisma/client";
import { assertQa20cIsolatedEnvironment } from "@/lib/qa20c-isolation";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

assertQa20cIsolatedEnvironment(process.env, { logEvidence: true });

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
