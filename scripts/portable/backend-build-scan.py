"""Private same-job input qualification. No launch, signing, admission or registry push.

This finite caller intentionally stops before product build when base bytes,
scanner completeness or bundled-library vendor applicability are unresolved.
A base PASS alone is never production image qualification.
"""
import datetime as dt
import hashlib
import io
import json
import os
import platform
import posixpath
import re
import shutil
import signal
import stat
import subprocess
import tarfile
import time
import urllib.request
from pathlib import Path

CLASSIFICATION = 'BUILD_SCAN_ONLY_NOT_ADMITTED'
DIGEST = re.compile(r'^sha256:[a-f0-9]{64}$')
PRIVATE_LIMIT = 256 * 1024 * 1024
MAX_IMAGE = 1024 * 1024 * 1024
RUNTIME = 'gcr.io/distroless/nodejs24-debian13:nonroot@sha256:774b7d020b24214835769e24c3544835526cd0288f0b094eae48e8b2c2429a79'
BUILDER = 'node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df'

def check(value, code):
    if not value:
        raise ValueError(code)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def stamp():
    return dt.datetime.now(dt.timezone.utc).isoformat()

def write(file, data):
    with open(file, 'xb') as f:
        os.chmod(file, 0o600)
        f.write(data if isinstance(data, bytes) else (json.dumps(data, sort_keys=True) + '\n').encode())

def read_json(file):
    check(file.is_file() and not file.is_symlink() and file.stat().st_size <= PRIVATE_LIMIT, 'REPORT_UNSAFE')
    return json.loads(file.read_bytes())

def member_safe(m, tools=False):
    name = m.name.removeprefix('./')
    if name in ('', '.') and m.isdir():
        return '.'
    check(name and not name.startswith('/') and '\\' not in name and all(p != '..' for p in name.split('/')), 'ARCHIVE_PATH_UNSAFE')
    check(m.isfile() or m.isdir() or (not tools and (m.issym() or m.islnk())), 'ARCHIVE_TYPE_UNSAFE')
    if m.issym() or m.islnk():
        target = posixpath.normpath(posixpath.join(posixpath.dirname(name) if m.issym() else '', m.linkname))
        # Absolute image links are inspected as virtual-root links; never materialized.
        check('\\' not in m.linkname and not target.startswith('../') and target != '..', 'ARCHIVE_LINK_UNSAFE')
    return name

def unpack_tools(data, destination):
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
        entries = archive.getmembers()
        check(len(entries) < 2000 and sum(m.size for m in entries) < PRIVATE_LIMIT * 4, 'TOOL_ARCHIVE_BOUND')
        for m in entries:
            name = member_safe(m, True)
            target = destination / name
            if m.isdir():
                target.mkdir(parents=True, exist_ok=True, mode=0o700)
            else:
                target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                write(target, archive.extractfile(m).read())
                os.chmod(target, 0o700 if m.mode & 0o111 else 0o600)

def request(url, limit=PRIVATE_LIMIT, headers=None):
    check(url.startswith('https://'), 'HTTPS_REQUIRED')
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=90) as response:
        check(response.geturl().startswith('https://'), 'HTTPS_REDIRECT_REQUIRED')
        data = response.read(limit + 1)
        check(len(data) <= limit, 'ACQUISITION_BOUND')
        return data

def descriptor(data, d):
    check(DIGEST.fullmatch(d.get('digest', '')) and len(data) == d.get('size') and 'sha256:' + sha(data) == d['digest'], 'DESCRIPTOR_SUBSTITUTED')

def select_platform(index, arch):
    candidates = [d for d in index.get('manifests', []) if d.get('platform', {}).get('os') == 'linux' and d['platform'].get('architecture') == arch]
    check(len(candidates) == 1, 'ARCHITECTURE_AMBIGUOUS')
    return candidates[0]

def scanner_policy(trivy, grype, sbom, config, exits, metadata):
    check(trivy.get('SchemaVersion') == 2 and trivy.get('Metadata', {}).get('ImageID') == config and isinstance(trivy.get('Results'), list) and trivy['Results'], 'TRIVY_SUBJECT_OR_REPORT_INVALID')
    check(all(isinstance(r,dict) and isinstance(r.get('Target'),str) and isinstance(r.get('Class'),str) for r in trivy['Results']), 'TRIVY_RESULT_INVALID')
    check(any(r.get('Class') == 'os-pkgs' and isinstance(r.get('Type'),str) for r in trivy['Results']), 'OS_COVERAGE_MISSING')
    check(grype.get('source', {}).get('target', {}).get('imageID') == config and isinstance(grype.get('matches'), list) and grype.get('descriptor', {}).get('version') == metadata['grype']['version'], 'GRYPE_SUBJECT_OR_REPORT_INVALID')
    check(sbom.get('spdxVersion', '').startswith('SPDX-') and isinstance(sbom.get('packages'), list) and sbom['packages'], 'SBOM_INCOMPLETE')
    rows = []
    for r in trivy['Results']:
        check(not r.get('ModifiedFindings') and isinstance(r.get('Vulnerabilities', []), list), 'TRIVY_SUPPRESSED_OR_MALFORMED')
        for v in r.get('Vulnerabilities', []):
            rows.append(('trivy', v.get('VulnerabilityID'), v.get('PkgName'), v.get('InstalledVersion'), v.get('Severity', '').upper()))
    check(isinstance(grype.get('ignoredMatches', []), list), 'GRYPE_IGNORED_MALFORMED')
    for m in grype['matches'] + grype.get('ignoredMatches', []):
        v, a = m.get('vulnerability', {}), m.get('artifact', {})
        rows.append(('grype', v.get('id'), a.get('name'), a.get('version'), v.get('severity', '').upper()))
    for tool, m in metadata.items():
        updated = dt.datetime.fromisoformat(m['databaseUpdatedAt'].replace('Z', '+00:00'))
        age = (dt.datetime.now(dt.timezone.utc) - updated).total_seconds()
        check(0 <= age <= 72 * 3600 and re.fullmatch(r'[a-f0-9]{64}', m['databaseSha256']), 'DATABASE_STALE_OR_UNKNOWN')
        check(m['ignoreUnfixed'] is False and m['severityThreshold'] == 'HIGH', 'SCANNER_POLICY_CHANGED')
        check(exits[tool] in {'trivy': (0, 1), 'grype': (0, 2)}[tool], 'SCANNER_PROCESS_FAILED')
    blocked = [r for r in rows if r[-1] not in ('LOW', 'MEDIUM', 'NEGLIGIBLE')]
    check(all(exits[t] == 0 or any(r[0] == t for r in blocked) for t in exits), 'SCANNER_FAILURE_WITHOUT_VALID_FINDINGS')
    return blocked

def scanner_commands(root, layout, bins):
    # Pinned Trivy accepts an OCI directory; its archive input is Docker-specific.
    return {
        'trivy': [bins['trivy'],'image','--cache-dir',str(root/'trivy-db'),'--skip-db-update','--input',str(layout),'--format','json','--output',str(root/'trivy.json'),'--list-all-pkgs','--pkg-types','os,library','--scanners','vuln','--severity','UNKNOWN,HIGH,CRITICAL','--ignore-unfixed=false','--exit-code','1'],
        'grype': [bins['grype'],'oci-dir:'+str(layout),'-o','json','--file',str(root/'grype.json'),'--fail-on','high','--only-fixed=false'],
    }

def capture_reports(root, subject, summary):
    raw_reports = {}
    summary['reports'] = {}
    summary['reportHashes'] = {}
    # Capture every available original report before parsing any report. A missing
    # first report must not erase independent evidence from the other scanner.
    for name in ('trivy.json','grype.json','sbom.json','scanner-metadata.json'):
        file = root/name
        receipt = dict(subject=subject,name=name,status='MISSING')
        try:
            st = file.lstat()
            if not stat.S_ISREG(st.st_mode) or st.st_nlink != 1 or st.st_size > PRIVATE_LIMIT:
                receipt['status'] = 'UNSAFE'
            else:
                raw = file.read_bytes()
                check(len(raw) == st.st_size and len(raw) <= PRIVATE_LIMIT, 'REPORT_BYTES_CHANGED')
                raw_reports[name] = raw
                receipt.update(status='CAPTURED',bytes=len(raw),sha256=sha(raw),capturedBeforeParse=stamp())
                summary['reportHashes'][name] = sha(raw)
        except FileNotFoundError:
            pass
        except Exception:
            receipt['status'] = 'UNSAFE'
        write(root/(name+'.bytes-receipt.json'),receipt)
        summary['reports'][name] = {k:v for k,v in receipt.items() if k not in ('subject','name','capturedBeforeParse')}
    parsed = {}
    for name, raw in raw_reports.items():
        try:
            value = json.loads(raw)
            check(isinstance(value,dict), 'REPORT_OBJECT_REQUIRED')
            parsed[name] = value
            summary['reports'][name]['status'] = 'JSON_PARSED'
        except Exception:
            summary['reports'][name]['status'] = 'JSON_INVALID'
    check(len(raw_reports) == 4, 'REPORT_COLLECTION_INCOMPLETE')
    check(len(parsed) == 4, 'REPORT_PARSE_INVALID')
    return parsed

def project_findings(rows):
    check(len(rows) <= 100, 'PUBLIC_FINDING_BOUND')
    output = []
    for tool, advisory, package, version, severity in rows:
        check(tool in ('trivy', 'grype') and re.fullmatch(r'(CVE-\d{4}-\d{4,10}|GHSA-[a-z0-9-]{14})', advisory or ''), 'PUBLIC_ADVISORY_REJECTED')
        check(re.fullmatch(r'[A-Za-z0-9@_+./:~=-]{1,140}', package or '') and re.fullmatch(r'[A-Za-z0-9_+.:~=-]{1,100}', version or ''), 'PUBLIC_PACKAGE_REJECTED')
        check(severity in ('HIGH', 'CRITICAL', 'UNKNOWN', ''), 'PUBLIC_SEVERITY_REJECTED')
        output.append(dict(tool=tool, advisory=advisory, package=package, version=version, severity=severity or 'UNKNOWN'))
    return output

def validate_owner(root, parent, identity):
    check(root.parent == parent and root.resolve() == root and parent.resolve() == parent and not root.is_symlink(), 'CLEANUP_PATH_UNSAFE')
    check(read_json(root / 'owner.json') == identity and root.stat().st_uid == os.getuid(), 'CLEANUP_OWNER_MISMATCH')
    for directory, dirs, files in os.walk(root, followlinks=False):
        for name in dirs + files:
            item=Path(directory)/name;st=item.lstat()
            check(not item.is_symlink() and st.st_uid == os.getuid() and (stat.S_ISDIR(st.st_mode) or (stat.S_ISREG(st.st_mode) and st.st_nlink == 1)), 'CLEANUP_DESCENDANT_UNSAFE')

def private_process(root, summary, unsettled):
    counter = 0
    def process(label, args, env=None, timeout=900, subject=None):
        nonlocal counter
        counter += 1
        out, err = root / (str(counter) + '.stdout'), root / (str(counter) + '.stderr')
        start, clock = stamp(), time.monotonic()
        effective = {k:v for k,v in os.environ.items() if k in ('PATH','LANG')}
        for key,directory in [('HOME','home'),('TMPDIR','temp'),('XDG_CACHE_HOME','cache'),('SYFT_CACHE_DIR','syft-cache')]:
            destination=root/directory;destination.mkdir(mode=0o700,exist_ok=True);effective[key]=str(destination)
        effective.update(env or {})
        with open(out,'xb') as stdout, open(err,'xb') as stderr:
            os.chmod(out,0o600);os.chmod(err,0o600)
            child = subprocess.Popen(args, stdout=stdout, stderr=stderr, env=effective, start_new_session=True)
            unsettled.add(child.pid)
            timed_out = False
            try:
                deadline = time.monotonic() + timeout
                while child.poll() is None:
                    if out.stat().st_size + err.stat().st_size > PRIVATE_LIMIT or time.monotonic() >= deadline:
                        raise subprocess.TimeoutExpired(args, timeout)
                    time.sleep(0.1)
            except subprocess.TimeoutExpired:
                timed_out=True
                try: os.killpg(child.pid,signal.SIGTERM)
                except ProcessLookupError: pass
                try: child.wait(timeout=3)
                except subprocess.TimeoutExpired: pass
                try: os.killpg(child.pid,getattr(signal,'SIGKILL',9))
                except ProcessLookupError: pass
                child.wait(timeout=10)
        # Descendants must not outlive a leader, including on successful exit.
        try:
            os.killpg(child.pid, 0)
        except ProcessLookupError:
            pass
        else:
            os.killpg(child.pid,signal.SIGTERM);time.sleep(0.5)
            try: os.killpg(child.pid,getattr(signal,'SIGKILL',9))
            except ProcessLookupError: pass
        # Refuse cleanup if any live descendant still owns this process group.
        group_live=False
        for proc in Path('/proc').iterdir():
            if not proc.name.isdigit(): continue
            try:
                fields=(proc/'stat').read_text().rsplit(')',1)[1].split()
                if int(fields[2])==child.pid and fields[0]!='Z': group_live=True
            except (FileNotFoundError,ProcessLookupError): pass
        if not group_live: unsettled.discard(child.pid)
        raw_out, raw_err = out.read_bytes(), err.read_bytes()
        receipt = dict(command=args, subject=subject, start=start, end=stamp(), durationMs=round((time.monotonic()-clock)*1000), exit=child.returncode if child.returncode >= 0 else None, signal=-child.returncode if child.returncode < 0 else None, timedOut=timed_out, stdoutBytes=len(raw_out), stdoutSha256=sha(raw_out), stderrBytes=len(raw_err), stderrSha256=sha(raw_err))
        write(root / (str(counter) + '.receipt.json'), receipt)  # BEFORE caller parses either stream.
        summary['processes'].append(dict(stage=label, exit=receipt['exit'], signal=receipt['signal'], durationMs=receipt['durationMs'], stdoutBytes=len(raw_out), stdoutSha256=sha(raw_out), stderrBytes=len(raw_err), stderrSha256=sha(raw_err)))
        check(not group_live, 'PROCESS_GROUP_UNRECONCILED')
        check(not timed_out and len(raw_out)+len(raw_err) <= PRIVATE_LIMIT, 'PROCESS_BOUND_OR_TIMEOUT')
        return child.returncode, raw_out
    return process

def run():
    source, arch = os.getenv('EXPECTED_SHA', ''), os.getenv('TARGET_ARCHITECTURE', '')
    check(os.getenv('GITHUB_ACTIONS') == 'true' and os.getenv('RUNNER_ENVIRONMENT') == 'github-hosted' and os.getenv('RUNNER_OS') == 'Linux' and os.getenv('GITHUB_REPOSITORY') == 'vsairohith67/nalanda-school-erp' and os.getenv('PORTABLE_CI_EXCEPTION') == 'OWNER_AUTHORIZED', 'EPHEMERAL_EXACT_HEAD_CI_REQUIRED')
    check(not os.getenv('DOCKER_HOST') and not os.getenv('DOCKER_CONTEXT') and platform.system() == 'Linux' and os.getuid() != 0, 'HOST_UNSAFE')
    check(re.fullmatch(r'[a-f0-9]{40}', source) and arch in ('amd64', 'arm64') and platform.machine() == {'amd64':'x86_64','arm64':'aarch64'}[arch], 'SOURCE_OR_NATIVE_ARCHITECTURE_INVALID')
    run_id, attempt, job = os.getenv('GITHUB_RUN_ID', ''), os.getenv('GITHUB_RUN_ATTEMPT', ''), os.getenv('GITHUB_JOB', '')
    check(run_id.isdigit() and attempt.isdigit() and job == 'backend-build-scan', 'RUN_IDENTITY_REQUIRED')
    check(subprocess.check_output(['git', 'rev-parse', 'HEAD']).decode().strip() == source and not subprocess.check_output(['git','status','--porcelain']), 'COMMITTED_CLEAN_SOURCE_REQUIRED')
    parent = Path(os.environ['RUNNER_TEMP']).resolve()
    check(parent.is_dir() and shutil.disk_usage(parent).free >= 6 * 1024**3, 'RUNNER_DISK_CAPACITY_MISSING')
    identity = dict(classification=CLASSIFICATION, source=source, architecture=arch, runId=run_id, attempt=attempt, job=job)
    root = parent / ('nalanda-build-scan-' + run_id + '-' + attempt + '-' + arch)
    root.mkdir(mode=0o700)
    write(root / 'owner.json', identity)
    summary = dict(identity, tree=subprocess.check_output(['git','show','-s','--format=%T','HEAD']).decode().strip(), started=stamp(), result='BACKEND_BUILD_SCAN_QUALIFICATION_PARTIAL', base='NOT_EXECUTED', product='NOT_BUILT', runtime='NOT_EXECUTED', nativeExecution='NOT_EXECUTED', admitted=False, durablePrivateRetention=False, rawRetention='UNTIL_OWNED_JOB_CLEANUP', pythonVersion=platform.python_version(), capacityFreeBytes=shutil.disk_usage(parent).free, inputIndex=RUNTIME.split('@')[1], inputs={}, processes=[], findings=[], cleanupComplete=False)
    unsettled = set()
    process=private_process(root,summary,unsettled)
    def ok(label,args,env=None,subject=None):
        code, out = process(label,args,env,subject=subject)
        check(code == 0, 'TOOL_PROCESS_FAILED')
        return out
    try:
        dockerfile = Path('Dockerfile').read_text()
        check('ARG RUNTIME_IMAGE=' + RUNTIME in dockerfile and 'ARG NODE_IMAGE=' + BUILDER in dockerfile and json.loads(Path('config/synthetic-build-trust.json').read_text()) is None, 'FROZEN_INPUTS_CHANGED')
        for name in ('Dockerfile','.dockerignore','pnpm-lock.yaml','package.json','pnpm-workspace.yaml','config/synthetic-build-trust.json','config/backend-build-scan-tools.json'):
            summary['inputs'][name] = sha(Path(name).read_bytes())
        pins = json.loads(Path('config/backend-build-scan-tools.json').read_text())['tools']
        bins = {}
        for name,pin in pins.items():
            selected=pin[arch]
            data=request('https://github.com/' + pin['repo'] + '/releases/download/v' + pin['version'] + '/' + selected['file'])
            check(sha(data) == selected['sha256'], 'TOOL_ARCHIVE_SUBSTITUTED')
            destination=root/name;destination.mkdir(mode=0o700)
            write(root/(name+'.tar.gz'),data);unpack_tools(data,destination)
            bins[name]=str(destination/name)
            version=ok(name+'-version',[bins[name],'version'] if name != 'trivy' else [bins[name],'--version'])
            check(pin['version'] in version.decode(), 'TOOL_VERSION_MISMATCH')
            summary.setdefault('toolArchives',{})[name]=dict(version=pin['version'],sha256=selected['sha256'])
        # Raw registry bytes only: hashes are checked before JSON parsing.
        headers={'Accept':'application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json'}
        registry='https://gcr.io/v2/distroless/nodejs24-debian13/'
        index_bytes=request(registry+'manifests/'+summary['inputIndex'],headers=headers)
        check('sha256:'+sha(index_bytes)==summary['inputIndex'],'INDEX_SUBSTITUTED')
        write(root/'vendor-index.json',index_bytes)
        selected=select_platform(json.loads(index_bytes),arch)
        manifest_bytes=request(registry+'manifests/'+selected['digest'],headers=headers);descriptor(manifest_bytes,selected)
        manifest=json.loads(manifest_bytes)
        layout=root/'base-oci';(layout/'blobs'/'sha256').mkdir(parents=True,mode=0o700)
        write(layout/'blobs'/'sha256'/selected['digest'][7:],manifest_bytes)
        check(isinstance(manifest.get('layers'),list) and 0<len(manifest['layers'])<100 and sum(d['size'] for d in manifest['layers'])<MAX_IMAGE,'LAYER_SET_INVALID')
        config_data=request(registry+'blobs/'+manifest['config']['digest']);descriptor(config_data,manifest['config'])
        config=json.loads(config_data);check(config.get('os')=='linux' and config.get('architecture')==arch and config.get('config',{}).get('User') in ('65532','65532:65532'),'BASE_CONFIG_INVALID')
        write(layout/'blobs'/'sha256'/manifest['config']['digest'][7:],config_data)
        packages={};uncompressed=0;inspection_deadline=time.monotonic()+900
        for d in manifest['layers']:
            check(shutil.disk_usage(root).free >= d['size'] + 2*1024**3, 'RUNNER_DISK_CAPACITY_EXHAUSTED')
            data=request(registry+'blobs/'+d['digest'],MAX_IMAGE);descriptor(data,d)
            write(layout/'blobs'/'sha256'/d['digest'][7:],data)
            with tarfile.open(fileobj=io.BytesIO(data),mode='r:*') as layer:
                count=0
                for m in layer:
                    count+=1;uncompressed+=m.size
                    check(count<=100000 and m.size<=MAX_IMAGE and uncompressed<=4*1024**3 and time.monotonic()<inspection_deadline,'LAYER_INSPECTION_BOUND')
                    name=member_safe(m)
                    if m.isfile() and name == 'nodejs/bin/node':
                        binary=layer.extractfile(m).read()
                        check(binary[:4] == b'\x7fELF' and binary[4:6] == b'\x02\x01' and int.from_bytes(binary[18:20],'little') == {'amd64':62,'arm64':183}[arch], 'NODE_STATIC_ARCHITECTURE_MISMATCH')
                        summary['nodeBinarySha256']=sha(binary)
                    if m.isfile() and name.startswith('var/lib/dpkg/status.d/'):
                        check(m.size<1024*1024,'PACKAGE_RECORD_BOUND')
                        text=layer.extractfile(m).read().decode()
                        name_match=re.search(r'^Package: (.+)$',text,re.M);version_match=re.search(r'^Version: (.+)$',text,re.M)
                        if name_match and version_match: packages[name_match[1]]=version_match[1]
        write(root/'static-packages.json',packages)
        summary['osPackages'] = {k:v for k,v in packages.items() if k in ('libc6','zlib1g') and re.fullmatch(r'[A-Za-z0-9_+.:~=-]{1,100}',v)}
        check('nodeBinarySha256' in summary, 'CURRENT_NODE_BINARY_BYTES_MISSING')
        summary['baseConfigDigest']=manifest['config']['digest'];summary['baseManifestDigest']=selected['digest'];summary['layerDigests']=[d['digest'] for d in manifest['layers']]
        write(layout/'index.json',dict(schemaVersion=2,manifests=[selected]));write(layout/'oci-layout',dict(imageLayoutVersion='1.0.0'))
        summary['base']='STATIC_INPUT_BYTES_VERIFIED'
        subject=manifest['config']['digest'];subject_env={'SYFT_CHECK_FOR_APP_UPDATE':'false','GRYPE_CHECK_FOR_APP_UPDATE':'false','GRYPE_DB_CACHE_DIR':str(root/'grype-db')}
        ok('sbom',[bins['syft'],'oci-dir:'+str(layout),'-o','spdx-json='+str(root/'sbom.json')],subject_env,subject)
        ok('trivy-db',[bins['trivy'],'image','--cache-dir',str(root/'trivy-db'),'--download-db-only'],subject_env,subject)
        ok('grype-db',[bins['grype'],'db','update'],subject_env,subject)
        t_version=json.loads(ok('trivy-database-version',[bins['trivy'],'--cache-dir',str(root/'trivy-db'),'--version','--format','json'],subject_env,subject))
        g_status=json.loads(ok('grype-database-status',[bins['grype'],'db','status','-o','json'],subject_env,subject))
        gp=Path(g_status.get('path',g_status.get('location','')));check(gp.is_absolute() and gp.resolve().is_relative_to(root) and g_status.get('valid') is True,'GRYPE_DATABASE_UNSAFE')
        gfiles=[gp] if gp.is_file() else list(gp.glob('vulnerability*.db'));check(len(gfiles)==1,'GRYPE_DATABASE_AMBIGUOUS')
        metadata={'trivy':dict(version=pins['trivy']['version'],databaseUpdatedAt=t_version['VulnerabilityDB']['UpdatedAt'],databaseSha256=sha((root/'trivy-db'/'db'/'trivy.db').read_bytes()),ignoreUnfixed=False,severityThreshold='HIGH'), 'grype':dict(version=pins['grype']['version'],databaseUpdatedAt=g_status['built'],databaseSha256=sha(gfiles[0].read_bytes()),ignoreUnfixed=False,severityThreshold='HIGH')}
        for value in metadata.values():
            parsed=dt.datetime.fromisoformat(value['databaseUpdatedAt'].replace('Z','+00:00'))
            check(parsed.tzinfo is not None, 'DATABASE_TIMESTAMP_INVALID')
            value['databaseUpdatedAt']=parsed.isoformat()
        write(root/'scanner-metadata.json',metadata);summary['scanners']=metadata
        commands=scanner_commands(root,layout,bins)
        summary['base']='SCANS_ATTEMPTED'
        t_exit,_=process('trivy',commands['trivy'],subject_env,subject=subject)
        g_exit,_=process('grype',commands['grype'],dict(subject_env,GRYPE_DB_AUTO_UPDATE='false'),subject=subject)
        summary['base']='REPORT_VALIDATION_ATTEMPTED'
        reports=capture_reports(root,subject,summary)
        trivy,grype,sbom=[reports[n] for n in ('trivy.json','grype.json','sbom.json')]
        blocked=scanner_policy(trivy,grype,sbom,subject,dict(trivy=t_exit,grype=g_exit),metadata)
        # Public input package identity must come from separately inspected vendor bytes.
        public_rows=[r for r in blocked if packages.get(r[2]) == r[3]]
        summary['blockingFindingCount']=len(blocked)
        summary['findings']=project_findings(public_rows)
        summary['unpublishedFindingCount']=len(blocked)-len(public_rows)
        if blocked:
            summary['result']='BACKEND_BUILD_SCAN_FINDINGS_CONFIRMED_BLOCKED';summary['base']='BLOCKING_FINDINGS_CONFIRMED'
        else:
            # OS evidence cannot establish bundled Node zlib source backports.
            # This qualification milestone stops at this specific unresolved input,
            # never builds an input whose required vendored applicability is unknown.
            summary['base']='SCANNER_CHECKS_PASS_VENDOR_APPLICABILITY_INCOMPLETE'
            summary['boundary']='NODE_BUNDLED_ZLIB_CURRENT_SOURCE_BACKPORT_EVIDENCE_REQUIRED'
            summary['productCaller']='NOT_IMPLEMENTED_PENDING_INPUT_QUALIFICATION'
    except Exception as error:
        code=str(error)
        summary['failure']=code if re.fullmatch(r'[A-Z][A-Z0-9_]{3,90}',code) else 'INPUT_OR_TOOL_PROCESS_FAILED'
    finally:
        summary['inspectionEnded']=stamp()
        try:
            check(not unsettled, 'PROCESS_GROUP_UNRECONCILED')
            validate_owner(root,parent,identity)
            shutil.rmtree(root)  # precisely owned root, after every child settled; no global pruning.
            summary['cleanupComplete']=not root.exists()
        except Exception:
            summary['cleanupComplete']=False
            summary['cleanupFailure']='OWNED_ROOT_RECONCILIATION_REQUIRED'
        summary['ended']=stamp()
        public=Path('backend-build-scan-result.json')
        write(public,summary)
        write(Path('backend-build-scan-public-manifest.json'),dict(classification=CLASSIFICATION,files=[dict(name=public.name,sha256=sha(public.read_bytes()),bytes=public.stat().st_size)]))
        print(CLASSIFICATION)
    return 1  # base-only or blocked/partial can never count as product qualification.

if __name__ == '__main__':
    try:
        raise SystemExit(run())
    except Exception:
        print('BUILD_SCAN_ONLY_NOT_ADMITTED_PREFLIGHT_REFUSED')
        raise SystemExit(1)
