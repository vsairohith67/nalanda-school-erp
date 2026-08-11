import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const execFileAsync = promisify(execFile);

export type MonochromePixelInspection = {
  page: number;
  width: number;
  height: number;
  tolerance: number;
  chromaticPixels: number;
  maximumChannelDifference: number;
};

export function inspectRgbPixels(
  pixels: Uint8Array,
  channels: number,
  tolerance = 2
) {
  if (channels < 3) throw new Error("Rendered monochrome inspection requires RGB pixels.");
  let chromaticPixels = 0;
  let maximumChannelDifference = 0;
  for (let offset = 0; offset < pixels.length; offset += channels) {
    const red = pixels[offset];
    const green = pixels[offset + 1];
    const blue = pixels[offset + 2];
    const difference = Math.max(red, green, blue) - Math.min(red, green, blue);
    maximumChannelDifference = Math.max(maximumChannelDifference, difference);
    if (difference > tolerance) chromaticPixels += 1;
  }
  return { chromaticPixels, maximumChannelDifference };
}

export async function inspectRenderedPdfPagesMonochrome(
  pdf: Buffer,
  pages: number[],
  tolerance = 2
): Promise<MonochromePixelInspection[]> {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "nalanda-r41-mono-"));
  try {
    const pdfPath = path.join(temporaryRoot, "synthetic-review.pdf");
    await writeFile(pdfPath, pdf);
    const inspections: MonochromePixelInspection[] = [];
    for (const page of pages) {
      const prefix = path.join(temporaryRoot, "page-" + page);
      const executable = await resolvePdfToPpmExecutable();
      await execFileAsync(executable, [
        "-f", String(page),
        "-l", String(page),
        "-r", "120",
        "-png",
        "-singlefile",
        pdfPath,
        prefix
      ], {
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024
      });
      const raster = await readFile(prefix + ".png");
      const rendered = await sharp(raster).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const pixelResult = inspectRgbPixels(rendered.data, rendered.info.channels, tolerance);
      inspections.push({
        page,
        width: rendered.info.width,
        height: rendered.info.height,
        tolerance,
        ...pixelResult
      });
    }
    return inspections;
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

export async function requireRenderedPdfPagesMonochrome(
  pdf: Buffer,
  pages: number[],
  tolerance = 2
) {
  const inspections = await inspectRenderedPdfPagesMonochrome(pdf, pages, tolerance);
  const failures = inspections.filter((inspection) => inspection.chromaticPixels > 0);
  if (failures.length) {
    throw new Error("Meaningful chromatic pixels remain on monochrome PDF pages: " + failures.map((item) => item.page).join(", "));
  }
  return inspections;
}

async function resolvePdfToPpmExecutable() {
  if (process.platform !== "win32") return "pdftoppm";
  const { stdout } = await execFileAsync("where.exe", ["pdftoppm.cmd"], { windowsHide: true });
  const wrapper = stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  if (!wrapper) throw new Error("pdftoppm.cmd is required for rendered monochrome validation.");
  return path.resolve(path.dirname(wrapper), "..", "..", "native", "poppler", "Library", "bin", "pdftoppm.exe");
}
