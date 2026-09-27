import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
// Source connection evidence supplements executable controller/storage/auth
// races. It is explicitly not a rendered component or Windows execution test.
describe("reference lifecycle App connection contract",()=>{
 const source=readFileSync("apps/nalanda-cross-platform/src/App.tsx","utf8");
 const section=(a:string,b:string)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
 it("blocks new refresh work before reset drains and masks the app",()=>{
  const reset=section("async function wipeLocalData", "if (locked) return");
  expect(reset.indexOf("referenceSuspended.current = true")).toBeLessThan(reset.indexOf("refreshController.current.drain()"));
  expect(reset.indexOf("setLocked(true)")).toBeLessThan(reset.indexOf("refreshController.current.drain()"));
  expect(reset.indexOf("refreshController.current.drain()")).toBeLessThan(reset.indexOf("vault.wipe()"));expect(reset).toContain("lockPending.current = pending");
  const refresh=section("async function refreshReferenceData", "async function stageSync");
  expect(refresh).toContain('if (referenceSuspended.current) throw Error("REFERENCE_REFRESH_CANCELLED")');
  expect(refresh).toContain("current(); bindingGuard();");expect(refresh).toContain("nativeCredentialGeneration(vault)");
 });
 it("clears prior account references before refresh and guards connection after drain",()=>{
  const callback=section("listenForNativeAuthorization(vault", "const backgroundLock");
  expect(callback.indexOf("setReferencePack(null)")).toBeLessThan(callback.indexOf("refreshReferenceData(nextTokens"));
  const connect=section("async function connectNative", "async function wipeLocalData");
  expect(connect.indexOf("if (generation !== vaultGeneration.current)")).toBeGreaterThan(connect.indexOf("refreshController.current.drain()"));
  expect(connect.indexOf("if (generation !== vaultGeneration.current)")).toBeLessThan(connect.indexOf("startNativeAuthorization"));
  expect(source).toContain('data-reference-refresh={JSON.stringify(refreshState)}');
 });
 it("preserves existing currency and school UI text encoding",()=>{
  expect(source).toContain("Amount (₹)");expect(source).toContain("April fee ·");expect(source).not.toMatch(/[ÃÂ]/);
 });
});
