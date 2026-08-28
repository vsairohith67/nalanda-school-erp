import packageJson from "../package.json";
import { databaseProviderLabel } from "@/lib/database-provider";
import { PRODUCT_BRAND } from "@/config/product-brand";

export const APP_NAME = PRODUCT_BRAND.productName;
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
    databaseProvider: databaseProviderLabel(environment)
  };
}
