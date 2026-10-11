"""Bounded offline product-byte adapter. No registry, scanner or runtime launch.

Reuses backend-build-scan descriptor, command, capture and policy functions.
Only the authenticated TypeScript caller executes scanner argument arrays.
"""
import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import sys
import tarfile

spec = importlib.util.spec_from_file_location('backend_scan', Path(__file__).with_name('backend-build-scan.py'))
q = importlib.util.module_from_spec(spec)
spec.loader.exec_module(q)


def strict_json(raw):
    def pairs(items):
        obj = {}
        for key, value in items:
            q.check(key not in obj and key not in ('__proto__', 'constructor', 'prototype'), 'PRODUCT_JSON_DUPLICATE')
            obj[key] = value
        return obj
    q.check(0 < len(raw) <= q.PRIVATE_LIMIT, 'PRODUCT_JSON_BOUND')
    return json.loads(raw, object_pairs_hook=pairs, parse_constant=lambda _: q.check(False, 'PRODUCT_JSON_NUMBER'))


def regular(file, limit=q.PRIVATE_LIMIT):
    s = file.lstat()
    q.check(stat.S_ISREG(s.st_mode) and s.st_nlink == 1 and not file.is_symlink() and file.resolve() == file and s.st_size <= limit, 'PRODUCT_FILE_UNSAFE')
    raw = file.read_bytes()
    q.check(len(raw) == s.st_size, 'PRODUCT_FILE_CHANGED')
    return raw


def inspect_oci(root, architecture, source, extract=True, materials=False):
    archive = regular(root/'product.oci.tar', q.MAX_IMAGE)
    entries = {}
    with tarfile.open(fileobj=q.io.BytesIO(archive), mode='r:') as tar:
        members = tar.getmembers()
        q.check(0 < len(members) <= 1000 and sum(m.size for m in members) <= q.MAX_IMAGE, 'PRODUCT_OCI_BOUND')
        for m in members:
            name = q.member_safe(m, True)
            if m.isdir():
                q.check(name in ('.', 'blobs', 'blobs/sha256'), 'PRODUCT_OCI_DIRECTORY')
                continue
            q.check(name in ('index.json', 'oci-layout') or re.fullmatch(r'blobs/sha256/[a-f0-9]{64}', name), 'PRODUCT_OCI_MEMBER')
            q.check(name not in entries, 'PRODUCT_OCI_DUPLICATE')
            entries[name] = tar.extractfile(m).read()
    q.check(strict_json(entries['oci-layout']) == {'imageLayoutVersion': '1.0.0'}, 'PRODUCT_OCI_LAYOUT')
    index = strict_json(entries['index.json'])
    q.check(index.get('schemaVersion') == 2 and isinstance(index.get('manifests'), list) and len(index['manifests']) == 1, 'PRODUCT_OCI_INDEX')
    selected = q.select_platform(index, architecture)
    manifest_bytes = entries['blobs/sha256/'+selected['digest'][7:]]
    q.descriptor(manifest_bytes, selected)
    manifest = strict_json(manifest_bytes)
    q.check(manifest.get('schemaVersion') == 2 and isinstance(manifest.get('layers'), list) and 0 < len(manifest['layers']) <= 100, 'PRODUCT_MANIFEST_INVALID')
    config_bytes = entries['blobs/sha256/'+manifest['config']['digest'][7:]]
    q.descriptor(config_bytes, manifest['config'])
    config = strict_json(config_bytes)
    labels = config.get('config', {}).get('Labels', {})
    q.check(config.get('os') == 'linux' and config.get('architecture') == architecture and (materials or config.get('config', {}).get('User') == '65532:65532') and labels.get('org.opencontainers.image.revision') == source and labels.get('io.nalanda.artifact-purpose') == ('PREPARED_DEPENDENCIES_ONLY' if materials else 'PRODUCTION_DEFAULT_OFF') and not any('synthetic' in k or '.qa-' in k for k in labels), 'PRODUCT_CONFIG_IDENTITY')
    q.check(not any('SYNTHETIC' in str(v) or 'QA_PROFILE' in str(v) for v in config.get('config', {}).get('Env', [])), 'PRODUCT_QA_ENVIRONMENT')
    required = {'index.json', 'oci-layout', 'blobs/sha256/'+selected['digest'][7:], 'blobs/sha256/'+manifest['config']['digest'][7:]}
    for layer in manifest['layers']:
        name = 'blobs/sha256/'+layer['digest'][7:]
        q.descriptor(entries[name], layer)
        required.add(name)
    q.check(set(entries) == required, 'PRODUCT_UNRELATED_ARCHIVE_BYTES')
    metadata = strict_json(regular(root/'build-metadata.json'))
    q.check(metadata.get('containerimage.config.digest') == manifest['config']['digest'] and metadata.get('containerimage.digest') == selected['digest'], 'PRODUCT_BUILD_DESCRIPTOR_MISMATCH')
    layout = root/'product-oci'
    if extract:
        layout.mkdir(mode=0o700)
        (layout/'blobs'/'sha256').mkdir(parents=True, mode=0o700)
        for name, raw in entries.items():
            q.write(layout/name, raw)
    else:
        actual = set()
        for directory, dirs, files in os.walk(layout, followlinks=False):
            for name in dirs:
                p = Path(directory)/name
                q.check(not p.is_symlink() and p.resolve() == p, 'PRODUCT_LAYOUT_UNSAFE')
            for name in files:
                p = Path(directory)/name
                relative = p.relative_to(layout).as_posix()
                q.check(relative in entries and regular(p, q.MAX_IMAGE) == entries[relative], 'PRODUCT_LAYOUT_SUBSTITUTED')
                actual.add(relative)
        q.check(actual == required, 'PRODUCT_LAYOUT_INCOMPLETE')
    return dict(archiveSha256=q.sha(archive), indexSha256=q.sha(entries['index.json']), manifestDigest=selected['digest'], configDigest=manifest['config']['digest'], files={k:q.sha(v) for k,v in entries.items()})


def inspect_inputs(root, architecture):
    proof = strict_json(regular(root/'input-inspection.json'))
    for name, component in proof['images'].items():
        layout = root/'inputs'/name
        manifest = strict_json(regular(layout/'blobs'/'sha256'/component['manifest']))
        wanted = component['nodePath']
        ancestors = [] if not wanted else [str(p) for p in Path(wanted).parents if str(p) != '.']
        protected = ancestors + ([wanted] if wanted else [])
        whiteouts = {str(Path(p).parent / ('.wh.'+Path(p).name)) for p in protected}
        actual = None
        material_files = {f['path']: f for f in component.get('materialFiles', [])}
        material_actual = {}
        for filename in material_files:
            ancestors.extend(str(p) for p in Path(filename).parents if str(p) != '.')
            whiteouts.update(str(Path(p).parent / ('.wh.'+Path(p).name)) for p in [filename, *Path(filename).parents] if str(p) != '.')
        total = 0
        for descriptor in manifest['layers']:
            raw = regular(layout/'blobs'/'sha256'/descriptor['digest'][7:], q.MAX_IMAGE)
            q.descriptor(raw, descriptor)
            with tarfile.open(fileobj=q.io.BytesIO(raw), mode='r:*') as layer:
                count = 0
                for member in layer:
                    count += 1
                    total += member.size
                    q.check(count <= 100000 and total <= 4*1024**3 and member.size <= q.MAX_IMAGE, 'INPUT_LAYER_BOUND')
                    path = q.member_safe(member)
                    q.check(path not in whiteouts and not (path in ancestors and not member.isdir()), 'INPUT_NODE_ANCESTOR_OVERLAY_UNRESOLVED')
                    if member.isfile() and Path(path).name in ('node', 'nodejs'):
                        q.check(path == wanted, 'INPUT_UNCOVERED_NODE_BINARY')
                    # For this finite contract Node must be a regular file at
                    # its reviewed canonical path. Ambiguous links/whiteouts
                    # refuse instead of guessing an overlay filesystem result.
                    if wanted and (path == wanted or path.endswith('/.wh.'+Path(wanted).name) or path.endswith('/.wh..wh..opq')):
                        q.check(path == wanted and member.isfile(), 'INPUT_NODE_OVERLAY_UNRESOLVED')
                        actual = layer.extractfile(member).read()
                    if material_files and path.endswith('/.wh..wh..opq'):
                        raise ValueError('MATERIAL_OVERLAY_UNRESOLVED')
                    if path in material_files:
                        q.check(member.isfile(), 'MATERIAL_NATIVE_LINK_REFUSED')
                        material_actual[path] = layer.extractfile(member).read()
        q.check(set(material_actual) == set(material_files), 'MATERIAL_NATIVE_FILE_MISSING')
        for filename, raw in material_actual.items():
            q.check(q.sha(raw) == material_files[filename]['sha256'], 'MATERIAL_NATIVE_LAYER_ASSOCIATION')
            if material_files[filename]['native']:
                q.check(raw[:6] == b'\x7fELF\x02\x01' and int.from_bytes(raw[18:20], 'little') == {'amd64':62,'arm64':183}[architecture], 'MATERIAL_NATIVE_ARCHITECTURE')
        if wanted:
            q.check(actual is not None and q.sha(actual) == component['nodeSha256'], 'INPUT_NODE_LAYER_ASSOCIATION')
            q.check(actual[:4] == b'\x7fELF' and actual[4:6] == b'\x02\x01' and int.from_bytes(actual[18:20], 'little') == {'amd64':62,'arm64':183}[architecture], 'INPUT_NODE_ARCHITECTURE')
    if proof.get('pnpmMaterial'):
        material = proof['pnpmMaterial']
        raw = regular(root/'pnpm-material.tar.gz', q.MAX_IMAGE)
        q.check(q.sha(raw) == material['archiveSha256'], 'MATERIAL_PNPM_ARCHIVE_SUBSTITUTED')
        expected = {f['path']:f for f in material['files']};seen=set()
        with tarfile.open(fileobj=q.io.BytesIO(raw),mode='r:*') as archive:
            members=archive.getmembers();q.check(len(members)<=10000 and sum(m.size for m in members)<=128*1024*1024,'MATERIAL_PNPM_ARCHIVE_BOUND')
            for member in members:
                name=q.member_safe(member)
                if member.isdir():continue
                q.check(member.isfile() and name.startswith('package/'),'MATERIAL_PNPM_ARCHIVE_LINK')
                destination='pnpm/'+name[len('package/'):]
                q.check(destination in expected and destination not in seen,'MATERIAL_PNPM_ARCHIVE_COVERAGE')
                data=archive.extractfile(member).read();staged=regular(root/'material-inputs'/destination)
                q.check(data==staged and q.sha(data)==expected[destination]['sha256'],'MATERIAL_PNPM_ARCHIVE_ASSOCIATION');seen.add(destination)
        q.check(seen==set(expected),'MATERIAL_PNPM_ARCHIVE_COVERAGE')
    for tool in proof['tools']:
        raw = regular(root/'input-archives'/tool['archiveSha256'], q.MAX_IMAGE)
        q.check(q.sha(raw) == tool['archiveSha256'], 'INPUT_TOOL_ARCHIVE_SUBSTITUTED')
        found = []
        with tarfile.open(fileobj=q.io.BytesIO(raw), mode='r:*') as archive:
            entries = archive.getmembers()
            q.check(len(entries) <= 50000 and sum(m.size for m in entries) <= 2*q.MAX_IMAGE, 'INPUT_TOOL_ARCHIVE_BOUND')
            for member in entries:
                name = q.member_safe(member)
                if name == tool['path']:
                    q.check(member.isfile(), 'INPUT_TOOL_ARCHIVE_LINK')
                    found.append(q.sha(archive.extractfile(member).read()))
        q.check(found == [tool['executableSha256']], 'INPUT_TOOL_ARCHIVE_ASSOCIATION')
    return {'result':'INPUT_STATIC_ASSOCIATIONS_VERIFIED'}


def main():
    action, root_raw, architecture, source = sys.argv[1:5]
    root = Path(root_raw)
    q.check(root.is_absolute() and root.resolve() == root and not root.is_symlink(), 'PRODUCT_ROOT_UNSAFE')
    owner = strict_json(regular(root/'owner.json'))
    q.check(owner.get('contract') == 'NALANDA_PRODUCT_PRODUCER_ROOT_V1' and owner.get('target') == 'production-runtime' and owner.get('source') == source and owner.get('architecture') == architecture, 'PRODUCT_OWNER_MISMATCH')
    if action == 'inputs':
        result = inspect_inputs(root, architecture)
    elif action in ('inspect', 'recheck', 'inspect-materials'):
        result = inspect_oci(root, architecture, source, action != 'recheck', action == 'inspect-materials')
    elif action == 'commands':
        bins = strict_json(regular(root/'scanner-bins.json'))
        result = q.scanner_commands(root, root/'product-oci', bins)
    elif action == 'capture':
        summary = {}
        try:
            parsed = q.capture_reports(root, sys.argv[5], summary)
            for name in parsed:
                strict_json(regular(root/name))
        except Exception:
            summary['failure'] = 'PRODUCT_REPORT_COLLECTION_OR_PARSE_FAILED'
        q.write(root/'report-capture.json', summary)
        result = summary
    else:
        raise ValueError('PRODUCT_ADAPTER_ACTION_INVALID')
    print(json.dumps(result, separators=(',', ':')))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('PRODUCT_OFFLINE_ADAPTER_REFUSED', file=sys.stderr)
        sys.exit(1)
