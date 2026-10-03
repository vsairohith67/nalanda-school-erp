"""Offline Debian metadata linkage, after qualified gpgv authenticated Release.

No network, installation or runtime launch. Source caller pins every staged byte.
"""
import gzip,hashlib,json,re,sys,datetime,email.utils
from pathlib import Path

def check(value,code):
    if not value:raise ValueError(code)
def sha(data):return hashlib.sha256(data).hexdigest()
def paragraphs(raw):
    check(len(raw)<=64*1024*1024,'MATERIAL_METADATA_BOUND')
    result=[]
    for text in raw.decode('utf-8','strict').replace('\r\n','\n').strip().split('\n\n'):
        fields={};last=None
        for line in text.splitlines():
            if line.startswith((' ','\t')):
                check(last is not None,'MATERIAL_METADATA_CONTINUATION');fields[last]+='\n'+line
            else:
                key,sep,value=line.partition(':');check(sep and key not in fields,'MATERIAL_METADATA_DUPLICATE');fields[key]=value.strip();last=key
        result.append(fields)
    return result
def verify(root,proof):
    installed=paragraphs((root/'installed-status').read_bytes())
    installed_by_name={p['Package']:p for p in installed if p.get('Status')=='install ok installed'}
    check(len(installed_by_name)==len([p for p in installed if p.get('Status')=='install ok installed']),'MATERIAL_INSTALLED_DUPLICATE')
    base=paragraphs((root/'base-installed-status').read_bytes())
    base_by_name={p['Package']:p for p in base if p.get('Status')=='install ok installed'}
    check(len(base_by_name)==len([p for p in base if p.get('Status')=='install ok installed']),'MATERIAL_BASE_INSTALLED_DUPLICATE')
    snapshot=datetime.datetime.strptime(proof['snapshot'],'%Y%m%dT%H%M%SZ').replace(tzinfo=datetime.timezone.utc)
    check(snapshot<=datetime.datetime.now(datetime.timezone.utc),'MATERIAL_SNAPSHOT_FUTURE')
    phase=proof.get('phase','installed');check(phase in ('archives','installed'),'MATERIAL_PROVENANCE_PHASE')
    seen=set()
    for i,release in enumerate(proof['releases']):
        directory=root/str(i)
        status=(directory/'gpgv-status').read_text()
        signers=re.findall(r'^\[GNUPG:\] VALIDSIG ([A-F0-9]{40,64}) ',status,re.M)
        check(signers and all(s in proof['signers'] for s in signers) and not re.search(r'\b(?:BADSIG|ERRSIG|REVKEYSIG|EXPKEYSIG|EXPSIG)\b',status),'MATERIAL_DEBIAN_SIGNATURE_REJECTED')
        fields=paragraphs((directory/'Release').read_bytes());check(len(fields)==1,'MATERIAL_RELEASE_INVALID');fields=fields[0]
        check(fields.get('Codename') in ('bookworm','bookworm-security') and proof['architecture'] in fields.get('Architectures','').split(),'MATERIAL_RELEASE_SUBJECT')
        dated=email.utils.parsedate_to_datetime(fields['Date'])
        check(dated.tzinfo is not None and dated<=snapshot,'MATERIAL_RELEASE_AFTER_SNAPSHOT')
        # There is no registered historical-snapshot/undated-validity exception.
        # Evaluate the real clock, never the snapshot as a substitute for now.
        check('Valid-Until' in fields,'MATERIAL_RELEASE_VALIDITY_UNPROVEN')
        expires=email.utils.parsedate_to_datetime(fields['Valid-Until'])
        check(expires.tzinfo is not None and dated<expires and snapshot<expires and datetime.datetime.now(datetime.timezone.utc)<expires,'MATERIAL_RELEASE_EXPIRED')
        hashes={}
        for row in fields.get('SHA256','').splitlines():
            parts=row.split()
            if not parts:continue
            check(len(parts)==3 and re.fullmatch('[a-f0-9]{64}',parts[0]) and parts[1].isdigit() and parts[2] not in hashes,'MATERIAL_RELEASE_HASH_TABLE')
            hashes[parts[2]]=(parts[0],int(parts[1]))
        raw=(directory/'Packages.gz').read_bytes();check(hashes.get(release['path'])==(sha(raw),len(raw)),'MATERIAL_PACKAGES_NOT_SIGNED')
        with gzip.GzipFile(fileobj=__import__('io').BytesIO(raw)) as stream:
            expanded=stream.read(64*1024*1024+1)
        packages=paragraphs(expanded)
        for expected in proof['packages']:
            if expected['release']!=i:continue
            matches=[p for p in packages if p.get('Package')==expected['name'] and p.get('Version')==expected['version'] and p.get('Architecture') in (proof['architecture'],'all')]
            check(len(matches)==1,'MATERIAL_DEB_DESCRIPTOR_AMBIGUOUS');p=matches[0]
            deb=(root/'debs'/expected['sha256']).read_bytes()
            check(p.get('SHA256')==expected['sha256']==sha(deb) and p.get('Size')==str(len(deb)) and p.get('Filename')==expected['filename'],'MATERIAL_DEB_NOT_SIGNED')
            if phase=='installed':
                actual=installed_by_name.get(expected['name'],{})
                check(actual.get('Version')==expected['version'] and actual.get('Architecture')==p.get('Architecture'),'MATERIAL_DEB_NOT_INSTALLED')
            check(expected['name'] not in seen,'MATERIAL_DEB_DUPLICATE');seen.add(expected['name'])
    check(len(seen)==len(proof['packages']) and {'openssl','ca-certificates'}<=seen,'MATERIAL_DEB_CLOSURE_MISSING')
    if phase=='installed':
        check(set(base_by_name)<=set(installed_by_name),'MATERIAL_UNDECLARED_PACKAGE_REMOVAL')
        changed={n for n,p in installed_by_name.items() if n not in base_by_name or any(p.get(k)!=base_by_name[n].get(k) for k in ('Version','Architecture'))}
        check(changed<=seen,'MATERIAL_UNCOVERED_PACKAGE_CHANGE')
    return {'result':'AUTHENTICATED_DEBIAN_ARCHIVES_VERIFIED' if phase=='archives' else 'AUTHENTICATED_DEBIAN_BYTES_AND_INSTALLED_VERSIONS_VERIFIED','packages':len(seen)}
if __name__=='__main__':
    try:
        root=Path(sys.argv[1]);print(json.dumps(verify(root,json.loads((root/'proof.json').read_bytes()))))
    except Exception:
        print('MATERIAL_PROVENANCE_REFUSED',file=sys.stderr);sys.exit(1)
