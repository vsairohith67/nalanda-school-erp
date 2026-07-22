import { PrismaClient } from "@prisma/client";
import { loadEnvFile } from "node:process";

loadEnvFile();

const prisma = new PrismaClient();

async function main() {
  const identifier = process.argv[2] ?? process.env.MAKE_SUPER_ADMIN_USER ?? process.env.SUPER_ADMIN_USER;
  if (!identifier) {
    console.error("Provide a username/email as an argument or MAKE_SUPER_ADMIN_USER environment variable.");
    process.exit(1);
  }

  const value = identifier.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: value },
        { email: value }
      ]
    },
    select: { id: true, username: true, email: true, role: true, isActive: true }
  });

  if (!user) {
    console.error(`No existing user found for ${identifier}. Create the user first, then promote it.`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: "SUPER_ADMIN", isActive: true }
  });

  console.log(`Success: ${user.username} is now an active SUPER_ADMIN.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Unable to promote Super Admin.");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
