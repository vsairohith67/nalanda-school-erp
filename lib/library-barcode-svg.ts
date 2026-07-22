/** Code 39 (ISO/IEC 16388) SVG renderer. Values use the basic Code 39 set only. */
import { normalizeBarcodeValue } from "@/lib/library-barcodes";

const CODE39: Record<string, string> = {
  "0":"nnnwwnwnn","1":"wnnwnnnnw","2":"nnwwnnnnw","3":"wnwwnnnnn","4":"nnnwwnnnw","5":"wnnwwnnnn","6":"nnwwwnnnn","7":"nnnwnnwnw","8":"wnnwnnwnn","9":"nnwwnnwnn","A":"wnnnnwnnw","B":"nnwnnwnnw","C":"wnwwnwnnn","D":"nnnnwwnnw","E":"wnnnwwnnn","F":"nnwnwwnnn","G":"nnnnnwwnw","H":"wnnnnwwnn","I":"nnwnnwwnn","J":"nnnnwwwnn","K":"wnnnnnnww","L":"nnwnnnnww","M":"wnwwnnnwn","N":"nnnnwnnww","O":"wnnnwnnwn","P":"nnwnwnnwn","Q":"nnnnnnwww","R":"wnnnnnwwn","S":"nnwnnnwwn","T":"nnnnwnwwn","U":"wwnnnnnnw","V":"nwwnnnnnw","W":"wwwnnnnnn","X":"nwnnwnnnw","Y":"wwnnwnnnn","Z":"nwwnwnnnn","-":"nwnnnnwnw",".":"wwnnnnwnn"," ":"nwwnnnwnn","$":"nwnwnwnnn","/":"nwnwnnnwn","+":"nwnnnwnwn","%":"nnnwnwnwn","*":"nwnnwnwnn"
};

export function renderCode39Svg(value: unknown) {
  const normalized = normalizeBarcodeValue(value);
  const encoded = `*${normalized}*`;
  const narrow = 2, wide = 6, gap = 2, quiet = 20, height = 74;
  let x = quiet; const bars: string[] = [];
  for (const char of encoded) {
    for (let i = 0; i < 9; i++) { const width = CODE39[char][i] === "w" ? wide : narrow; if (i % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${width}" height="${height}"/>`); x += width; }
    x += gap;
  }
  const width = x + quiet - gap;
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Code 39 barcode ${normalized}" viewBox="0 0 ${width} ${height + 18}" width="100%" height="100%"><rect width="100%" height="100%" fill="white"/>${bars.join("")}<text x="${width / 2}" y="${height + 14}" text-anchor="middle" font-family="monospace" font-size="12" fill="black">${normalized}</text></svg>`;
}
