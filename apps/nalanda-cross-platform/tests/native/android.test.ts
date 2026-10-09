import { expect, it } from "vitest";
import { appId, center, control, nodes } from "./android";
// SOURCE_ONLY: XML/transport boundary tests, never emulator evidence.
it("selects only the intended package's unique enabled action and real bounds", () => {
  const t = nodes(`<hierarchy><node package="${appId}" text="Unlock app" clickable="true" enabled="true" bounds="[20,30][100,70]"/><node package="other.app" text="Unlock app" clickable="true" enabled="true" bounds="[0,0][1,1]"/></hierarchy>`);
  expect(center(control(t, "Unlock app"))).toEqual(["60", "50"]);
  expect(() => control([...t, t[0]], "Unlock app")).toThrow("ANDROID_CONTROL_NOT_UNIQUE");
  expect(() => control([{ ...t[0], enabled: "false" }], "Unlock app")).toThrow("ANDROID_CONTROL_DISABLED");
  expect(() => center({bounds:"[0,0][0,1]"})).toThrow("ANDROID_CONTROL_NOT_VISIBLE");
});
it("refuses absent/stale hierarchy and decodes accessible labels", () => {
  expect(() => nodes("old plain output")).toThrow("ANDROID_ACCESSIBILITY_TREE_INVALID");
  expect(nodes('<hierarchy><node text="Security &amp; device"/></hierarchy>')[0].text).toBe("Security & device");
});
