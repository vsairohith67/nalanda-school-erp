import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const platform = process.argv[2];
const generatedRoot = resolve("apps/nalanda-cross-platform/src-tauri/gen");

function filesBelow(directory, name) {
  if (!existsSync(directory)) return [];
  const result = [];
  for (const entry of readdirSync(directory)) {
    const target = join(directory, entry);
    if (statSync(target).isDirectory()) result.push(...filesBelow(target, name));
    else if (entry === name) result.push(target);
  }
  return result;
}

if (platform === "android") {
  const manifest = join(generatedRoot, "android", "app", "src", "main", "AndroidManifest.xml");
  if (!existsSync(manifest)) throw new Error("Generated Android manifest was not found.");
  let text = readFileSync(manifest, "utf8");
  text = text.replace(/\sandroid:allowBackup="[^"]*"/g, "").replace(/\sandroid:fullBackupContent="[^"]*"/g, "").replace(/\sandroid:usesCleartextTraffic="[^"]*"/g, "");
  text = text.replace("<application", '<application android:allowBackup="false" android:fullBackupContent="false" android:usesCleartextTraffic="false"');
  if (!text.includes('android:allowBackup="false"') || !text.includes('android:usesCleartextTraffic="false"')) throw new Error("Android backup or cleartext hardening was not applied.");
  writeFileSync(manifest, text);
  const activities = filesBelow(join(generatedRoot, "android"), "MainActivity.kt");
  if (activities.length !== 1) throw new Error("Generated Android MainActivity was not found uniquely.");
  let activity = readFileSync(activities[0], "utf8");
  if (!activity.includes("FLAG_SECURE")) {
    if (!activity.includes("import android.os.Bundle")) activity = activity.replace(/(package[^\n]+\n)/, "$1\nimport android.os.Bundle\nimport android.view.WindowManager\n");
    activity = activity.replace(
      /class MainActivity\s*:\s*TauriActivity\(\)\s*\{?\s*\}?/,
      "class MainActivity : TauriActivity() {\n  override fun onCreate(savedInstanceState: Bundle?) {\n    super.onCreate(savedInstanceState)\n    window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)\n  }\n}"
    );
  }
  if (!activity.includes("WindowManager.LayoutParams.FLAG_SECURE")) throw new Error("Android sensitive-screen protection was not applied.");
  writeFileSync(activities[0], activity);
} else if (platform === "ios") {
  const candidates = filesBelow(join(generatedRoot, "apple"), "Info.plist");
  if (candidates.length < 1) throw new Error("Generated iOS Info.plist was not found.");
  for (const plist of candidates) {
    let text = readFileSync(plist, "utf8");
    if (!text.includes("UIFileSharingEnabled")) {
      text = text.replace("</dict>", "  <key>UIFileSharingEnabled</key>\n  <false/>\n  <key>LSSupportsOpeningDocumentsInPlace</key>\n  <false/>\n</dict>");
      writeFileSync(plist, text);
    }
  }
} else {
  throw new Error("Use android or ios.");
}

console.log(`Applied generated-project hardening for ${platform}.`);
