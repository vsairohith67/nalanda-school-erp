import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readSupportFile, resolveSupportStorageKey, storeSupportFile, validateSupportUpload } from "@/lib/support-files";
let root="";const original=process.env.SUPPORT_PRIVATE_STORAGE_ROOT;
beforeEach(async()=>{root=await mkdtemp(path.join(os.tmpdir(),"support1a-files-"));process.env.SUPPORT_PRIVATE_STORAGE_ROOT=root;});
afterEach(async()=>{if(original===undefined)delete process.env.SUPPORT_PRIVATE_STORAGE_ROOT;else process.env.SUPPORT_PRIVATE_STORAGE_ROOT=original;await rm(root,{recursive:true,force:true});});
describe("SUPPORT-1A private attachment boundary",()=>{
  it("normalises metadata-free still images into opaque private storage",async()=>{const source=await sharp({create:{width:24,height:24,channels:4,background:"#336699"}}).png().withExif({IFD0:{ImageDescription:"SUPPORT1A"}}).toBuffer(),file={name:"SUPPORT1A screenshot.png",type:"image/png",size:source.length,arrayBuffer:async()=>Uint8Array.from(source).buffer} as File,validated=await validateSupportUpload(file,"PUBLIC"),key=await storeSupportFile(validated),stored=await readFile(resolveSupportStorageKey(key));expect(key).toMatch(/^[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9-]{36}\.png$/);expect(stored.includes(Buffer.from("SUPPORT1A"))).toBe(false);expect(await readSupportFile(key,validated.sha256)).toEqual(stored);});
  it("rejects public PDFs, active file classes, MIME mismatch, animation and traversal",async()=>{const fake=(name:string,type:string,bytes:Buffer)=>({name,type,size:bytes.length,arrayBuffer:async()=>Uint8Array.from(bytes).buffer}) as File;await expect(validateSupportUpload(fake("sample.pdf","application/pdf",Buffer.from("%PDF-1.4\n%%EOF")),"PUBLIC")).rejects.toThrow(/PNG, JPEG, or still WebP/);await expect(validateSupportUpload(fake("x.svg","image/svg+xml",Buffer.from("<svg/>")),"PUBLIC")).rejects.toThrow();const png=await sharp({create:{width:2,height:2,channels:3,background:"white"}}).png().toBuffer();await expect(validateSupportUpload(fake("x.jpg","image/jpeg",png),"PUBLIC")).rejects.toThrow(/does not match/);expect(()=>resolveSupportStorageKey("../escape.png")).toThrow();});
});
