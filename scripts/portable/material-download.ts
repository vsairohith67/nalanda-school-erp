import {lookup} from "node:dns/promises";
import {request} from "node:https";
import {rootCertificates} from "node:tls";
import {isIPv4} from "node:net";
import {hashBytes} from "./artifact-handoff";
import {requireInput} from "./product-input-contract";

/** Direct TLS only: one validated public IPv4 is pinned into the socket lookup.
 * No proxy, redirect, environment CA, cookies, credentials or child downloader.
 * Package hooks are confined separately by BuildKit network=none. */
export function publicMaterialAddress(address:string){
 if(!isIPv4(address))return false;
 const [a,b,c]=address.split(".").map(Number);
 return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0&&(c===0||c===2)||b===88&&c===99)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);
}
export function materialDownloadURL(url:string){const u=new URL(url);requireInput(u.href===url&&u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&["registry.npmjs.org","cdn.sheetjs.com","nodejs.org","snapshot.debian.org","binaries.prisma.sh"].includes(u.hostname),"MATERIAL_DOWNLOAD_INVALID");return u;}
export async function downloadMaterialBytes(url:string,expected:string,size:number){
 const u=materialDownloadURL(url);requireInput(/^[a-f0-9]{64}$/.test(expected)&&Number.isSafeInteger(size)&&size>0&&size<=64*1024**2,"MATERIAL_DOWNLOAD_INVALID");
 const addresses=await lookup(u.hostname,{family:4,all:true});requireInput(addresses.length>0&&addresses.every(x=>publicMaterialAddress(x.address)),"MATERIAL_DOWNLOAD_ADDRESS_REFUSED");
 return new Promise<Buffer>((resolve,reject)=>{
  let count=0;const chunks:Buffer[]=[];
  const r=request(u,{method:"GET",agent:false,ca:[...rootCertificates],servername:u.hostname,headers:{accept:"application/json, application/octet-stream"},lookup:((_h:any,opts:any,cb:any)=>cb(null,opts.all?[addresses[0]]:addresses[0].address,4)) as any},res=>{
   if(res.statusCode!==200||res.headers.location||res.headers['content-encoding']&&res.headers['content-encoding']!=="identity"||res.headers['content-length']&&Number(res.headers['content-length'])!==size){r.destroy(Error("MATERIAL_DOWNLOAD_RESPONSE_REFUSED"));res.destroy();return;}
   res.on("data",(chunk:Buffer)=>{count+=chunk.length;if(count>size){r.destroy(Error("MATERIAL_DOWNLOAD_BOUND"));res.destroy();return;}chunks.push(chunk);});
   res.on("error",()=>r.destroy(Error("MATERIAL_DOWNLOAD_FAILED")));
   res.once("end",()=>{clearTimeout(timer);const raw=Buffer.concat(chunks);if(count!==size||hashBytes(raw)!==expected)reject(Error("MATERIAL_DOWNLOAD_SUBSTITUTED"));else resolve(raw);});
  });
  const timer=setTimeout(()=>r.destroy(Error("MATERIAL_DOWNLOAD_TIMEOUT")),120000);
  r.once("error",()=>{clearTimeout(timer);reject(Error("MATERIAL_DOWNLOAD_REFUSED"));});r.end();
 });
}
