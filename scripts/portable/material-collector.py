"""Collect exact prepared OCI material bytes; never execute/extract image files.

Only regular native files at declared paths are accepted. Ambiguous overlay
links or whiteouts fail closed. Originals remain in the private blob bundle.
"""
import gzip,hashlib,importlib.util,io,json,sys,tarfile,posixpath
from pathlib import Path

spec=importlib.util.spec_from_file_location('product_adapter',Path(__file__).with_name('product-scan-adapter.py'))
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
q=a.q

def origin_bytes(origin,read):
    raw=read(origin['archiveSha256']);q.check(q.sha(raw)==origin['archiveSha256'],'MATERIAL_ORIGIN_SUBSTITUTED')
    if origin['format']=='gzip':
        with gzip.GzipFile(fileobj=io.BytesIO(raw)) as stream:data=stream.read(256*1024*1024+1)
        q.check(len(data)<=256*1024*1024 and origin['member']=='','MATERIAL_ORIGIN_BOUND')
    else:
        q.check(origin['format']=='tar','MATERIAL_ORIGIN_FORMAT');found=[];total=0;count=0;seen=set()
        with tarfile.open(fileobj=io.BytesIO(raw),mode='r:*') as archive:
            for member in archive:
                count+=1;total+=member.size;q.check(count<=50000 and total<=512*1024*1024,'MATERIAL_ORIGIN_BOUND')
                name=q.member_safe(member)
                q.check(posixpath.normpath(name)==name and not name.startswith('/'),'MATERIAL_ORIGIN_PATH')
                q.check(name not in seen and not member.issym() and not member.islnk(),'MATERIAL_ORIGIN_DUPLICATE_OR_LINK');seen.add(name)
                if name==origin['member']:
                    q.check(member.isfile(),'MATERIAL_ORIGIN_LINK');found.append(archive.extractfile(member).read())
        q.check(len(found)==1,'MATERIAL_ORIGIN_MEMBER');data=found[0]
    q.check(q.sha(data)==origin['sha256'],'MATERIAL_ORIGIN_ASSOCIATION');return data

def verify_origins(origins,read,architecture):
    paths=set()
    for origin in origins:
        q.check(origin['path'] not in paths,'MATERIAL_ORIGIN_DUPLICATE');paths.add(origin['path'])
        data=origin_bytes(origin,read)
        q.check(len(data)>=64 and data[:6]==b'\x7fELF\x02\x01' and int.from_bytes(data[18:20],'little')=={'amd64':62,'arm64':183}[architecture],'MATERIAL_ORIGIN_ARCHITECTURE')
    return {'result':'MATERIAL_NATIVE_ORIGINS_VERIFIED','count':len(paths)}

def collect(root,proof,consume=False):
    layout=root/('inputs/dependencies' if consume else 'product-oci');read=lambda h:a.regular(root/'material-originals'/h,q.MAX_IMAGE)
    verify_origins(proof['origins'],read,proof['architecture'])
    manifest_raw=a.regular(layout/'blobs/sha256'/proof['manifest']);q.check(q.sha(manifest_raw)==proof['manifest'],'MATERIAL_MANIFEST_SUBSTITUTED');manifest=a.strict_json(manifest_raw)
    wanted={o['path']:o for o in proof['origins']};files={};native={};total=0
    fixed={'var/lib/dpkg/status','usr/local/bin/node'}
    def interesting(name):return name in fixed or name.startswith(('app/node_modules/','opt/nalanda-engines/','opt/nalanda-materials/receipts/'))
    ancestors={p.as_posix() for n in [*wanted,*fixed,'opt/nalanda-materials/receipts'] for p in __import__('pathlib').PurePosixPath(n).parents if str(p)!='.'}
    for descriptor in manifest['layers']:
        raw=a.regular(layout/'blobs/sha256'/descriptor['digest'][7:],q.MAX_IMAGE);q.descriptor(raw,descriptor)
        with tarfile.open(fileobj=io.BytesIO(raw),mode='r:*') as layer:
            count=0;seen=set()
            for member in layer:
                count+=1;total+=member.size;q.check(count<=100000 and total<=4*q.MAX_IMAGE,'MATERIAL_LAYER_BOUND');name=q.member_safe(member)
                q.check(posixpath.normpath(name)==name,'MATERIAL_LAYER_PATH')
                q.check(name not in seen,'MATERIAL_LAYER_DUPLICATE');seen.add(name)
                if name in ancestors:q.check(member.isdir(),'MATERIAL_LAYER_ANCESTOR')
                if posixpath.basename(name).startswith('.wh.'):
                    target=posixpath.dirname(name) if posixpath.basename(name)=='.wh..wh..opq' else posixpath.join(posixpath.dirname(name),posixpath.basename(name).removeprefix('.wh.'))
                    q.check(target and not interesting(target) and not any(n.startswith(target+'/') for n in [*files,*wanted,*fixed]),'MATERIAL_LAYER_WHITEOUT')
                    continue
                if not interesting(name):continue
                if name in wanted or name in fixed or name.startswith('opt/nalanda-materials/receipts/'):
                    q.check(not member.isdir(),'MATERIAL_FILE_REPLACED_BY_DIRECTORY')
                    q.check(member.isfile(),'MATERIAL_LAYER_LINK');data=layer.extractfile(member).read();files[name]=data
                elif member.isfile():
                    # Inspect every installed native executable/library, not
                    # just the names the submitter chose to inventory.
                    stream=layer.extractfile(member);header=stream.read(64)
                    if header.startswith(b'\x7fELF'):
                        q.check(name in wanted,'MATERIAL_UNCOVERED_NATIVE_FILE')
                if name in wanted:
                    data=files[name];q.check(q.sha(data)==wanted[name]['sha256'],'MATERIAL_INSTALLED_NATIVE_SUBSTITUTED');native[name]=data
    q.check(set(native)==set(wanted) and fixed<=set(files),'MATERIAL_INSTALLED_MATERIAL_MISSING')
    q.check(q.sha(files['usr/local/bin/node'])==proof['nodeSha256'],'MATERIAL_BUILDER_NODE_CHANGED')
    out=root/('material-verification' if consume else 'material-output')/'blobs';out.mkdir(parents=True,mode=0o700)
    def put(raw):
        if not isinstance(raw,bytes):raw=json.dumps(raw,separators=(',',':')).encode()
        h=q.sha(raw);f=out/h
        if not f.exists():q.write(f,raw)
        else:q.check(a.regular(f,q.MAX_IMAGE)==raw,'MATERIAL_BLOB_COLLISION')
        return h
    receipts={}
    for stage in ('fetch','install','store'):
        prefix='opt/nalanda-materials/receipts/'+stage
        p=a.strict_json(files[prefix+'.json']);q.check(set(p)=={'exit','signal','timedOut','settled','stdout','stderr'} and p['exit']==0 and p['signal'] is None and p['timedOut'] is False and p['settled'] is True,'MATERIAL_PREPARATION_FAILED')
        q.check(put(files[prefix+'.stdout'])==p['stdout'] and put(files[prefix+'.stderr'])==p['stderr'],'MATERIAL_PREPARATION_OUTPUT_SUBSTITUTED');receipts[stage]=p
    replay=a.strict_json(files['opt/nalanda-materials/receipts/replay.json']);q.check(set(replay)=={'requests','denied'} and replay['denied']==0 and len(replay['requests'])<=100000,'MATERIAL_UNDECLARED_REPLAY_REQUEST')
    allowed={e['url']:e['sha256'] for e in proof['replay']}
    for url,h in list(allowed.items()):
        if '/@' in url and url.count('/')==4:
            for slash in ('%2f','%2F'):allowed[url.rsplit('/',1)[0]+slash+url.rsplit('/',1)[1]]=h
    q.check(all(set(r)=={'url','sha256'} and allowed.get(r['url'])==r['sha256'] for r in replay['requests']),'MATERIAL_REPLAY_SUBSTITUTED')
    inventory={'architecture':proof['architecture'],'lifecyclePackages':['@prisma/client','@prisma/engines','esbuild','prisma','sharp'],'files':[{'path':n,'sha256':put(data),'origin':put(wanted[n])} for n,data in sorted(native.items())],'installedStatus':put(files['var/lib/dpkg/status']),'baseInstalledStatus':proof['baseInstalledStatus']}
    result={'nativeInventory':put(inventory),'receipts':receipts,'replay':put(replay),'installedStatus':inventory['installedStatus']}
    q.write(root/('material-consumption-result.json' if consume else 'material-collection-result.json'),json.dumps(result,separators=(',',':')).encode());return result

if __name__=='__main__':
    try:
        root=Path(sys.argv[2]);proof=a.strict_json(a.regular(root/('material-origin-check.json' if sys.argv[1]=='origins' else 'material-collection.json')))
        q.check(sys.argv[1] in ('origins','collect','consume'),'MATERIAL_COLLECTOR_ACTION')
        if sys.argv[1]=='origins':result=verify_origins(proof['origins'],lambda h:a.regular(root/'material-originals'/h,q.MAX_IMAGE),proof['architecture'])
        else:result=collect(root,proof,sys.argv[1]=='consume')
        print(json.dumps(result,separators=(',',':')))
    except Exception as e:
        code=str(e);print(code if code.isupper() and len(code)<100 else 'MATERIAL_COLLECTION_REFUSED',file=sys.stderr);sys.exit(1)
