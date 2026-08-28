import { readdirSync, statSync } from "node:fs";
import path from "node:path";

type RouteKind = "page" | "api";

type RouteEntry = {
  kind: RouteKind;
  route: string;
  file: string;
};

const appDir = path.join(process.cwd(), "app");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    return statSync(fullPath).isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function routeFromFile(file: string): RouteEntry | null {
  const relative = path.relative(appDir, file).replaceAll(path.sep, "/");
  if (!relative.endsWith("/page.tsx") && !relative.endsWith("/route.ts")) return null;
  const isApi = /(^|\/)route\.ts$/.test(relative);
  const routePath = relative
    .replace(/\/page\.tsx$/, "")
    .replace(/\/route\.ts$/, "")
    .replace(/^page\.tsx$/, "")
    .replace(/^route\.ts$/, "")
    .split("/")
    .filter((segment) => !/^\(.+\)$/.test(segment))
    .join("/");
  return {
    kind: isApi ? "api" : "page",
    route: `/${routePath}`.replace(/\/$/, "") || "/",
    file: relative
  };
}

const routes = walk(appDir)
  .map(routeFromFile)
  .filter((route): route is RouteEntry => Boolean(route))
  .sort((a, b) => a.kind.localeCompare(b.kind) || a.route.localeCompare(b.route));

for (const kind of ["page", "api"] as const) {
  console.log(`${kind.toUpperCase()} ROUTES`);
  for (const route of routes.filter((entry) => entry.kind === kind)) {
    console.log(`${route.route.padEnd(45)} ${route.file}`);
  }
  console.log("");
}

console.log(`Total page routes: ${routes.filter((entry) => entry.kind === "page").length}`);
console.log(`Total API routes: ${routes.filter((entry) => entry.kind === "api").length}`);
