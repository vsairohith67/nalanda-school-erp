import packageJson from "../package.json";

export const APP_NAME = "Nalanda Fee Control";
export const DATABASE_PROVIDER = "SQLite";

export type AppInfo = {
  name: string;
  version: string;
  buildMode: string;
  databaseProvider: string;
};

export function getAppInfo(environment: NodeJS.ProcessEnv = process.env): AppInfo {
  return {
    name: APP_NAME,
    version: packageJson.version,
    buildMode: environment.NODE_ENV === "production" ? "Production" : "Development",
    databaseProvider: DATABASE_PROVIDER
  };
}
