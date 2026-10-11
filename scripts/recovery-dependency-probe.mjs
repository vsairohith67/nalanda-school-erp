import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve('next/package.json'));
assert.equal(require('next/package.json').version, '15.5.25');
assert.equal(require('react/package.json').version, require('react-dom/package.json').version);
assert.equal(sharp.versions.sharp, '0.35.4');
assert.equal(sharp.versions.heif, '1.23.2');
// Resolve Sharp from Next's actual dependency graph as well as the application.
assert.equal(nextRequire('sharp').versions.sharp, sharp.versions.sharp);
assert.equal(nextRequire('sharp').versions.heif, sharp.versions.heif);
for (const format of ['png', 'jpeg', 'webp', 'avif']) {
  const bytes = await sharp({ create: { width: 32, height: 24, channels: 3, background: '#397ca3' } })
    .toFormat(format).toBuffer();
  const decoded = await sharp(bytes).resize(16, 12).png().toBuffer();
  const info = await sharp(decoded).metadata();
  assert.equal(info.width, 16);
  assert.equal(info.height, 12);
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(decoded);
  pdf.addPage([100, 100]).drawImage(image, { x: 10, y: 10, width: 16, height: 12 });
  const reopened = await PDFDocument.load(await pdf.save());
  assert.equal(reopened.getPageCount(), 1);
}
await assert.rejects(sharp(Buffer.from('synthetic invalid image')).toBuffer());
console.log(JSON.stringify({ status: 'PASS', next: require('next/package.json').version,
  react: require('react/package.json').version, sharp: sharp.versions,
  platform: process.platform, arch: process.arch, formats: ['png', 'jpeg', 'webp', 'avif'],
  pdfRoundTrips: 4, runtimeClearance: false }, null, 2));
