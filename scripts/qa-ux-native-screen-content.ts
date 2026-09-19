import { stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

// A negative gate for blank launch captures, not proof of a working control or
// authenticated workflow. Ignore status/navigation bars in the outer 20%.
export async function assertNonblankNativeCapture(input: string | Buffer) {
  const bytes = typeof input === "string" ? (await stat(input)).size : input.length;
  if (bytes > 20_000_000) throw new Error("NATIVE_CAPTURE_TOO_LARGE");
  const picture = sharp(input, { limitInputPixels: 20_000_000 });
  const { width, height, format } = await picture.metadata();
  if (format !== "png" || !width || !height || width < 200 || height < 200 || width > 4096 || height > 4096) {
    throw new Error("NATIVE_CAPTURE_INVALID");
  }
  const center = await picture.extract({
    left: Math.floor(width * 0.2), top: Math.floor(height * 0.2),
    width: Math.floor(width * 0.6), height: Math.floor(height * 0.6)
  }).removeAlpha().png().toBuffer();
  const stats = await sharp(center).stats();
  if (!stats.channels.some((channel) => channel.stdev > 5 && channel.max - channel.min > 24)) {
    throw new Error("NATIVE_CAPTURE_BLANK_CONTENT");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assertNonblankNativeCapture(process.argv[2] ?? "").then(() => {
    console.log("NATIVE_CAPTURE_NONBLANK_NOT_WORKFLOW_ACCEPTANCE");
  }).catch(() => {
    console.error("NATIVE_CAPTURE_NOT_READY");
    process.exitCode = 1;
  });
}
