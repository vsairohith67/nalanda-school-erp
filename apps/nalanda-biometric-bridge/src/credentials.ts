import { generateKeyPairSync } from "node:crypto";
import { chmodSync, writeFileSync } from "node:fs";
import path from "node:path";
const target=path.resolve(process.argv[2]??"bridge-private.jwk");const {privateKey,publicKey}=generateKeyPairSync("ed25519");writeFileSync(target,JSON.stringify(privateKey.export({format:"jwk"})),{encoding:"utf8",flag:"wx",mode:0o600});chmodSync(target,0o600);process.stdout.write(`${JSON.stringify({privateKeyPath:target,publicSigningKey:publicKey.export({format:"jwk"})},null,2)}\n`);
