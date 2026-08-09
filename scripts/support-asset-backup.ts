import { randomBytes } from "node:crypto";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { prisma } from "../lib/prisma";
import { createAndVerifySupportAssetBackup } from "../lib/support-asset-backup";
async function main(){const root=path.resolve(process.env.SUPPORT_ASSET_BACKUP_ROOT?.trim()||path.join(process.cwd(),"backups","support-assets"));await mkdir(root,{recursive:true});const stamp=new Date().toISOString().replace(/[:.]/g,"-"),keyValue=process.env.SUPPORT_ASSET_BACKUP_KEY?.trim(),key=keyValue?Buffer.from(keyValue,"base64"):randomBytes(32);if(key.length!==32)throw new Error("SUPPORT_ASSET_BACKUP_KEY must be a base64 32-byte key.");const result=await createAndVerifySupportAssetBackup(prisma,{artifactPath:path.join(root,`support-assets-${stamp}.npsbackup`),key,keyVersion:process.env.SUPPORT_ASSET_BACKUP_KEY_VERSION?.trim()||"LOCAL-EPHEMERAL",restoreRoots:[path.join(root,`restore-a-${stamp}`),path.join(root,`restore-b-${stamp}`)]});console.log(JSON.stringify({result:"SUPPORT_ASSET_BACKUP_VERIFIED",attachmentCount:result.attachmentCount,artifactSha256:result.artifactSha256,restoresMatch:result.firstRestore.assetDigest===result.secondRestore.assetDigest,keyPersisted:false}));}
main().catch((error)=>{console.error(error instanceof Error?error.message:"Support asset backup failed");process.exitCode=1;}).finally(()=>prisma.$disconnect());
