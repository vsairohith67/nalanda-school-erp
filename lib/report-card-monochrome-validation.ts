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

export type PatternSwatchBox = {
  series: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PatternSwatchRobustness = {
  page: number;
  blurSigma: number;
  threshold: number;
  maximumPairSimilarity: number;
  pairs: Array<{ left: string; right: string; similarity: number }>;
};

export const R5_WHITE_BACKGROUND_SAMPLE_POINTS = [
  { name: "bottom-left-canvas", x: 5, y: 5 },
  { name: "bottom-right-canvas", x: 590, y: 5 },
  { name: "top-left-canvas", x: 5, y: 837 },
  { name: "top-right-canvas", x: 590, y: 837 },
  { name: "left-unused-margin", x: 12, y: 421 },
  { name: "right-unused-margin", x: 583, y: 421 },
  { name: "signature-clear-area", x: 297, y: 92 }
] as const;

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

export async function requireRenderedPdfWhiteBackground(
  pdf: Buffer,
  pages: number[],
  samplePoints: ReadonlyArray<{ name: string; x: number; y: number }> = R5_WHITE_BACKGROUND_SAMPLE_POINTS,
  tolerance = 2
) {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "nalanda-r5-white-"));
  try {
    const pdfPath = path.join(temporaryRoot, "synthetic-review.pdf");
    await writeFile(pdfPath, pdf);
    const executable = await resolvePdfToPpmExecutable();
    const results: Array<{ page: number; samples: Array<{ name: string; red: number; green: number; blue: number }> }> = [];
    for (const page of pages) {
      const prefix = path.join(temporaryRoot, "page-" + page);
      await execFileAsync(executable, [
        "-f", String(page), "-l", String(page), "-r", "120", "-png", "-singlefile", pdfPath, prefix
      ], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
      const rendered = await sharp(await readFile(prefix + ".png")).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const samples = samplePoints.map((point) => {
        const pixelX = Math.max(0, Math.min(rendered.info.width - 1, Math.round(point.x / 595.28 * (rendered.info.width - 1))));
        const pixelY = Math.max(0, Math.min(rendered.info.height - 1, Math.round((841.89 - point.y) / 841.89 * (rendered.info.height - 1))));
        const offset = (pixelY * rendered.info.width + pixelX) * rendered.info.channels;
        const sample = {
          name: point.name,
          red: rendered.data[offset],
          green: rendered.data[offset + 1],
          blue: rendered.data[offset + 2]
        };
        const channelDifference = Math.max(sample.red, sample.green, sample.blue) - Math.min(sample.red, sample.green, sample.blue);
        if (Math.min(sample.red, sample.green, sample.blue) < 255 - tolerance || channelDifference > tolerance) {
          throw new Error(`R5 page ${page} background sample ${point.name} is not pure white.`);
        }
        return sample;
      });
      results.push({ page, samples });
    }
    return results;
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

export async function inspectRenderedPatternSwatchRobustness(
  pdf: Buffer,
  page: number,
  boxes: readonly PatternSwatchBox[],
  approvedVisualConfusionThreshold = 0.75
): Promise<PatternSwatchRobustness> {
  if (boxes.length < 3) throw new Error("Photocopy pattern validation requires three rendered swatches.");
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "nalanda-r5-pattern-"));
  const blurSigma = 0.8;
  const threshold = 190;
  try {
    const pdfPath = path.join(temporaryRoot, "synthetic-pattern-review.pdf");
    const prefix = path.join(temporaryRoot, "page");
    await writeFile(pdfPath, pdf);
    const executable = await resolvePdfToPpmExecutable();
    await execFileAsync(executable, [
      "-f", String(page), "-l", String(page), "-r", "240", "-png", "-singlefile", pdfPath, prefix
    ], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    const raster = await readFile(prefix + ".png");
    const metadata = await sharp(raster).metadata();
    if (!metadata.width || !metadata.height) throw new Error("Rendered pattern page has no raster dimensions.");
    const masks: Array<{ series: string; data: Uint8Array }> = [];
    for (const box of boxes) {
      const insetPt = 1.6;
      const left = Math.max(0, Math.round((box.x + insetPt) / 595.28 * metadata.width));
      const top = Math.max(0, Math.round((841.89 - (box.y + box.height - insetPt)) / 841.89 * metadata.height));
      const width = Math.max(1, Math.round((box.width - insetPt * 2) / 595.28 * metadata.width));
      const height = Math.max(1, Math.round((box.height - insetPt * 2) / 841.89 * metadata.height));
      const rendered = await sharp(raster)
        .extract({
          left: Math.min(left, metadata.width - 1),
          top: Math.min(top, metadata.height - 1),
          width: Math.min(width, metadata.width - left),
          height: Math.min(height, metadata.height - top)
        })
        .resize(160, 56, { fit: "fill" })
        .grayscale()
        .blur(blurSigma)
        .threshold(threshold)
        .raw()
        .toBuffer();
      masks.push({ series: box.series, data: rendered });
    }
    const pairs: PatternSwatchRobustness["pairs"] = [];
    masks.forEach((left, leftIndex) => masks.slice(leftIndex + 1).forEach((right) => {
      let intersection = 0;
      let union = 0;
      for (let index = 0; index < left.data.length; index += 1) {
        const leftDark = left.data[index] < 128;
        const rightDark = right.data[index] < 128;
        if (leftDark || rightDark) union += 1;
        if (leftDark && rightDark) intersection += 1;
      }
      if (!union) throw new Error("Photocopy simulation removed all monochrome pattern detail.");
      pairs.push({
        left: left.series,
        right: right.series,
        similarity: intersection / union
      });
    }));
    const maximumPairSimilarity = Math.max(...pairs.map((pair) => pair.similarity));
    if (maximumPairSimilarity >= approvedVisualConfusionThreshold) {
      throw new Error(`Rendered monochrome patterns exceed the approved visual-confusion threshold (${maximumPairSimilarity.toFixed(3)} >= ${approvedVisualConfusionThreshold.toFixed(3)}).`);
    }
    return { page, blurSigma, threshold, maximumPairSimilarity, pairs };
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function resolvePdfToPpmExecutable() {
  if (process.platform !== "win32") return "pdftoppm";
  const { stdout } = await execFileAsync("where.exe", ["pdftoppm.cmd"], { windowsHide: true });
  const wrapper = stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  if (!wrapper) throw new Error("pdftoppm.cmd is required for rendered monochrome validation.");
  return path.resolve(path.dirname(wrapper), "..", "..", "native", "poppler", "Library", "bin", "pdftoppm.exe");
}
