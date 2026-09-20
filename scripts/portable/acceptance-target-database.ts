import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {hydratePortableRuntimeSecrets} from "../../lib/portable-runtime/secrets";

export function servedSyntheticDatabase(){
 assert.equal(process.env.NALANDA_SYNTHETIC_STAGING,"true");
 assert.equal(process.env.NODE_ENV,"production");
 assert.equal(process.env.APP_ORIGIN,"https://portable-staging.localhost:8443");
 hydratePortableRuntimeSecrets();
 const connection=new URL(process.env.DATABASE_URL??"");
 assert.equal(connection.protocol,"postgresql:");assert.equal(connection.hostname,"postgres");
 assert.equal(connection.pathname,"/nalanda_portable_synthetic");assert.equal(connection.searchParams.get("schema"),"public");
 // Next changes its process title. Resolve the child of the reviewed runtime
 // launcher instead of assuming /proc/cmdline still contains server.js.
 const launchers=readdirSync("/proc").filter(pid=>/^\d+$/.test(pid)).flatMap(pid=>{try{const args=readFileSync(`/proc/${pid}/cmdline`,"utf8").split("\0");return args.some(a=>/(?:^|\/)dist\/portable\/runtime-command\.mjs$/.test(a))&&args.includes("web")?[pid]:[];}catch{return [];}});
 assert.equal(launchers.length,1,"SERVED_LAUNCHER_NOT_UNIQUE");
 const children=readFileSync(`/proc/${launchers[0]}/task/${launchers[0]}/children`,"utf8").trim().split(/\s+/).filter(Boolean);
 assert.equal(children.length,1,"SERVED_PROCESS_NOT_UNIQUE");
 const startup=readFileSync(`/proc/${children[0]}/environ`,"utf8").split("\0");
 assert(startup.includes(`DATABASE_URL=${connection.toString()}`),"DATABASE_SECRET_CHANGED_SINCE_STARTUP");
 assert(startup.includes("NODE_ENV=production"));assert(startup.includes("NALANDA_SYNTHETIC_STAGING=true"));
 return connection;
}
