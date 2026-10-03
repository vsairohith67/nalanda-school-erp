import assert from "node:assert/strict";
import path from "node:path";

// Docker inspect data, not caller-supplied database coordinates, binds all
// round-robin replicas and the published proxy to one owned application target.
export function assertHttpTarget(containers:any[],containerId:string,runId:string,workspace:string,infrastructure:{proxy:{reference:string;imageConfigDigest:string};postgres:{reference:string;imageConfigDigest:string}}){
 const selected=containers.find(c=>c.Id===containerId);assert(selected,"HTTP_CONTAINER_NOT_FOUND");
 const project=selected.Config?.Labels?.["com.docker.compose.project"];
 assert(new RegExp(`^nalanda-ci-${runId}-[a-z0-9-]+$`).test(project??""));
 const owned=containers.filter(c=>c.Config?.Labels?.["com.docker.compose.project"]===project);
 const service=(name:string)=>{const matches=owned.filter(c=>c.Config?.Labels?.["com.docker.compose.service"]===name);assert.equal(matches.length,1,"HTTP_SERVICE_AMBIGUOUS");assert.equal(matches[0].State?.Running,true);return matches[0];};
 const proxy=service("reverse-proxy"),web=service("web-1");assert.equal(web.Id,selected.Id);
 const postgres=service("postgres");
 for(const [container,expected] of [[proxy,infrastructure.proxy],[postgres,infrastructure.postgres]] as const){assert.equal(container.Config.Image,expected.reference);assert.equal(container.Image,expected.imageConfigDigest);}
 assert.deepEqual(proxy.Config.Entrypoint,["/bin/sh","/opt/nalanda/caddy-entrypoint.sh"]);assert(!proxy.Config.Cmd?.length);
 const upstream=(proxy.Config.Env??[]).find((e:string)=>e.startsWith("PORTABLE_UPSTREAMS="))?.slice("PORTABLE_UPSTREAMS=".length)??"web-1:3000 web-2:3000";
 assert(["web-1:3000","web-1:3000 web-2:3000"].includes(upstream),"HTTP_UPSTREAM_UNREVIEWED");
 const replicas=upstream==="web-1:3000"?[web]:[web,service("web-2")];
 const ports=proxy.NetworkSettings?.Ports?.["8443/tcp"];
 assert.deepEqual(ports,[{HostIp:"127.0.0.1",HostPort:"8443"}]);
 // Refuse another container claiming the same entrypoint.
 assert.equal(containers.filter(c=>Object.values(c.NetworkSettings?.Ports??{}).flat().some((p:any)=>p?.HostPort==="8443")).length,1);
 for(const [file,destination] of [["Caddyfile","/etc/caddy/Caddyfile"],["caddy-entrypoint.sh","/opt/nalanda/caddy-entrypoint.sh"]]){
  const mounts=proxy.Mounts.filter((m:any)=>m.Destination===destination);assert.equal(mounts.length,1);assert.equal(mounts[0].RW,false);assert.equal(mounts[0].Source,path.join(workspace,"deploy","portable",file));
 }
 const network=`${project}_application`;
 const data=`${project}_data`;
 const networks=(c:any,names:string[])=>{assert.deepEqual(Object.keys(c.NetworkSettings.Networks).sort(),names.sort());assert(!c.HostConfig?.ExtraHosts?.length);assert(!c.HostConfig?.Dns?.length);assert(!c.HostConfig?.DnsSearch?.length);};
 networks(proxy,[`${project}_edge`,network]);networks(postgres,[data,`${project}_backup-data`]);
 const alias=(name:string,owner:any,net:string)=>{const id=owner.NetworkSettings.Networks[net].NetworkID;assert(/^[a-f0-9]{64}$/.test(id));const claiming=containers.filter(c=>Object.values(c.NetworkSettings.Networks).some((n:any)=>n.NetworkID===id&&n.Aliases?.includes(name)));assert.deepEqual(claiming.map(c=>c.Id),[owner.Id],"HTTP_DNS_ALIAS_AMBIGUOUS");return id;};
 const databaseNetwork=alias("postgres",postgres,data);
 const databaseSecrets=replicas.map(c=>{
  networks(c,[network,data]);assert.equal(c.NetworkSettings.Networks[network].NetworkID,proxy.NetworkSettings.Networks[network].NetworkID);assert.equal(c.NetworkSettings.Networks[data].NetworkID,databaseNetwork);
  alias(c.Config.Labels["com.docker.compose.service"],c,network);
  assert(c.Config.Env.includes("DATABASE_URL_FILE=/run/secrets/database_url"));
  assert(!c.Config.Env.some((e:string)=>e.startsWith("DATABASE_URL=")));
  assert(c.Config.Env.includes("APP_ORIGIN=https://portable-staging.localhost:8443"));
  const mounts=c.Mounts.filter((m:any)=>m.Destination==="/run/secrets/database_url");assert.equal(mounts.length,1);assert.equal(mounts[0].RW,false);
  assert(mounts[0].Source.startsWith(path.join(workspace,"tmp","portable-staging")+path.sep));return mounts[0].Source;
 });
 assert.equal(new Set(databaseSecrets).size,1,"HTTP_REPLICAS_DIFFERENT_DATABASES");
 return {project,replicas,proxy};
}
