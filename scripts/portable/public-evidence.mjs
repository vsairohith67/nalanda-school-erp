// Public artifacts are projections, never directories, layers, bundles, raw SBOMs or scanner output.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const digest = value => /^sha256:[a-f0-9]{64}$/.test(value ?? '') ? value : null;
export function projectPublicEvidence(input, source, architecture) {
  if (!/^[a-f0-9]{40}$/.test(source ?? '') || !['amd64', 'arm64'].includes(architecture)) throw Error('PUBLIC_EVIDENCE_IDENTITY_INVALID');
  return { contract: 'NALANDA_PUBLIC_OCI_METADATA_V1', source, architecture,
    classification: 'METADATA_ONLY_NOT_RUNTIME_ADMISSION', deployableArtifactRetained: false,
    imageConfigDigest: digest(input?.imageId), evidenceSha256: /^[a-f0-9]{64}$/.test(input?.evidenceSha256 ?? '') ? input.evidenceSha256 : null };
}
export function aggregatePublicEvidence(inputs, source) {
  if (inputs.length !== 2 || new Set(inputs.map(x => x.architecture)).size !== 2 || inputs.some(x => x.contract !== 'NALANDA_PUBLIC_OCI_METADATA_V1' || x.source !== source || !['amd64','arm64'].includes(x.architecture))) throw Error('PUBLIC_METADATA_MISMATCH');
  return { contract: 'NALANDA_PUBLIC_PLATFORM_METADATA_V1', source, classification: 'METADATA_ONLY_NOT_OCI_INDEX', deployableArtifactRetained: false, platforms: inputs.map(x => projectPublicEvidence({imageId:x.imageConfigDigest,evidenceSha256:x.evidenceSha256}, source, x.architecture)) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv[2] === 'aggregate') {
    const inputs = ['amd64','arm64'].map(a => JSON.parse(readFileSync(`oci-input/${a}/public-evidence.json`,'utf8')));
    writeFileSync('public-index-evidence.json', JSON.stringify(aggregatePublicEvidence(inputs,process.env.EXPECTED_SHA)), {flag:'wx'});
  } else {
    let input = {};
    try { const bytes=readFileSync('build-provenance.json'); const parsed=JSON.parse(bytes); input={imageId:parsed.imageId,evidenceSha256:createHash('sha256').update(bytes).digest('hex')}; } catch { /* failed build: explicitly incomplete metadata */ }
    writeFileSync('public-evidence.json',JSON.stringify(projectPublicEvidence(input,process.env.EXPECTED_SHA,process.env.TARGET_ARCHITECTURE)),{flag:'wx'});
  }
}
