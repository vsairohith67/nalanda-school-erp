import path from "node:path";
import {
  createPilotDatabaseCopy,
  formatPilotDatabaseFilename,
  readProjectDatabaseUrl,
  resolveSqliteDatabasePath
} from "../lib/pilot";

async function main() {
  const projectDirectory = process.cwd();
  const databaseUrl = await readProjectDatabaseUrl(projectDirectory);
  const sourcePath = resolveSqliteDatabasePath(databaseUrl, projectDirectory);
  const filename = formatPilotDatabaseFilename();
  const destinationPath = path.join(projectDirectory, "pilot-data", filename);

  console.log("Creating a safe pilot database copy...");
  console.log(`Source database: ${sourcePath}`);
  await createPilotDatabaseCopy({ sourcePath, destinationPath });

  console.log(`Pilot database created: ${destinationPath}`);
  console.log("");
  console.log("Next steps:");
  console.log("1. Keep the app stopped while changing DATABASE_URL.");
  console.log(`2. In .env, set DATABASE_URL="file:../pilot-data/${filename}"`);
  console.log("3. Start the app with: pnpm dev");
  console.log('4. Sign in as Director/Admin and confirm "PILOT DATABASE MODE" is visible.');
  console.log('5. To return to the normal database, stop the app and restore DATABASE_URL="file:./dev.db".');
  console.log("6. Follow docs/REAL_DATA_PILOT_RUNBOOK.md before importing copied school data.");
  console.log("");
  console.log("The original database was not changed or deleted.");
}

main().catch((error) => {
  console.error("Pilot copy failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
