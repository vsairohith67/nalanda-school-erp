import { readFile, mkdir, copyFile, writeFile, lstat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const types = {
  index: 'application/vnd.oci.image.index.v1+json',
  manifest: 'application/vnd.oci.image.manifest.v1+json',
  config: 'application/vnd.oci.image.config.v1+json',
};
export async function assembleOci(root, output, sourceCommit) {
  if (!/^[a-f0-9]{40}$/.test(sourceCommit ?? '')) throw new Error('OCI_SOURCE_INVALID');
  const manifests = [];
  await mkdir(output); // Refuse to overwrite another release or partial attempt.
  await mkdir(path.join(output, 'blobs/sha256'), { recursive: true });
  for (const architecture of ['amd64', 'arm64']) {
    const layout = path.join(root, architecture, 'oci-layout');
    const checked = new Set();
    const blob = async descriptor => {
      if (!/^sha256:[a-f0-9]{64}$/.test(descriptor?.digest ?? '') || !Number.isSafeInteger(descriptor.size) || descriptor.size < 0) throw new Error('OCI_DESCRIPTOR_INVALID');
      const file = path.join(layout, 'blobs/sha256', descriptor.digest.slice(7));
      const stat = await lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== descriptor.size) throw new Error('OCI_BLOB_SIZE_INVALID');
      const hash = createHash('sha256');
      for await (const chunk of createReadStream(file)) hash.update(chunk);
      if (`sha256:${hash.digest('hex')}` !== descriptor.digest) throw new Error('OCI_BLOB_HASH_MISMATCH');
      checked.add(file);
      return file;
    };
    const jsonBlob = async descriptor => {
      if (descriptor.size > 4 * 1024 * 1024) throw new Error('OCI_METADATA_TOO_LARGE');
      return JSON.parse(await readFile(await blob(descriptor), 'utf8'));
    };
    const index = JSON.parse(await readFile(path.join(layout, 'index.json'), 'utf8'));
    if (index.schemaVersion !== 2 || (index.mediaType !== undefined && index.mediaType !== types.index) || index.manifests?.length !== 1) throw new Error('OCI_ARCH_MANIFEST_COUNT_INVALID');
    const descriptor = index.manifests[0];
    if (descriptor.mediaType !== types.manifest) throw new Error('OCI_MANIFEST_TYPE_INVALID');
    const manifest = await jsonBlob(descriptor);
    if (manifest.schemaVersion !== 2 || manifest.mediaType !== types.manifest || manifest.config?.mediaType !== types.config || !Array.isArray(manifest.layers) || !manifest.layers.length) throw new Error('OCI_MANIFEST_INVALID');
    const config = await jsonBlob(manifest.config);
    const provenance = JSON.parse(await readFile(path.join(root, architecture, 'build-provenance.json'), 'utf8'));
    if (config.architecture !== architecture || config.os !== 'linux' || config.config?.Labels?.['org.opencontainers.image.revision'] !== sourceCommit || provenance.sourceCommit !== sourceCommit || provenance.architecture !== architecture || provenance.emulationUsed !== false || provenance.imageId !== manifest.config.digest) throw new Error('OCI_PLATFORM_PROVENANCE_MISMATCH');
    for (const layer of manifest.layers) {
      if (!/^application\/vnd\.oci\.image\.layer\.v1\.tar(?:\+gzip|\+zstd)?$/.test(layer.mediaType ?? '')) throw new Error('OCI_LAYER_TYPE_INVALID');
      await blob(layer);
    }
    for (const file of checked) await copyFile(file, path.join(output, 'blobs/sha256', path.basename(file)));
    manifests.push({ mediaType: descriptor.mediaType, digest: descriptor.digest, size: descriptor.size, platform: { architecture, os: 'linux' } });
  }
  const index = { schemaVersion: 2, mediaType: types.index, manifests };
  await writeFile(path.join(output, 'index.json'), JSON.stringify(index), { flag: 'wx' });
  await writeFile(path.join(output, 'oci-layout'), JSON.stringify({ imageLayoutVersion: '1.0.0' }), { flag: 'wx' });
  await writeFile(path.join(output, 'release-evidence.json'), JSON.stringify({ sourceCommit, indexSha256: createHash('sha256').update(JSON.stringify(index)).digest('hex'), platforms: manifests.map(m => m.platform), classification: 'BUILD_EVIDENCE_ONLY', providerCertification: false, hardwareCertification: false }, null, 2), { flag: 'wx' });
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await assembleOci(path.resolve('oci-input'), path.resolve('oci-release'), process.env.EXPECTED_SHA);
