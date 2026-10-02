"""HARNESS_ONLY controls; no scanner, container, network or admission execution."""
import importlib.util
import io
import json
import tarfile
import tempfile
import unittest
from unittest.mock import patch, MagicMock
from pathlib import Path
spec=importlib.util.spec_from_file_location('qualification','scripts/portable/backend-build-scan.py')
q=importlib.util.module_from_spec(spec);spec.loader.exec_module(q)
class QualificationTests(unittest.TestCase):
    def test_substituted_descriptor(self):
        with self.assertRaisesRegex(ValueError,'DESCRIPTOR_SUBSTITUTED'):q.descriptor(b'{}',{'digest':'sha256:'+'0'*64,'size':2})
    def test_wrong_architecture(self):
        with self.assertRaisesRegex(ValueError,'ARCHITECTURE_AMBIGUOUS'):q.select_platform({'manifests':[{'platform':{'os':'linux','architecture':'amd64'}}]},'arm64')
    def test_ambiguous_platform(self):
        d={'platform':{'os':'linux','architecture':'amd64'}}
        with self.assertRaises(ValueError):q.select_platform({'manifests':[d,d]},'amd64')
    def test_path_traversal(self):
        for name in ('../x','a/../../x','/tmp/x','a\\b'):
            with self.subTest(name=name),self.assertRaises(ValueError):q.member_safe(tarfile.TarInfo(name))
    def test_unsafe_links(self):
        m=tarfile.TarInfo('x');m.type=tarfile.SYMTYPE;m.linkname='../escape'
        with self.assertRaisesRegex(ValueError,'ARCHIVE_LINK_UNSAFE'):q.member_safe(m)
        m.linkname='safe'
        with self.assertRaisesRegex(ValueError,'ARCHIVE_TYPE_UNSAFE'):q.member_safe(m,True)
    def test_safe_image_link_never_extracted(self):
        m=tarfile.TarInfo('usr/lib/x');m.type=tarfile.SYMTYPE;m.linkname='/lib/safe';self.assertEqual(q.member_safe(m),'usr/lib/x')
    def test_tool_archive_refuses_link(self):
        raw=io.BytesIO()
        with tarfile.open(fileobj=raw,mode='w:gz') as a:
            m=tarfile.TarInfo('tool');m.type=tarfile.SYMTYPE;m.linkname='other';a.addfile(m)
        with tempfile.TemporaryDirectory() as t,self.assertRaises(ValueError):q.unpack_tools(raw.getvalue(),Path(t))
    def test_malformed_truncated_report(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/'report';p.write_text('{')
            with self.assertRaises(json.JSONDecodeError):q.read_json(p)
    def test_private_finding_rejected(self):
        for row in [('grype','CVE-2026-5435','password=secret with space','1','HIGH'),('grype','private/token','libc6','1','HIGH')]:
            with self.subTest(row=row),self.assertRaises(ValueError):q.project_findings([row])
    def test_finding_bound(self):
        with self.assertRaisesRegex(ValueError,'PUBLIC_FINDING_BOUND'):q.project_findings([('grype','CVE-2026-5435','libc6','1','HIGH')]*101)
    def test_cleanup_foreign_marker(self):
        with tempfile.TemporaryDirectory() as t:
            parent=Path(t).resolve();root=parent/'owned';root.mkdir();q.write(root/'owner.json',{'source':'foreign'})
            with self.assertRaisesRegex(ValueError,'CLEANUP_OWNER_MISMATCH'):q.validate_owner(root,parent,{'source':'expected'})
            self.assertTrue(root.exists())
    def test_cleanup_escape(self):
        with tempfile.TemporaryDirectory() as t,self.assertRaisesRegex(ValueError,'CLEANUP_PATH_UNSAFE'):q.validate_owner(Path(t).resolve(),Path(t).resolve(),{})
    def fixtures(self):
        now=q.stamp();digest='sha256:'+'1'*64
        t={'SchemaVersion':2,'Metadata':{'ImageID':digest},'Results':[{'Class':'os-pkgs','Target':'vendor-base','Type':'debian','Vulnerabilities':[]}]}
        g={'source':{'target':{'imageID':digest}},'matches':[],'descriptor':{'version':'0.110.0'}}
        s={'spdxVersion':'SPDX-2.3','packages':[{'name':'node'}]}
        m={k:{'version':v,'databaseUpdatedAt':now,'databaseSha256':'2'*64,'ignoreUnfixed':False,'severityThreshold':'HIGH'} for k,v in [('trivy','0.70.0'),('grype','0.110.0')]}
        return t,g,s,digest,{'trivy':0,'grype':0},m
    def test_subject_substitution(self):
        t,g,s,d,e,m=self.fixtures();t['Metadata']['ImageID']='sha256:'+'3'*64
        with self.assertRaisesRegex(ValueError,'TRIVY_SUBJECT'):q.scanner_policy(t,g,s,d,e,m)
    def test_scanner_failure(self):
        t,g,s,d,e,m=self.fixtures();e['grype']=2
        with self.assertRaisesRegex(ValueError,'SCANNER_PROCESS_FAILED'):q.scanner_policy(t,g,s,d,e,m)
    def test_ignored_unknown_prohibited(self):
        t,g,s,d,e,m=self.fixtures();g['ignoredMatches']=[{'vulnerability':{'id':'CVE-2026-5435','severity':'Unknown'},'artifact':{'name':'libc6','version':'2'}}]
        self.assertEqual(len(q.scanner_policy(t,g,s,d,e,m)),1)
    def test_nonzero_without_findings(self):
        t,g,s,d,e,m=self.fixtures();e['trivy']=1
        with self.assertRaisesRegex(ValueError,'SCANNER_FAILURE_WITHOUT'):q.scanner_policy(t,g,s,d,e,m)
    def test_missing_scope(self):
        t,g,s,d,e,m=self.fixtures();t['Results']=[{'Class':'lang-pkgs','Target':'package.json'}]
        with self.assertRaisesRegex(ValueError,'OS_COVERAGE_MISSING'):q.scanner_policy(t,g,s,d,e,m)
    def test_stale_database(self):
        t,g,s,d,e,m=self.fixtures();m['grype']['databaseUpdatedAt']='2000-01-01T00:00:00Z'
        with self.assertRaisesRegex(ValueError,'DATABASE_STALE'):q.scanner_policy(t,g,s,d,e,m)
    def test_no_launch_or_admission_and_source_guard(self):
        source=Path('scripts/portable/backend-build-scan.py').read_text()
        self.assertNotIn('admit-artifact',source);self.assertNotIn('docker run',source);self.assertNotIn('compose',source)
        self.assertIn('COMMITTED_CLEAN_SOURCE_REQUIRED',source);self.assertIn('FROZEN_INPUTS_CHANGED',source)
        workflow=Path('.github/workflows/portable-staging-foundation.yml').read_text()
        self.assertIn('fail-fast: false',workflow);self.assertIn("github.event.pull_request.number == 28",workflow)
        self.assertIn('raise SystemExit(run())',source)
    def test_one_scanner_finding_cannot_excuse_other_failure(self):
        t,g,s,d,e,m=self.fixtures();e['trivy']=1
        g['matches']=[{'vulnerability':{'id':'CVE-2026-5435','severity':'High'},'artifact':{'name':'libc6','version':'2'}}]
        with self.assertRaisesRegex(ValueError,'SCANNER_FAILURE_WITHOUT'):q.scanner_policy(t,g,s,d,e,m)
    def test_cleanup_refuses_descendant_hardlink(self):
        import os
        with tempfile.TemporaryDirectory() as t:
            parent=Path(t).resolve();root=parent/'owned';root.mkdir();identity={'source':'expected'};q.write(root/'owner.json',identity)
            (root/'one').write_text('x');os.link(root/'one',root/'two')
            with patch.object(q.os,'getuid',return_value=root.stat().st_uid,create=True),self.assertRaisesRegex(ValueError,'CLEANUP_DESCENDANT_UNSAFE'):q.validate_owner(root,parent,identity)
            self.assertTrue(root.exists())
    def test_process_timeout_is_private_and_settled(self):
        class Child:
            pid=999999
            returncode=0
            def poll(self):return None
            def wait(self,timeout=None):return 0
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);summary={'processes':[]};unsettled=set();fn=q.private_process(root,summary,unsettled)
            original=Path.iterdir
            def iterate(p):return iter([]) if p.name=='proc' else original(p)
            with patch.object(q.subprocess,'Popen',return_value=Child()),patch.object(q.os,'killpg',side_effect=ProcessLookupError,create=True),patch.object(Path,'iterdir',iterate),patch.object(q.time,'sleep'):
                with self.assertRaisesRegex(ValueError,'PROCESS_BOUND_OR_TIMEOUT'):fn('timeout',['mock-tool'],timeout=0)
            self.assertFalse(unsettled);self.assertEqual(summary['processes'][0]['exit'],0)
            self.assertTrue((root/'1.receipt.json').exists())
    def test_process_overflow_and_raw_stderr_redaction(self):
        class Child:
            pid=999999
            returncode=2
            def poll(self):return None
            def wait(self,timeout=None):return 2
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);summary={'processes':[]};unsettled=set();fn=q.private_process(root,summary,unsettled)
            def spawn(*args,**kwargs):kwargs['stderr'].write(b'PRIVATE_MARKER_MUST_STAY_PRIVATE');kwargs['stderr'].flush();return Child()
            original=Path.iterdir
            def iterate(p):return iter([]) if p.name=='proc' else original(p)
            with patch.object(q.subprocess,'Popen',side_effect=spawn),patch.object(q.os,'killpg',side_effect=ProcessLookupError,create=True),patch.object(Path,'iterdir',iterate),patch.object(q.time,'sleep'),patch.object(q,'PRIVATE_LIMIT',8):
                with self.assertRaisesRegex(ValueError,'PROCESS_BOUND_OR_TIMEOUT'):fn('overflow',['mock-tool'])
            self.assertNotIn('PRIVATE_MARKER',json.dumps(summary));self.assertNotIn('PRIVATE_MARKER',(root/'1.receipt.json').read_text());self.assertFalse(unsettled)
    def test_process_normal_nonzero_preserved_and_temp_owned(self):
        class Child:
            pid=999999
            returncode=2
            def poll(self):return 2
            def wait(self,timeout=None):return 2
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);summary={'processes':[]};unsettled=set();fn=q.private_process(root,summary,unsettled);seen={}
            def spawn(*args,**kwargs):seen.update(kwargs['env']);kwargs['stderr'].write(b'PRIVATE_MARKER');return Child()
            original=Path.iterdir
            def iterate(p):return iter([]) if p.name=='proc' else original(p)
            with patch.object(q.subprocess,'Popen',side_effect=spawn),patch.object(q.os,'killpg',side_effect=ProcessLookupError,create=True),patch.object(Path,'iterdir',iterate):
                code,_=fn('failure',['mock-tool'])
            self.assertEqual(code,2);self.assertFalse(unsettled);self.assertNotIn('PRIVATE_MARKER',json.dumps(summary))
            for k in ('HOME','TMPDIR','XDG_CACHE_HOME','SYFT_CACHE_DIR'):self.assertTrue(Path(seen[k]).is_relative_to(root))
    def test_missing_source_preflight_executed(self):
        env={'GITHUB_ACTIONS':'true','RUNNER_ENVIRONMENT':'github-hosted','RUNNER_OS':'Linux','GITHUB_REPOSITORY':'vsairohith67/nalanda-school-erp','PORTABLE_CI_EXCEPTION':'OWNER_AUTHORIZED','EXPECTED_SHA':'','TARGET_ARCHITECTURE':'amd64'}
        with patch.dict(q.os.environ,env,clear=True),patch.object(q.platform,'system',return_value='Linux'),patch.object(q.os,'getuid',return_value=1000,create=True),self.assertRaisesRegex(ValueError,'SOURCE_OR_NATIVE_ARCHITECTURE_INVALID'):q.run()
    def test_substituted_source_preflight_executed(self):
        env={'GITHUB_ACTIONS':'true','RUNNER_ENVIRONMENT':'github-hosted','RUNNER_OS':'Linux','GITHUB_REPOSITORY':'vsairohith67/nalanda-school-erp','PORTABLE_CI_EXCEPTION':'OWNER_AUTHORIZED','EXPECTED_SHA':'a'*40,'TARGET_ARCHITECTURE':'amd64','GITHUB_RUN_ID':'1','GITHUB_RUN_ATTEMPT':'1','GITHUB_JOB':'backend-build-scan'}
        with patch.dict(q.os.environ,env,clear=True),patch.object(q.platform,'system',return_value='Linux'),patch.object(q.platform,'machine',return_value='x86_64'),patch.object(q.os,'getuid',return_value=1000,create=True),patch.object(q.subprocess,'check_output',return_value=b'b'*40),self.assertRaisesRegex(ValueError,'COMMITTED_CLEAN_SOURCE_REQUIRED'):q.run()
    def test_structurally_truncated_valid_json_refused(self):
        for result in ({'Class':'os-pkgs'},None):
            t,g,s,d,e,m=self.fixtures();t['Results']=[result]
            with self.subTest(result=result),self.assertRaisesRegex(ValueError,'TRIVY_RESULT_INVALID'):q.scanner_policy(t,g,s,d,e,m)
if __name__=='__main__':unittest.main()
