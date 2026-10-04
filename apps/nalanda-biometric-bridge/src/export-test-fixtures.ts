import { readFileSync } from "node:fs";
import type { ExportProfile } from "./export-profile.js";
export const id="00000000-0000-4000-8000-000000000002";
export function profile():ExportProfile { return JSON.parse(readFileSync(new URL("../export.config.synthetic.example.json",import.meta.url),"utf8")).devices[0].exportInput.profile; }
export function bytes(rows=["0007,2026-10-02 09:00:00,SYN-LOCAL-01,IN"],p=profile()) { return Buffer.from((p.header?p.columns.join(p.separator)+"\r\n":"")+rows.join("\r\n")+"\r\n"); }
