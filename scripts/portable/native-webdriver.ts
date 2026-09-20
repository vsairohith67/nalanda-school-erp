import assert from "node:assert/strict";

const elementKey="element-6066-11e4-a52e-4f735466cecf";
/** Direct W3C transport: tauri-driver/EdgeDriver on Windows; Appium
 * UiAutomator2/XCUITest on Android/iOS. It adds no app IPC or TLS privileges. */
export class NativeWebDriver {
 constructor(readonly endpoint:string,readonly session:string,private readonly transport:typeof fetch=fetch){
  const url=new URL(endpoint);assert.equal(url.protocol,"http:");assert(["127.0.0.1","[::1]"].includes(url.hostname));assert(!url.username&&!url.password&&!url.search&&!url.hash);assert(/^[a-zA-Z0-9-]{8,80}$/.test(session));
 }
 async command(method:string,route:string,body?:unknown){
  assert(/^\/[a-zA-Z0-9_/-]*$/.test(route));
  const r=await this.transport(`${this.endpoint.replace(/\/$/,"")}/session/${this.session}${route}`,{method,headers:{"content-type":"application/json"},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30_000),redirect:"error"});
  const result=await r.json();if(!r.ok||result.value?.error)throw Error("NATIVE_AUTOMATION_COMMAND_FAILED");return result.value;
 }
 async element(using:"css selector"|"xpath",value:string){const e=await this.command("POST","/element",{using,value});assert(typeof e?.[elementKey]==="string");return e[elementKey] as string;}
 async clickText(text:string){assert(!text.includes("'"));const e=await this.element("xpath",`//button[normalize-space(.)='${text}']`);await this.command("POST",`/element/${e}/click`,{});}
 async fill(css:string,text:string){const e=await this.element("css selector",css);await this.command("POST",`/element/${e}/clear`,{});await this.command("POST",`/element/${e}/value`,{text});}
 async body(){const e=await this.element("css selector","body");return await this.command("GET",`/element/${e}/text`) as string;}
 async waitText(text:string){for(let i=0;i<30;i++){if((await this.body()).includes(text))return;await new Promise(r=>setTimeout(r,500));}throw Error("NATIVE_EXPECTED_STATE_MISSING");}
 async select(label:string,value:string){assert(!label.includes("'")&&!value.includes("'"));const e=await this.element("xpath",`//label[contains(.,'${label}')]/select/option[@value='${value}']`);await this.command("POST",`/element/${e}/click`,{});}
 async switchMobileWebview(expected:string){const contexts=await this.command("GET","/contexts");assert(Array.isArray(contexts)&&contexts.filter(c=>c===expected).length===1&&expected.startsWith("WEBVIEW"));await this.command("POST","/context",{name:expected});}
}

export async function unlockAndRequestAuthorization(driver:NativeWebDriver,input:{platform:"WINDOWS"|"ANDROID"|"IOS";pin:string;appContext?:string}){
 assert(/^\d{8,12}$/.test(input.pin));
 if(input.platform!=="WINDOWS"){assert(input.appContext);await driver.switchMobileWebview(input.appContext);}
 await driver.waitText("Unlock local encrypted drafts. This does not sign you into the school server.");
 await driver.fill('input[type="password"][autocomplete="off"]',input.pin);await driver.clickText("Unlock app");
 await driver.waitText("Workspace");await driver.clickText("Security");
 assert(!(await driver.body()).includes("No remote server configured"),"QUALIFIED_PRIVATE_NATIVE_PROFILE_REQUIRED");
 await driver.clickText("Connect through system browser");
 return {classification:"NATIVE_UNLOCK_AND_REAL_AUTH_REQUEST",authenticated:false};
}

/** Run in the actual system browser's owned automation context after the app
 * opened its signed PKCE link. Never supplies a callback/code or a session cookie. */
export async function authenticateNativeBrowser(driver:NativeWebDriver,input:{username:string;password:string;totp:()=>Promise<string>;authorizationUrl:string}){
 const url=new URL(input.authorizationUrl);assert.equal(url.origin,"https://portable-staging.localhost:8443");assert.equal(url.pathname,"/native/authorize");
 for(const key of ["request","state","challenge","proof"])assert(url.searchParams.get(key));
 await driver.command("POST","/url",{url:url.origin+"/login"});
 await driver.fill('input[name="identifier"]',input.username);await driver.fill('input[name="password"]',input.password);await driver.clickText("Sign in");
 await driver.waitText("Six-digit authenticator code");await driver.fill('input[name="mfaResponse"]',await input.totp());await driver.clickText("Verify and sign in");
 // The original unmodified app-generated link carries the signed request.
 await driver.command("POST","/url",{url:url.toString()});await driver.waitText("Connect this ERP app?");await driver.clickText("Confirm this device");
}

export async function assertAuthenticatedReferenceAndLock(driver:NativeWebDriver,input:{platform:"WINDOWS"|"ANDROID"|"IOS";appContext?:string;expectedStudent:string;pin:string}){
 if(input.platform!=="WINDOWS"){assert(input.appContext);await driver.switchMobileWebview(input.appContext);}
 // Opening the system browser intentionally hides and locks the vault. The
 // deep link is processed only after the user unlocks it again.
 if((await driver.body()).includes("Welcome back")){
  assert(/^\d{8,12}$/.test(input.pin));await driver.fill('input[type="password"][autocomplete="off"]',input.pin);await driver.clickText("Unlock app");
 }
 await driver.clickText("Security");await driver.waitText("compatibility READY");
 await driver.clickText("Refresh encrypted reference data");await driver.waitText("Current server reference data is encrypted on this device and ready for offline drafts.");await driver.clickText("Workspace");
 const student=await driver.element("xpath",`//label[contains(.,'Student reference')]/select/option[@value='${input.expectedStudent}']`);assert(student);
 const lock=await driver.element("css selector",".top-actions button.secondary");await driver.command("POST",`/element/${lock}/click`,{});await driver.waitText("Welcome back");
 assert(!(await driver.body()).includes(input.expectedStudent),"LOCKED_PRIVATE_DATA_VISIBLE");
 return {classification:"NATIVE_AUTHENTICATED_REFERENCE_AND_SECURE_LOCK",physicalDeviceCertification:false};
}

export async function createNativeDrafts(driver:NativeWebDriver,input:{studentAdmission:string;studentId:string;vendorId:string;categoryId:string;departmentId:string;itemId:string;academicYear:string}){
 assert(/^\d{4}-\d{2}$/.test(input.academicYear));
 for(const type of ["FEE_PAYMENT","EXPENSE_DRAFT","MISC_INCOME"]){
  await driver.select("Draft type",type);
  if(type==="FEE_PAYMENT")await driver.select("Student reference",input.studentAdmission);
  if(type==="EXPENSE_DRAFT"){await driver.select("Vendor",input.vendorId);await driver.select("Category",input.categoryId);await driver.select("Department",input.departmentId);}
  if(type==="MISC_INCOME"){await driver.select("Income item",input.itemId);await driver.select("Student (optional)",input.studentId);}
  await driver.fill('input[maxlength="120"]',`SYNTHETIC ${type}`);await driver.fill('input[inputmode="decimal"]',"10.00");
  if(type!=="FEE_PAYMENT")await driver.fill('input[maxlength="7"]',input.academicYear);
  await driver.clickText("Save encrypted draft");await driver.waitText("Draft saved locally. It is not a receipt or server-posted transaction.");
 }
 return {classification:"NATIVE_DRAFT_UI_ACTIONS",serverPostingProven:false};
}
