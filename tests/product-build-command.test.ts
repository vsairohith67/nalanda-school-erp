import {describe,expect,it} from "vitest";
import path from "node:path";
import {existsSync,mkdtempSync,rmSync} from "node:fs";
import os from "node:os";
import {rootlessBuildCommand} from "../scripts/portable/qa-rootless-build";
import {productionBuildCommand} from "../scripts/portable/rootless-build-command";
import type {ProducerIdentity} from "../scripts/portable/synthetic-build-lifecycle";

const identity:ProducerIdentity={source:"a".repeat(40),runId:"321",attempt:"2",architecture:"amd64"};
const frontend="docker/dockerfile:1.12@sha256:"+"b".repeat(64);
const work=path.resolve("tmp/HARNESS_ONLY_product_commands");

describe("HARNESS_ONLY future product command preparation; no qualified input or image",()=>{
 it.each(["amd64","arm64"] as const)("constructs a production-only OCI command for %s without executing it",architecture=>{
  const command=productionBuildCommand(work,{...identity,architecture},"123",frontend);
  expect(command.tool).toBe(path.join(work,"tools/buildkit/bin/buildctl"));
  expect(command.args).toContain(`unix://${path.join(work,"buildkit.sock")}`);
  expect(command.args).toContain(`context=${path.join(work,"context")}`);
  expect(command.args).toContain(`dockerfile=${path.join(work,"context")}`);
  expect(command.args).toContain("target=production-runtime");
  expect(command.args).toContain(`platform=linux/${architecture}`);
  expect(command.args).toContain(`build-arg:SOURCE_COMMIT=${identity.source}`);
  expect(command.args).toContain("build-arg:SOURCE_DATE_EPOCH=123");
  expect(command.args).toContain(`build-arg:BUILDKIT_SYNTAX=${frontend}`);
  expect(command.args).toContain(`type=oci,dest=${path.join(work,"product.oci.tar")}`);
  expect(command.args.slice(-2)).toEqual(["--metadata-file",path.join(work,"build-metadata.json")]);
  expect(command.args.join(" ")).not.toMatch(/synthetic|SYNTHETIC|qaon|--push|type=registry|cache-to|cache-from|--privileged|--no-process-sandbox/);
 });
 it("preserves the entire existing QA command through extraction",()=>{
  expect(rootlessBuildCommand(work,identity,"123","PUBLIC_TRUST_ONLY","c".repeat(64))).toEqual({
   stage:"build",tool:path.join(work,"tools/buildkit/bin/buildctl"),args:[
    "--addr",`unix://${path.join(work,"buildkit.sock")}`,"build","--frontend","dockerfile.v0",
    "--local",`context=${path.join(work,"context")}`,"--local",`dockerfile=${path.join(work,"context")}`,
    "--opt","target=synthetic-qa","--opt","platform=linux/amd64",
    "--opt",`build-arg:SOURCE_COMMIT=${identity.source}`,"--opt","build-arg:SOURCE_DATE_EPOCH=123",
    "--opt","build-arg:SYNTHETIC_BUILD_TRUST=PUBLIC_TRUST_ONLY","--opt","label:io.nalanda.qa-project=nalanda-ci-321-2-qaon",
    "--opt","label:io.nalanda.qa-run=321","--opt","label:io.nalanda.qa-attempt=2",
    "--opt",`label:io.nalanda.synthetic-trust-sha256=${"c".repeat(64)}`,
    "--output",`type=docker,dest=${path.join(work,"image.tar")}`,"--metadata-file",path.join(work,"build-metadata.json")
   ]});
 });
 it.each(["docker/dockerfile:1.12","docker/dockerfile:1.12@sha256:"+"x".repeat(64),"foreign/frontend:1@sha256:"+"b".repeat(64),frontend+"\n--push"])("refuses malformed/unpinned frontend %s",pin=>{
  expect(()=>productionBuildCommand(work,identity,"123",pin)).toThrow("PRODUCT_FRONTEND_PIN_REQUIRED");
 });
 it.each([{source:"HEAD"},{architecture:"x64"},{runId:"../foreign"},{attempt:""}])("refuses malformed build identity %j",change=>{
  expect(()=>productionBuildCommand(work,{...identity,...change} as ProducerIdentity,"123",frontend)).toThrow("PRODUCT_BUILD_IDENTITY_INVALID");
 });
 it("refuses ambiguous work paths and epoch without filesystem mutations",()=>{
  const parent=mkdtempSync(path.join(os.tmpdir(),"nps-product-command-harness-"));
  try{
   const absent=path.join(parent,"not-created");
   productionBuildCommand(absent,identity,"123",frontend);
   expect(existsSync(absent)).toBe(false);
   for(const input of ["relative",absent+",push=true",absent+"\n"])
    expect(()=>productionBuildCommand(input,identity,"123",frontend)).toThrow("PRODUCT_WORK_PATH_INVALID");
   expect(()=>productionBuildCommand(absent,identity,"unknown",frontend)).toThrow("PRODUCT_BUILD_IDENTITY_INVALID");
   expect(existsSync(absent)).toBe(false);
  }finally{rmSync(parent,{recursive:true});}
 });
});
