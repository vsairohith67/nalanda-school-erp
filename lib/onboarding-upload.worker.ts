import { parseOnboardingWorkbook } from "@/lib/onboarding-workbooks";
import { canonicalOnboardingPackage } from "@/lib/onboarding-canonical-package";
import type { OnboardingBundle } from "@/lib/onboarding-types";
self.onmessage = async ({ data }: MessageEvent<{ file: File; bundle: OnboardingBundle }>) => {
  try {
    if (data.file.name.length > 180 || !data.file.name.toLowerCase().endsWith(".xlsx") || data.file.size > 5 * 1024 * 1024 || !data.file.size) throw new Error();
    const parsed = parseOnboardingWorkbook(new Uint8Array(await data.file.arrayBuffer()), data.bundle);
    const bytes = canonicalOnboardingPackage(parsed, data.bundle);
    self.postMessage({ bytes });
  } catch { self.postMessage({ error: "Workbook refused locally. Use the selected controlled XLSX template within 5 MB; remove unknown columns, hidden content, formulas and links." }); }
};
