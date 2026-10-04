import assert from "node:assert/strict";
import { producerProcess } from "../../../../scripts/portable/producer-process";

export const appId = "com.nalandaps.erp";
export type UiNode = Record<string, string>;
export function nodes(xml: string): UiNode[] {
  assert(xml.length < 2_000_000 && xml.includes("<hierarchy"), "ANDROID_ACCESSIBILITY_TREE_INVALID");
  const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(m => Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(a => [a[1], decode(a[2])])));
}
export function center(node: UiNode) {
  const b = node.bounds?.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/);
  assert(b, "ANDROID_CONTROL_BOUNDS_INVALID");
  const [x, y, right, bottom] = b.slice(1).map(Number);
  assert(right > x && bottom > y, "ANDROID_CONTROL_NOT_VISIBLE");
  return [Math.floor((x + right) / 2), Math.floor((y + bottom) / 2)].map(String);
}
export function control(tree: UiNode[], label: string) {
  const matches = tree.filter(n => n.package === appId && (n.text === label || n["content-desc"] === label));
  const actionable = matches.filter(n => n.clickable === "true");
  assert.equal(actionable.length, 1, "ANDROID_CONTROL_NOT_UNIQUE");
  assert.equal(actionable[0].enabled, "true", "ANDROID_CONTROL_DISABLED");
  return actionable[0];
}
/** Actual ADB accessibility/input adapter. No WebView injection or invoke mock. */
export class Android {
  constructor(readonly adb: string, readonly serial: string, readonly workspace: string) {
    assert(/^emulator-\d{4,5}$/.test(serial), "ANDROID_DISPOSABLE_EMULATOR_REQUIRED");
  }
  run(args: string[]) { return producerProcess({ stage: "native-android", tool: this.adb, args: ["-s", this.serial, ...args], timeoutMs: 30_000 }, this.workspace); }
  async tree() {
    await this.run(["shell", "rm", "-f", "/sdcard/nalanda-native-1b.xml"]);
    await this.run(["shell", "uiautomator", "dump", "/sdcard/nalanda-native-1b.xml"]);
    return nodes(await this.run(["shell", "cat", "/sdcard/nalanda-native-1b.xml"]));
  }
  async wait(check: (tree: UiNode[]) => boolean) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      try { const tree = await this.tree(); if (check(tree)) return tree; } catch { /* retain deadline; no scenario success on setup failure */ }
      await new Promise(r => setTimeout(r, 500));
    }
    throw Error("ANDROID_EXPECTED_ACCESSIBILITY_STATE_NOT_READY");
  }
  has(tree: UiNode[], text: string) { return tree.some(n => n.package === appId && (n.text?.includes(text) || n["content-desc"]?.includes(text))); }
  async text(text: string) { return this.wait(t => this.has(t, text)); }
  async tap(label: string) {
    let tree=await this.tree();
    for(let i=0;i<4;i++) {
      try {const n=control(tree,label);await this.run(["shell","input","tap",...center(n)]);return;} catch(error) {
        if(i===3)throw error;
        // Scroll within this foreground app using the observed root bounds.
        const root=tree.find(n=>n.package===appId && n.class==="android.webkit.WebView"); assert(root,"ANDROID_APP_WEBVIEW_MISSING");
        const [x,y]=center(root).map(Number);const direction=i===2?-1:1; await this.run(["shell","input","swipe",String(x),String(Math.max(1,y+100*direction)),String(x),String(Math.max(1,y-150*direction)),"300"]);tree=await this.tree();
      }
    }
  }
  async input(value: string, password = false, label?: string) {
    assert(/^[\w %.-]{1,120}$/.test(value), "ANDROID_TEST_INPUT_INVALID");
    const tree = await this.tree();
    const fields = tree.filter(n => n.package === appId && n.class === "android.widget.EditText" && (password ? n.password === "true" : n.password !== "true") && (!label || n.text === label || n["content-desc"] === label || n.hint === label));
    assert.equal(fields.length, 1, "ANDROID_INPUT_NOT_UNIQUE");
    await this.run(["shell", "input", "tap", ...center(fields[0])]);
    await this.run(["shell", "input", "text", value.replaceAll(" ", "%s")]);
    await this.run(["shell", "input", "keyevent", "KEYCODE_BACK"]); // dismiss actual IME
  }
  async launch() {
    const result = await this.run(["shell", "am", "start", "-W", "-n", `${appId}/.MainActivity`]);
    assert(!/Error:|Exception/.test(result), "ANDROID_ACTIVITY_LAUNCH_REFUSED");
  }
  async locked() {
    const t = await this.text("Welcome back");
    for (const forbidden of ["April fee", "Science lab supplies", "Hall booking", "Recent drafts"]) assert(!this.has(t, forbidden), "ANDROID_LOCKED_CONTENT_LEAK");
    return t;
  }
  async unlock(pin: string) { await this.input(pin, true); await this.tap("Unlock app"); await this.text("Workspace"); await this.tap("Workspace"); await this.text("Recent drafts"); }
}

export async function journey(a: Android, pin: string, record: (id: string, action: () => Promise<void>) => Promise<void>) {
  await record("A-clean-launch", async () => { await a.launch(); await a.locked(); await a.text("NO REMOTE SERVER CONFIGURED"); await a.text("App 0.1.0"); });
  await record("B-invalid-pin", async () => {
    const t = await a.locked();
    assert(t.some(n => n.package === appId && (n.text === "Unlock app" || n["content-desc"] === "Unlock app") && n.enabled === "false"));
    await a.input("123", true);
    const invalid = await a.tree();
    assert(invalid.some(n => n.package === appId && (n.text === "Unlock app" || n["content-desc"] === "Unlock app") && n.enabled === "false"));
    await a.run(["shell", "am", "force-stop", appId]); await a.launch(); // empty PIN after real cold start
  });
  await record("C-local-vault-empty", async () => { await a.unlock(pin); await a.text("0 items"); await a.text("No remote server is configured."); });
  await record("F-remote-reference-draft-refusal", async () => {
    await a.tap("Security");
    const t = await a.text("No remote server configured");
    for (const label of ["No remote server configured", "Download encrypted reference data"]) assert(t.some(n => n.package === appId && (n.text === label || n["content-desc"] === label) && n.enabled === "false"));
    await a.tap("Workspace");
    // Use ordinary visible fields only; missing references must refuse this draft.
    await a.input("Synthetic purpose", false, "e.g. April fee · NPS-1042");
    await a.input("1.00", false, "0.00");
    await a.tap("Save encrypted draft");
    await a.text("Connect once and download current reference data before creating an offline draft."); await a.text("0 items");
  });
  await record("D-explicit-lock-and-os-background", async () => {
    await a.tap("Lock"); await a.locked(); await a.unlock(pin);
    await a.run(["shell", "input", "keyevent", "KEYCODE_HOME"]); await a.launch(); await a.locked(); await a.unlock(pin);
  });
  await record("E-cold-restart-wrong-pin", async () => {
    await a.run(["shell", "am", "force-stop", appId]); await a.launch(); await a.locked();
    await a.input(pin === "31415926" ? "27182818" : "31415926", true); await a.tap("Unlock app"); await a.text("App PIN was not accepted."); await a.locked();
    // Relaunch clears the typed field, not the genuine failed-attempt counter.
    await a.run(["shell", "am", "force-stop", appId]); await a.launch(); await a.unlock(pin);
  });
  await record("G-reset-cancel-confirm", async () => {
    await a.tap("Security"); await a.tap("Reset app data"); await a.tap("Cancel"); await a.text("Reset app data");
    await a.tap("Lock"); await a.locked(); await a.unlock(pin); // cancellation preserved the vault
    await a.tap("Security"); await a.tap("Reset app data"); await a.input("ERASE LOCAL DRAFTS"); await a.tap("Erase this app's local data"); await a.locked();
    const replacement=pin === "31415926" ? "27182818" : "31415926";
    await a.unlock(replacement); await a.text("0 items"); // unlock awaits the real reset barrier
    await a.run(["shell", "am", "force-stop", appId]); await a.launch(); await a.unlock(replacement); await a.text("0 items");
  });
  await record("H-platform-accessibility-layout",async()=>{
    await a.tap("Lock");await a.locked();
    const keys=[["system","accelerometer_rotation"],["system","user_rotation"],["system","font_scale"]];
    const original=await Promise.all(keys.map(k=>a.run(["shell","settings","get",...k])));
    try {
      await a.run(["shell","settings","put","system","accelerometer_rotation","0"]);
      await a.run(["shell","settings","put","system","user_rotation","1"]);await a.locked();
      await a.run(["shell","settings","put","system","font_scale","1.3"]);
      assert((await a.run(["shell","settings","get","system","font_scale"])).trim()==="1.3");await a.locked();
      const field=(await a.tree()).find(n=>n.package===appId&&n.password==="true");assert(field);
      await a.run(["shell","input","tap",...center(field)]);
      const ime=await a.run(["shell","dumpsys","input_method"]);assert(/mInputShown=true|mIsInputViewShown=true/.test(ime),"ANDROID_SOFTWARE_KEYBOARD_NOT_SHOWN");
      await a.run(["shell","input","keyevent","KEYCODE_BACK"]);await a.locked();
      await a.run(["shell","input","keyevent","KEYCODE_BACK"]);await a.launch();await a.locked();
    } finally {
      for(let i=0;i<keys.length;i++) {
        const v=original[i].trim();assert(v==="null"||/^[\d.]+$/.test(v),"ANDROID_ORIGINAL_SETTING_INVALID");
        await a.run(v==="null"?["shell","settings","delete",...keys[i]]:["shell","settings","put",...keys[i],v]);
        assert((await a.run(["shell","settings","get",...keys[i]])).trim()===v,"ANDROID_SETTING_RESTORE_FAILED");
      }
    }
  });
}
