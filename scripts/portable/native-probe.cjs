const { createRequire } = require('node:module');
const { readdirSync } = require('node:fs');
const path = require('node:path');
const appRequire = createRequire('/app/package.json');
(async () => {
  const sharp = appRequire('sharp');
  const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#ffffff' } }).png().toBuffer();
  if (!png.length) throw new Error('SHARP_NATIVE_FAILED');
  const generated = path.dirname(createRequire(appRequire.resolve('@prisma/client')).resolve('.prisma/client/default'));
  const libraries = readdirSync(generated).filter(name => /^libquery_engine.*\.node$/.test(name));
  if (!libraries.length) throw new Error('PRISMA_NATIVE_MISSING');
  for (const library of libraries) appRequire(path.join(generated, library));
  console.log(JSON.stringify({ node: process.version, architecture: process.arch, platform: process.platform,
    glibc: process.report.getReport().header.glibcVersionRuntime, sharp: sharp.versions,
    prismaNativeLibraries: libraries, nativeLoad: 'PASSED', network: 'none', emulationUsed: false }));
})().catch(() => { console.error('NATIVE_DEPENDENCY_PROBE_FAILED'); process.exitCode = 1; });
