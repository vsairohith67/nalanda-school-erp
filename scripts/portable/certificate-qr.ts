import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtempSync,writeFileSync,lstatSync,readFileSync,rmSync,existsSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {referenceToken} from "./http-assertions";
import {PDFDocument} from "pdf-lib";

type DecoderProcess=(command:string,args:string[])=>Buffer;
const processDecoder:DecoderProcess=(command,args)=>{
 try{return execFileSync(command,args,{timeout:30_000,maxBuffer:4096,windowsHide:true,stdio:["ignore","pipe","pipe"]});}
 catch(error){const failure=error as {status?:number;signal?:string;stdout?:Buffer};if(command==="zbarimg"&&failure.status===4&&!failure.signal&&failure.stdout?.length===0)return Buffer.alloc(0);throw error;}
};
/** Private local rasterisation/QR decoding only; never follow QR content. Tools
 * must be present in the admitted isolated execution environment. Missing tools
 * are NOT_EXECUTED, not a decoded result. The injected adapter is contract-only. */
export async function decodeCertificateQr(pdf:Buffer,guard:()=>void,run:DecoderProcess=processDecoder){
 guard();assert(pdf.length>0&&pdf.length<=16*1024*1024&&pdf.subarray(0,5).toString()==="%PDF-","QR_PDF_BOUND");
 let pages:number;try{pages=(await PDFDocument.load(pdf)).getPageCount();}catch{throw Error("QR_PDF_INVALID");}
 assert(pages>=1&&pages<=4,"QR_PDF_PAGE_BOUND");
 const parent=tmpdir();assert(!lstatSync(parent).isSymbolicLink(),"QR_PRIVATE_ROOT_REFUSED");
 const root=mkdtempSync(path.join(parent,"nalanda-http-qr-"));
 const identity=lstatSync(root);const input=path.join(root,"certificate.pdf");
 try{
  writeFileSync(input,pdf,{mode:0o600,flag:"wx"});
  const references:string[]=[];
  for(let page=1;page<=pages;page++){
  const output=path.join(root,`page-${page}`);
  run("pdftoppm",["-f",String(page),"-l",String(page),"-scale-to","2048","-singlefile","-png",input,output]);
  const raster=output+".png",stat=lstatSync(raster);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<=16*1024*1024,"QR_RASTER_BOUND");
  assert(readFileSync(raster).subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),"QR_RASTER_FORMAT");
  const decoded=run("zbarimg",["--quiet","--raw","--set","disable","--set","qrcode.enable",raster]);
  assert(decoded.length<=128,"QR_DECODE_BOUND");
  // Exactly one terminal newline is permitted; multiple QR results fail closed.
  if(decoded.length)references.push(referenceToken(decoded.toString("utf8").replace(/\r?\n$/,"")));
  }
  assert(references.length===1,"QR_EXACTLY_ONE_REFERENCE_REQUIRED");guard();return references[0];
 }catch(error){
  if((error as NodeJS.ErrnoException).code==="ENOENT")throw Error("CERTIFICATE_QR_TOOLS_NOT_EXECUTED");
  throw Error("CERTIFICATE_QR_DECODE_FAILED_PRIVATE_DETAILS_WITHHELD");
 }finally{
  const current=lstatSync(root);assert(!current.isSymbolicLink()&&current.dev===identity.dev&&current.ino===identity.ino&&path.dirname(root)===parent,"QR_CLEANUP_OWNERSHIP_REFUSED");
  rmSync(root,{recursive:true});assert(!existsSync(root),"QR_PRIVATE_RESIDUE");
 }
}
