import assert from "node:assert/strict";
import type {Page} from "playwright";
import {assertSyntheticServingTarget,syntheticOrigin} from "../scripts/portable/acceptance-http";
import type {Report} from "../lib/intelligent-reports/service";

/** Real rendered UI acceptance driver. No server, login shortcut, route mocking,
 * fixture copying, browser storage injection or runtime admission is provided.
 * An admitted exact-head CI harness must supply independently authenticated pages
 * and fixture expectations. NOT_EXECUTED while EXTERNAL_RUNTIME_BLOCKED remains.
 */
export async function intelligentReportsBrowser(input:{page:Page;deniedPage:Page;year:string;classLabel:string;examLabel:string;from:string;to:string;expected:Record<"ACADEMIC"|"ATTENDANCE"|"FEES",Report["summary"]>}) {
  assertSyntheticServingTarget();
  const {page,deniedPage}=input;
  await deniedPage.goto(syntheticOrigin+"/intelligent-reports");
  assert.equal(await deniedPage.getByRole("button",{name:"Run report",exact:true}).count(),0);
  for(const viewport of [{width:1280,height:900},{width:820,height:1180},{width:390,height:844}]) {
    await page.setViewportSize(viewport);
    await page.emulateMedia({reducedMotion:"reduce"});
    await page.goto(syntheticOrigin+"/intelligent-reports");
    await page.getByRole("heading",{name:"Ask Nalanda",exact:true}).waitFor();
    for(const [family,label] of [["ACADEMIC","Academic support"],["ATTENDANCE","Student attendance"],["FEES","Term fee outstanding"]] as const) {
      await page.getByRole("button",{name:label,exact:true}).click();
      await page.getByLabel("Academic year",{exact:true}).selectOption(input.year);
      await page.getByRole("checkbox",{name:input.classLabel,exact:true}).check();
      if(family==="ACADEMIC")await page.getByLabel(`Examination for ${input.classLabel}`,{exact:true}).selectOption({label:input.examLabel});
      if(family==="ATTENDANCE"){await page.getByLabel("From",{exact:true}).fill(input.from);await page.getByLabel("To",{exact:true}).fill(input.to);}
      await page.getByRole("button",{name:"Review structured filters",exact:true}).click();
      const response=page.waitForResponse(r=>r.url()===syntheticOrigin+"/api/intelligent-reports/run"&&r.request().method()==="POST");
      await page.getByRole("button",{name:"Run report",exact:true}).click();
      const result=await response;assert.equal(result.status(),200);const report=await result.json() as Report;assert.deepEqual(report.summary,input.expected[family]);
      await page.getByRole("heading",{name:"Report results",exact:true}).waitFor();
      assert(await page.getByRole("heading",{name:"Report results",exact:true}).evaluate(e=>e===document.activeElement));
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"PAGE_HORIZONTAL_OVERFLOW");
      if(report.rows.length){
        await page.getByRole("button",{name:"Details",exact:true}).first().click();await page.getByRole("dialog").waitFor();
        await page.keyboard.press("Escape");assert.equal(await page.getByRole("dialog").count(),0);
        assert(await page.getByRole("button",{name:"Details",exact:true}).first().evaluate(e=>e===document.activeElement));
      }
      // Every protected request uses the real service. Rate budget is 6/minute;
      // the harness runs each family in a fresh admitted actor context or waits.
      if(family==="ACADEMIC"&&viewport.width===1280){
        const downloadPromise=page.waitForEvent("download");await page.getByRole("button",{name:"Export authorised CSV",exact:true}).click();const download=await downloadPromise;assert.equal(await download.failure(),null);assert.match(download.suggestedFilename(),/^nalanda-academic-\d{4}-\d{2}\.csv$/);
      }
      await page.getByRole("button",{name:"Reset",exact:true}).click();assert.equal(await page.getByRole("button",{name:"Export authorised CSV",exact:true}).count(),0);
      // The shared server limit is intentionally respected in this acceptance driver.
      await page.waitForTimeout(61000);
    }
  }
}
