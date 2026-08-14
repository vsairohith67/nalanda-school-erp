import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const execFileAsync = promisify(execFile);
const root = path.resolve(process.cwd(), ".codex", "report-print-accept-1a", "r8");
const inspectionRoot = path.join(root, "inspection-300dpi");
const packs = [
  { key: "review", file: path.join(root, "FINAL-DIGITAL-REVIEW-R8.pdf"), detail: false, monochromePages: new Set([2, 4, 6, 8]) },
  { key: "detail", file: path.join(root, "R8-DETAIL-CHECKS.pdf"), detail: true, monochromePages: new Set<number>() },
  { key: "physical-colour", file: path.join(root, "final-print-pack", "PHYSICAL-ACCEPTANCE-CLASSES-I-X-COLOUR.pdf"), detail: false, monochromePages: new Set<number>() },
  { key: "physical-monochrome", file: path.join(root, "final-print-pack", "PHYSICAL-ACCEPTANCE-CLASSES-I-X-MONOCHROME.pdf"), detail: false, monochromePages: new Set([1, 2, 3, 4, 5, 6, 7, 8]) }
] as const;

async function main() {
  await mkdir(inspectionRoot, { recursive: true });
  const executable = await resolvePdfToPpmExecutable();
  const inspections: Array<Record<string, unknown>> = [];
  for (const pack of packs) {
    const packRoot = path.join(inspectionRoot, pack.key);
    await mkdir(packRoot, { recursive: true });
    const prefix = path.join(packRoot, "page");
    await execFileAsync(executable, ["-r", "300", "-png", pack.file, prefix], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    const pageFiles = (await readdir(packRoot)).filter((file) => file.endsWith(".png")).sort(naturalPageSort);
    const contactInputs: Buffer[] = [];
    for (const [index, file] of pageFiles.entries()) {
      const page = index + 1;
      const bytes = await readFile(path.join(packRoot, file));
      const rendered = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const metrics = inspectRaster(rendered.data, rendered.info.width, rendered.info.height, rendered.info.channels);
      if (metrics.outerEdgeDarkPixels > 0) throw new Error(`${pack.key} page ${page} has ink in the governed outer 2 mm clipping band.`);
      if (metrics.darkPixelRatio < 0.003) throw new Error(`${pack.key} page ${page} is blank or nearly blank.`);
      if (pack.detail && (metrics.boundingWidthRatio < 0.75 || metrics.boundingHeightRatio < 0.6)) {
        throw new Error(`${pack.key} page ${page} does not occupy at least 60% of the A4 detail canvas.`);
      }
      if (pack.monochromePages.has(page) && metrics.chromaticPixels > 0) {
        throw new Error(`${pack.key} page ${page} contains meaningful chromatic pixels.`);
      }
      inspections.push({ pack: pack.key, page, file: path.join(packRoot, file), ...metrics });
      contactInputs.push(await sharp(bytes).resize({ width: 720 }).png().toBuffer());
    }
    for (let start = 0; start < contactInputs.length; start += 4) {
      const group = contactInputs.slice(start, start + 4);
      const tileMetadata = await sharp(group[0]).metadata();
      const tileWidth = tileMetadata.width!;
      const tileHeight = tileMetadata.height!;
      const canvas = sharp({ create: { width: tileWidth * 2 + 30, height: tileHeight * 2 + 30, channels: 3, background: "#d6d6d6" } });
      await canvas.composite(group.map((input, index) => ({ input, left: (index % 2) * tileWidth + (index % 2 ? 20 : 10), top: Math.floor(index / 2) * tileHeight + (Math.floor(index / 2) ? 20 : 10) }))).png().toFile(path.join(inspectionRoot, `${pack.key}-contact-${start / 4 + 1}.png`));
    }
  }
  const result = { dpi: 300, pagesInspected: inspections.length, inspections };
  await writeFile(path.join(inspectionRoot, "inspection.json"), JSON.stringify(result, null, 2) + "\n");
  process.stdout.write(JSON.stringify({ result: "R8_ALL_PAGES_RENDERED_AND_PROGRAMMATICALLY_INSPECTED", inspectionRoot, pagesInspected: inspections.length }, null, 2));
}

function inspectRaster(data: Uint8Array, width: number, height: number, channels: number) {
  const edge = Math.max(1, Math.round(width * 2 / 210));
  let darkPixels = 0;
  let outerEdgeDarkPixels = 0;
  let chromaticPixels = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const offset = (y * width + x) * channels;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const minimum = Math.min(red, green, blue);
    const maximum = Math.max(red, green, blue);
    if (maximum - minimum > 2) chromaticPixels += 1;
    if (minimum < 245) {
      darkPixels += 1;
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      if (x < edge || x >= width - edge || y < edge || y >= height - edge) outerEdgeDarkPixels += 1;
    }
  }
  return {
    width,
    height,
    darkPixelRatio: darkPixels / (width * height),
    boundingWidthRatio: maxX < 0 ? 0 : (maxX - minX + 1) / width,
    boundingHeightRatio: maxY < 0 ? 0 : (maxY - minY + 1) / height,
    outerEdgeDarkPixels,
    chromaticPixels
  };
}

function naturalPageSort(left: string, right: string) {
  const number = (value: string) => Number(value.match(/(\d+)\.png$/)?.[1] ?? 0);
  return number(left) - number(right);
}

async function resolvePdfToPpmExecutable() {
  if (process.platform !== "win32") return "pdftoppm";
  const { stdout } = await execFileAsync("where.exe", ["pdftoppm.cmd"], { windowsHide: true });
  const wrapper = stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  if (!wrapper) throw new Error("pdftoppm.cmd is required for R8 print-resolution inspection.");
  return path.resolve(path.dirname(wrapper), "..", "..", "native", "poppler", "Library", "bin", "pdftoppm.exe");
}

main().catch((error) => {
  process.stderr.write((error instanceof Error ? error.stack || error.message : String(error)) + "\n");
  process.exitCode = 1;
});
