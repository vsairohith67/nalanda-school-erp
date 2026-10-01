// HARNESS_ONLY: inject a Node child timeout/failure at the process boundary.
// This is not an OpenSSL timeout reproduction or an application admission result.
import {execFileSync} from "node:child_process";
import {mkdtempSync,writeFileSync,lstatSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {OpenSslFixture,validateOpenSslMetadata} from "../helpers/openssl-fixture";
const root=mkdtempSync(path.join(tmpdir(),"nalanda-native-inventory-contract-"));
const fixture=new OpenSslFixture(root),mode=process.env.OPENSSL_CHILD_MODE;
try{
 fixture.generate((()=>{
  const code=`require('fs').writeFileSync(process.argv[1],Buffer.alloc(40,120));process.stderr.write('PRIVATE_TOKEN_'+require('crypto').randomBytes(20).toString('hex'));`+(mode==="timeout"?"setTimeout(()=>{},10000);":"process.exit(7);");
  return execFileSync(process.execPath,["-e",code,path.join(root,"ca-key.pem")],{stdio:"pipe",timeout:mode==="timeout"?500:2000});
 }));
 throw Error("HARNESS_CHILD_UNEXPECTED_SUCCESS");
}catch{process.exitCode=1;}
finally{
 fixture.cleanup();validateOpenSslMetadata(fixture.record);
 const file=process.env.OPENSSL_CHILD_FILE!;const parent=lstatSync(path.dirname(file));if(!parent.isDirectory()||parent.isSymbolicLink())throw Error("HARNESS_CHILD_OWNER_INVALID");
 writeFileSync(file,JSON.stringify(fixture.record)+"\n",{flag:"wx",mode:0o600});
}
