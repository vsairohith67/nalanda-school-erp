import path from "node:path";
import {expect,it} from "vitest";
import {assertHttpTarget} from "../scripts/portable/http-target";

const workspace=path.resolve(".");
const infrastructure={proxy:{reference:"caddy@sha256:"+"1".repeat(64),imageConfigDigest:"sha256:"+"2".repeat(64)},postgres:{reference:"postgres@sha256:"+"3".repeat(64),imageConfigDigest:"sha256:"+"4".repeat(64)}};
const validate=(containers:any[])=>assertHttpTarget(containers,"a".repeat(64),"123",workspace,infrastructure);
function fixture(){
 const project="nalanda-ci-123-1-stack",network=`${project}_application`;
 const container=(service:string):any=>({Id:(service==="web-1"?"a":service==="web-2"?"b":service==="postgres"?"d":"c").repeat(64),State:{Running:true},Config:{Labels:{"com.docker.compose.project":project,"com.docker.compose.service":service},Env:["DATABASE_URL_FILE=/run/secrets/database_url","APP_ORIGIN=https://portable-staging.localhost:8443"]},NetworkSettings:{Networks:{[network]:{NetworkID:"e".repeat(64),Aliases:[service]},[`${project}_data`]:{NetworkID:"f".repeat(64),Aliases:[service]}},Ports:{}},Mounts:[{Destination:"/run/secrets/database_url",Source:path.join(workspace,"tmp","portable-staging",project,"secrets","database_url"),RW:false}]});
 const proxy=container("reverse-proxy");proxy.NetworkSettings.Ports={"8443/tcp":[{HostIp:"127.0.0.1",HostPort:"8443"}]};
 proxy.Mounts=[{Destination:"/etc/caddy/Caddyfile",Source:path.join(workspace,"deploy","portable","Caddyfile"),RW:false},{Destination:"/opt/nalanda/caddy-entrypoint.sh",Source:path.join(workspace,"deploy","portable","caddy-entrypoint.sh"),RW:false}];
 delete proxy.NetworkSettings.Networks[`${project}_data`];proxy.NetworkSettings.Networks[`${project}_edge`]={NetworkID:"1".repeat(64),Aliases:["reverse-proxy"]};
 proxy.Config.Image=infrastructure.proxy.reference;proxy.Image=infrastructure.proxy.imageConfigDigest;proxy.Config.Entrypoint=["/bin/sh","/opt/nalanda/caddy-entrypoint.sh"];proxy.Config.Cmd=null;
 const pg=container("postgres");delete pg.NetworkSettings.Networks[network];pg.NetworkSettings.Networks[`${project}_backup-data`]={NetworkID:"2".repeat(64),Aliases:["postgres"]};pg.Config.Image=infrastructure.postgres.reference;pg.Image=infrastructure.postgres.imageConfigDigest;
 return [container("web-1"),container("web-2"),proxy,pg];
}
it("binds both HTTP proxy replicas to the same private database secret and owned network",()=>{
 expect(validate(fixture()).replicas).toHaveLength(2);
 const actual=fixture();actual[2].Config.Env.push("PORTABLE_UPSTREAMS=web-1:3000");expect(validate(actual).replicas).toHaveLength(1);
});
it.each([
 ["different replica database",(c:any[])=>{c[1].Mounts[0].Source+="-other";}],
 ["connection override",(c:any[])=>{c[0].Config.Env.push("DATABASE_URL=postgresql://unrelated.invalid/db");}],
 ["foreign project",(c:any[])=>{c[0].Config.Labels["com.docker.compose.project"]="nalanda-ci-999-1-stack";}],
 ["unbound proxy",(c:any[])=>{c[2].NetworkSettings.Networks={};}],
 ["public listener",(c:any[])=>{c[2].NetworkSettings.Ports["8443/tcp"][0].HostIp="0.0.0.0";}],
 ["other listener",(c:any[])=>{c[1].NetworkSettings.Ports=c[2].NetworkSettings.Ports;}],
 ["foreign proxy config",(c:any[])=>{c[2].Mounts[0].Source=path.join(workspace,"tmp","foreign-Caddyfile");}],
 ["writable proxy config",(c:any[])=>{c[2].Mounts[0].RW=true;}],
 ["foreign upstream",(c:any[])=>{c[2].Config.Env.push("PORTABLE_UPSTREAMS=foreign:3000");}],
 ["stopped replica",(c:any[])=>{c[1].State.Running=false;}],
 ["duplicate replica",(c:any[])=>{c.push(structuredClone(c[0]));}],
 ["missing replica",(c:any[])=>{c.splice(1,1);}],
 ["substituted proxy image",(c:any[])=>{c[2].Image="sha256:"+"9".repeat(64);}],
 ["substituted proxy process",(c:any[])=>{c[2].Config.Cmd=["foreign-proxy"]; }],
 ["shadowed web alias",(c:any[])=>{c[1].NetworkSettings.Networks["nalanda-ci-123-1-stack_application"].Aliases.push("web-1");}],
 ["shadowed postgres alias",(c:any[])=>{c[1].NetworkSettings.Networks["nalanda-ci-123-1-stack_data"].Aliases.push("postgres");}],
 ["different database network",(c:any[])=>{c[1].NetworkSettings.Networks["nalanda-ci-123-1-stack_data"].NetworkID="9".repeat(64);}],
 ["host resolution override",(c:any[])=>{c[0].HostConfig={ExtraHosts:["postgres:203.0.113.1"]};}],
] as const)("rejects %s before any HTTP request",(_name,mutate)=>{const containers=fixture();mutate(containers);expect(()=>validate(containers)).toThrow();});
