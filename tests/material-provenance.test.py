"""HARNESS_ONLY offline fixtures. VALIDSIG text is a gpgv stand-in, not vendor trust."""
import datetime as dt,gzip,hashlib,importlib.util,io,json,tarfile,tempfile,unittest,shutil,subprocess,os
from pathlib import Path
def load(name,file):
    s=importlib.util.spec_from_file_location(name,file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
p=load('provenance','scripts/portable/material-provenance.py')
c=load('collector','scripts/portable/material-collector.py')
sha=lambda b:hashlib.sha256(b).hexdigest()
class Debian(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='NPS-HARNESS_ONLY-');self.root=Path(self.temp.name);(self.root/'0').mkdir();(self.root/'debs').mkdir();self.now=dt.datetime.now(dt.timezone.utc);self.signer='A'*40
        self.status=lambda n,v='1',a='amd64':f'Package: {n}\nStatus: install ok installed\nVersion: {v}\nArchitecture: {a}\n\n'
        (self.root/'base-installed-status').write_text(self.status('base'));(self.root/'installed-status').write_text(''.join(self.status(n) for n in ('base','openssl','ca-certificates')))
        packages=[];rows=[]
        for name in ('openssl','ca-certificates'):
            raw=('TEST ONLY '+name).encode();h=sha(raw);(self.root/'debs'/h).write_bytes(raw);filename='pool/'+name+'.deb';packages.append(dict(name=name,version='1',release=0,sha256=h,filename=filename));rows.append(f'Package: {name}\nVersion: 1\nArchitecture: amd64\nSHA256: {h}\nSize: {len(raw)}\nFilename: {filename}\n\n')
        raw=gzip.compress(''.join(rows).encode());(self.root/'0/Packages.gz').write_bytes(raw)
        self.release=f"Codename: bookworm\nArchitectures: amd64\nDate: {(self.now-dt.timedelta(minutes=2)).strftime('%a, %d %b %Y %H:%M:%S %z')}\nValid-Until: {(self.now+dt.timedelta(hours=1)).strftime('%a, %d %b %Y %H:%M:%S %z')}\nSHA256:\n {sha(raw)} {len(raw)} main/binary-amd64/Packages.gz\n"
        (self.root/'0/Release').write_text(self.release);(self.root/'0/gpgv-status').write_text('[GNUPG:] VALIDSIG '+self.signer+' HARNESS_ONLY\n')
        self.proof=dict(architecture='amd64',snapshot=(self.now-dt.timedelta(minutes=1)).strftime('%Y%m%dT%H%M%SZ'),phase='installed',signers=[self.signer],releases=[{'path':'main/binary-amd64/Packages.gz'}],packages=packages)
    def tearDown(self):self.temp.cleanup()
    def verify(self):return p.verify(self.root,self.proof)
    def test_positive_chain_and_archives_phase(self):
        self.assertEqual(self.verify()['packages'],2);self.proof['phase']='archives';self.assertEqual(self.verify()['result'],'AUTHENTICATED_DEBIAN_ARCHIVES_VERIFIED')
    def test_wrong_key(self):
        self.proof['signers']=['B'*40]
        with self.assertRaisesRegex(ValueError,'SIGNATURE'):self.verify()
    def test_bad_signature_even_with_valid_line(self):
        with (self.root/'0/gpgv-status').open('a') as f:f.write('[GNUPG:] BADSIG bad\n')
        with self.assertRaisesRegex(ValueError,'SIGNATURE'):self.verify()
    def test_wrong_index(self):
        (self.root/'0/Packages.gz').write_bytes(b'tampered')
        with self.assertRaisesRegex(ValueError,'PACKAGES_NOT_SIGNED'):self.verify()
    def test_wrong_archive(self):
        (self.root/'debs'/self.proof['packages'][0]['sha256']).write_bytes(b'tampered')
        with self.assertRaisesRegex(ValueError,'DEB_NOT_SIGNED'):self.verify()
    def test_wrong_platform(self):
        self.proof['architecture']='arm64'
        with self.assertRaisesRegex(ValueError,'RELEASE_SUBJECT'):self.verify()
    def test_uncovered_added_package(self):
        with (self.root/'installed-status').open('a') as f:f.write(self.status('uncovered'))
        with self.assertRaisesRegex(ValueError,'UNCOVERED_PACKAGE_CHANGE'):self.verify()
    def test_uncovered_changed_base(self):
        s=(self.root/'installed-status').read_text().replace(self.status('base'),self.status('base','2'));(self.root/'installed-status').write_text(s)
        with self.assertRaisesRegex(ValueError,'UNCOVERED_PACKAGE_CHANGE'):self.verify()
    def test_removed_base(self):
        s=(self.root/'installed-status').read_text().replace(self.status('base'),'');(self.root/'installed-status').write_text(s)
        with self.assertRaisesRegex(ValueError,'PACKAGE_REMOVAL'):self.verify()
    def test_wrong_installed_version(self):
        self.proof['packages'][0]['version']='2'
        with self.assertRaisesRegex(ValueError,'DESCRIPTOR_AMBIGUOUS'):self.verify()
    def test_expired_now_not_only_at_snapshot(self):
        lines=self.release.splitlines();lines=[('Valid-Until: '+(self.now-dt.timedelta(seconds=20)).strftime('%a, %d %b %Y %H:%M:%S %z')) if x.startswith('Valid-Until:') else x for x in lines];(self.root/'0/Release').write_text('\n'.join(lines)+'\n')
        with self.assertRaisesRegex(ValueError,'RELEASE_EXPIRED'):self.verify()
    def test_missing_validity_has_no_invented_exception(self):
        (self.root/'0/Release').write_text('\n'.join(x for x in self.release.splitlines() if not x.startswith('Valid-Until:'))+'\n')
        with self.assertRaisesRegex(ValueError,'VALIDITY_UNPROVEN'):self.verify()
    def test_snapshot_before_signed_release(self):
        self.proof['snapshot']=(self.now-dt.timedelta(days=1)).strftime('%Y%m%dT%H%M%SZ')
        with self.assertRaisesRegex(ValueError,'AFTER_SNAPSHOT'):self.verify()
    def test_duplicate_package(self):
        self.proof['packages'].append(self.proof['packages'][0])
        with self.assertRaisesRegex(ValueError,'DEB_DUPLICATE'):self.verify()
    def test_duplicate_status(self):
        with (self.root/'installed-status').open('a') as f:f.write(self.status('openssl'))
        with self.assertRaisesRegex(ValueError,'INSTALLED_DUPLICATE'):self.verify()
    def test_real_synthetic_gpgv_chain_and_signature_tamper(self):
        gpg=shutil.which('gpg') or r'C:\Program Files\Git\usr\bin\gpg.exe';gpgv=shutil.which('gpgv') or r'C:\Program Files\Git\usr\bin\gpgv.exe'
        if not Path(gpg).is_file() or not Path(gpgv).is_file():self.skipTest('No installed gpg/gpgv; vendor trust remains NOT_EXECUTED')
        home=self.root/'test-key-home';home.mkdir()
        def argument(value):return '/'+value[0].lower()+value[2:].replace('\\','/') if os.name=='nt' and 'Git' in gpg and len(value)>2 and value[1]==':' else value
        env={**os.environ,'GNUPGHOME':argument(str(home))}
        def command(tool,args,**kw):
            result=subprocess.run([tool,*map(argument,args)],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=20,**kw)
            if result.returncode:raise subprocess.CalledProcessError(result.returncode,[tool],output=result.stdout,stderr=result.stderr)
            return result
        try:
            try:command(gpg,['--batch','--pinentry-mode','loopback','--passphrase','','--quick-gen-key','HARNESS_ONLY <test@example.invalid>','ed25519','sign','1d'])
            except subprocess.CalledProcessError as e:raise RuntimeError(e.stderr.decode(errors='replace')) from e
            listing=command(gpg,['--batch','--with-colons','--list-keys']).stdout.decode();fingerprint=next(x.split(':')[9] for x in listing.splitlines() if x.startswith('fpr:'))
            keyring=self.root/'fixture-keyring.gpg';keyring.write_bytes(command(gpg,['--batch','--export',fingerprint]).stdout)
            signed=self.root/'InRelease';command(gpg,['--batch','--pinentry-mode','loopback','--passphrase','','--output',str(signed),'--clearsign',str(self.root/'0/Release')])
            decoded=self.root/'decoded';result=command(gpgv,['--homedir',str(home),'--keyring',str(keyring),'--status-fd','1','--output',str(decoded),str(signed)])
            (self.root/'0/Release').write_bytes(decoded.read_bytes());(self.root/'0/gpgv-status').write_bytes(result.stdout);self.proof['signers']=[fingerprint];self.assertEqual(self.verify()['packages'],2)
            signed.write_bytes(signed.read_bytes().replace(b'Codename: bookworm',b'Codename: tampered'))
            with self.assertRaises(subprocess.CalledProcessError):command(gpgv,['--homedir',str(home),'--keyring',str(keyring),str(signed)])
        finally:
            conf=Path(gpg).with_name('gpgconf.exe' if os.name=='nt' else 'gpgconf')
            if conf.is_file():subprocess.run([str(conf),'--homedir',argument(str(home)),'--kill','gpg-agent'],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=10,check=False)
class Origins(unittest.TestCase):
    def data(self):
        b=bytearray(64);b[:6]=b'\x7fELF\x02\x01';b[18]=62;return bytes(b)
    def run_origin(self,entries,format='tar',arch='amd64'):
        output=io.BytesIO()
        with tarfile.open(fileobj=output,mode='w') as t:
            for name,kind in entries:
                m=tarfile.TarInfo(name);m.type=kind;m.size=len(self.data()) if kind==tarfile.REGTYPE else 0;m.linkname='../escape' if kind!=tarfile.REGTYPE else '';t.addfile(m,io.BytesIO(self.data()) if m.size else None)
        raw=gzip.compress(self.data()) if format=='gzip' else output.getvalue();h=sha(raw);o=dict(path='app/node_modules/test',format=format,member='' if format=='gzip' else 'package/native',archiveSha256=h,sha256=sha(self.data()))
        return c.verify_origins([o],lambda _:raw,arch)
    def test_positive_tar_and_gzip(self):
        self.assertEqual(self.run_origin([('package/native',tarfile.REGTYPE)])['count'],1);self.assertEqual(self.run_origin([],format='gzip')['count'],1)
    def test_duplicate_members(self):
        with self.assertRaisesRegex(ValueError,'DUPLICATE'):self.run_origin([('package/native',tarfile.REGTYPE)]*2)
    def test_traversal(self):
        with self.assertRaises(ValueError):self.run_origin([('../outside',tarfile.REGTYPE)])
    def test_symlink(self):
        with self.assertRaises(ValueError):self.run_origin([('package/native',tarfile.SYMTYPE)])
    def test_hardlink(self):
        with self.assertRaises(ValueError):self.run_origin([('package/native',tarfile.LNKTYPE)])
    def test_wrong_platform(self):
        with self.assertRaisesRegex(ValueError,'ARCHITECTURE'):self.run_origin([('package/native',tarfile.REGTYPE)],arch='arm64')
    def test_missing_member(self):
        with self.assertRaisesRegex(ValueError,'MEMBER'):self.run_origin([('package/other',tarfile.REGTYPE)])
    def test_noncanonical_path(self):
        with self.assertRaisesRegex(ValueError,'PATH'):self.run_origin([('package/./native',tarfile.REGTYPE)])
    def test_collect_and_consume_reject_later_directory_replacing_file(self):
        for consume in (False,True):
            for protected in ('opt/nalanda-engines/query-engine.node','usr/local/bin/node','var/lib/dpkg/status','opt/nalanda-materials/receipts/install.json'):
                with self.subTest(consume=consume,path=protected),tempfile.TemporaryDirectory(prefix='NPS-HARNESS_ONLY-overlay-') as temp:
                    root=Path(temp);originals=root/'material-originals';originals.mkdir();native=self.data();archive=gzip.compress(native);(originals/sha(archive)).write_bytes(archive)
                    origin=dict(path='opt/nalanda-engines/query-engine.node',format='gzip',member='',archiveSha256=sha(archive),sha256=sha(native));layers=[]
                    for directory in (False,True):
                        out=io.BytesIO()
                        with tarfile.open(fileobj=out,mode='w') as t:
                            m=tarfile.TarInfo(protected);m.type=tarfile.DIRTYPE if directory else tarfile.REGTYPE;m.size=0 if directory else len(native);t.addfile(m,None if directory else io.BytesIO(native))
                        layers.append(out.getvalue())
                    manifest=json.dumps({'layers':[{'digest':'sha256:'+sha(b),'size':len(b)} for b in layers]}).encode();layout=root/('inputs/dependencies' if consume else 'product-oci')/'blobs/sha256';layout.mkdir(parents=True)
                    for b in [*layers,manifest]:(layout/sha(b)).write_bytes(b)
                    proof=dict(origins=[origin],architecture='amd64',manifest=sha(manifest),nodeSha256=sha(native),baseInstalledStatus=sha(b''))
                    with self.assertRaisesRegex(ValueError,'FILE_REPLACED_BY_DIRECTORY'):c.collect(root,proof,consume)
if __name__=='__main__':unittest.main()
