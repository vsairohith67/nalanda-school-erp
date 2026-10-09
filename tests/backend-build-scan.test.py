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
    def test_current_policy_block_still_stops_at_inputs(self):
        summary={'result':'BACKEND_BUILD_SCAN_QUALIFICATION_PARTIAL','product':'NOT_BUILT','admitted':False,'runtime':'NOT_EXECUTED'}
        q.finish_input_inspection(summary,[('grype','CVE-2026-5435','libc6','2','HIGH')])
        self.assertEqual(summary['result'],'BACKEND_BUILD_SCAN_FINDINGS_CONFIRMED_BLOCKED')
        self.assertEqual(summary['base'],'BLOCKING_FINDINGS_CONFIRMED')
        self.assertEqual(summary['product'],'NOT_BUILT')
        self.assertFalse(summary['admitted'])
        self.assertEqual(summary['runtime'],'NOT_EXECUTED')
    def test_os_success_does_not_invent_bundled_node_qualification(self):
        summary={'result':'BACKEND_BUILD_SCAN_QUALIFICATION_PARTIAL','product':'NOT_BUILT','admitted':False,'runtime':'NOT_EXECUTED'}
        q.finish_input_inspection(summary,[])
        self.assertEqual(summary['result'],'BACKEND_BUILD_SCAN_QUALIFICATION_PARTIAL')
        self.assertEqual(summary['base'],'SCANNER_CHECKS_PASS_VENDOR_APPLICABILITY_INCOMPLETE')
        self.assertEqual(summary['boundary'],'NODE_BUNDLED_ZLIB_CURRENT_SOURCE_BACKPORT_EVIDENCE_REQUIRED')
        self.assertEqual(summary['productCaller'],'NOT_IMPLEMENTED_PENDING_INPUT_QUALIFICATION')
        self.assertEqual(summary['product'],'NOT_BUILT')
        self.assertFalse(summary['admitted'])
        self.assertEqual(summary['runtime'],'NOT_EXECUTED')
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
        t,g,s,d,e,m=self.fixtures();e['grype']=1
        with self.assertRaisesRegex(ValueError,'SCANNER_PROCESS_FAILED'):q.scanner_policy(t,g,s,d,e,m)
    def test_ignored_unknown_prohibited(self):
        t,g,s,d,e,m=self.fixtures();g['ignoredMatches']=[{'vulnerability':{'id':'CVE-2026-5435','severity':'Unknown'},'artifact':{'name':'libc6','version':'2'}}]
        self.assertEqual(len(q.scanner_policy(t,g,s,d,e,m)),1)
    def test_nonzero_without_findings(self):
        t,g,s,d,e,m=self.fixtures();e['trivy']=1
        with self.assertRaisesRegex(ValueError,'SCANNER_FAILURE_WITHOUT'):q.scanner_policy(t,g,s,d,e,m)
    def test_grype_threshold_exit_two_with_own_findings(self):
        t,g,s,d,e,m=self.fixtures();e['grype']=2
        g['matches']=[{'vulnerability':{'id':'CVE-2026-5435','severity':'High'},'artifact':{'name':'libc6','version':'2'}}]
        self.assertEqual(len(q.scanner_policy(t,g,s,d,e,m)),1)
        e['grype']=1
        with self.assertRaisesRegex(ValueError,'SCANNER_PROCESS_FAILED'):q.scanner_policy(t,g,s,d,e,m)
    def test_grype_threshold_without_own_findings(self):
        t,g,s,d,e,m=self.fixtures();e['grype']=2
        t['Results'][0]['Vulnerabilities']=[{'VulnerabilityID':'CVE-2026-5435','PkgName':'libc6','InstalledVersion':'2','Severity':'HIGH'}]
        with self.assertRaisesRegex(ValueError,'SCANNER_FAILURE_WITHOUT'):q.scanner_policy(t,g,s,d,e,m)
    def test_trivy_uses_oci_directory(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);layout=root/'oci';layout.mkdir()
            commands=q.scanner_commands(root,layout,{'trivy':'mock-trivy','grype':'mock-grype'})
            self.assertEqual(commands['trivy'][commands['trivy'].index('--input')+1],str(layout))
            self.assertIn('oci-dir:'+str(layout),commands['grype'])
    def test_missing_first_report_preserves_other_raw_hashes(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);summary={}
            for name in ('grype.json','sbom.json','scanner-metadata.json'):q.write(root/name,{'private':'PRIVATE_MARKER'})
            with self.assertRaisesRegex(ValueError,'REPORT_COLLECTION_INCOMPLETE'):q.capture_reports(root,'sha256:'+'1'*64,summary)
            self.assertEqual(summary['reports']['trivy.json']['status'],'MISSING')
            self.assertEqual(summary['reports']['grype.json']['status'],'JSON_PARSED')
            self.assertEqual(summary['reportHashes']['grype.json'],q.sha((root/'grype.json').read_bytes()))
            self.assertNotIn('PRIVATE_MARKER',json.dumps(summary))
            self.assertEqual(len(list(root.glob('*.bytes-receipt.json'))),4)
    def test_invalid_report_preserves_all_original_byte_receipts(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);summary={}
            for name in ('trivy.json','grype.json','sbom.json','scanner-metadata.json'):q.write(root/name,b'{' if name=='trivy.json' else b'{}')
            with self.assertRaisesRegex(ValueError,'REPORT_PARSE_INVALID'):q.capture_reports(root,'sha256:'+'1'*64,summary)
            self.assertEqual(summary['reports']['trivy.json']['status'],'JSON_INVALID')
            self.assertEqual(len(summary['reportHashes']),4)
            self.assertEqual(summary['reports']['grype.json']['status'],'JSON_PARSED')
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
        self.assertIn('raise SystemExit(main())',source)
        self.assertIn('python3 scripts/portable/backend-build-scan.py --base-only\n',workflow)
        self.assertNotIn('python3 scripts/portable/backend-build-scan.py\n',workflow)
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
    def test_unregistered_normal_caller_publishes_without_node_or_build(self):
        import os
        env={'GITHUB_ACTIONS':'true','RUNNER_ENVIRONMENT':'github-hosted','RUNNER_OS':'Linux','GITHUB_REPOSITORY':'vsairohith67/nalanda-school-erp','PORTABLE_CI_EXCEPTION':'OWNER_AUTHORIZED','EXPECTED_SHA':'a'*40,'TARGET_ARCHITECTURE':'amd64','GITHUB_RUN_ID':'1','GITHUB_RUN_ATTEMPT':'1','GITHUB_JOB':'backend-build-scan'}
        with tempfile.TemporaryDirectory() as t:
            previous=Path.cwd()
            try:
                os.chdir(t)
                with patch.dict(q.os.environ,env,clear=True),patch.object(q.platform,'system',return_value='Linux'),patch.object(q.platform,'machine',return_value='x86_64'),patch.object(q.os,'getuid',return_value=1000,create=True),patch.object(q.subprocess,'check_output',side_effect=[b'a'*40,b'']),patch.object(q.subprocess,'Popen') as child:
                    self.assertEqual(q.run(),1)
                    child.assert_not_called()
                result=json.loads(Path('backend-build-scan-result.json').read_bytes())
                self.assertEqual(result['result'],'PRODUCTION_INPUT_TRUST_UNREGISTERED')
                self.assertEqual(result['processes'],[])
                self.assertEqual(result['product'],'NOT_BUILT')
                manifest=json.loads(Path('backend-build-scan-public-manifest.json').read_bytes())
                self.assertEqual(manifest['files'][0]['sha256'],q.sha(Path('backend-build-scan-result.json').read_bytes()))
            finally:
                os.chdir(previous)
    def test_explicit_base_dispatch_never_calls_product(self):
        with patch.object(q,'inspect_runtime_base',return_value=1) as base,patch.object(q,'run') as product:
            self.assertEqual(q.main(['--base-only']),1)
            base.assert_called_once_with();product.assert_not_called()
    def test_default_dispatch_retains_guarded_product_caller(self):
        with patch.object(q,'inspect_runtime_base') as base,patch.object(q,'run',return_value=1) as product:
            self.assertEqual(q.main([]),1)
            product.assert_called_once_with();base.assert_not_called()
    def test_unknown_or_combined_arguments_refuse_before_dispatch(self):
        for args in (['--product'],['--base-only','--base-only'],['--base-only','extra']):
            with self.subTest(args=args),patch.object(q,'inspect_runtime_base') as base,patch.object(q,'run') as product:
                with self.assertRaisesRegex(ValueError,'BUILD_SCAN_ARGUMENTS_INVALID'):q.main(args)
                base.assert_not_called();product.assert_not_called()
    def candidate_fixture(self, root):
        config=json.loads(Path('config/runtime-base-candidates.json').read_bytes())
        event={'action':'synchronize','number':28,'pull_request':{'number':28,'updated_at':'2026-10-09T04:00:00Z','head':{'sha':'a'*40,'ref':'release/recovery-integration-1a','repo':{'full_name':'vsairohith67/nalanda-school-erp'}},'base':{'repo':{'full_name':'vsairohith67/nalanda-school-erp'}}}}
        file=root/'event.json';file.write_text(json.dumps(event))
        env={'BASE_CANDIDATE_ID':'official-node-alpine324','GITHUB_EVENT_NAME':'pull_request','GITHUB_RUN_ATTEMPT':'1','GITHUB_EVENT_PATH':str(file)}
        return config,event,env,file
    def test_candidate_is_explicit_base_only_and_preserves_production_pins(self):
        with tempfile.TemporaryDirectory() as t:
            config,event,env,file=self.candidate_fixture(Path(t))
            with patch.dict(q.os.environ,env,clear=True),patch.object(q.subprocess,'check_output',return_value=Path('config/runtime-base-candidates.json').read_bytes()):
                c=q.selected_base_candidate('a'*40,'amd64')
            self.assertTrue(c['candidateOnly']);self.assertFalse(c['productionCompatible'])
            self.assertEqual(c['packageFormat'],'apk');self.assertEqual(c['defaultUser'],'')
            self.assertIn('ARG RUNTIME_IMAGE='+q.RUNTIME,Path('Dockerfile').read_text())
            self.assertIn('ARG NODE_IMAGE='+q.BUILDER,Path('Dockerfile').read_text())
    def test_candidate_rejects_unknown_without_git_or_network(self):
        with patch.dict(q.os.environ,{'BASE_CANDIDATE_ID':'https://foreign/image:latest'},clear=True),patch.object(q.subprocess,'check_output') as git,patch.object(q,'request') as network:
            with self.assertRaisesRegex(ValueError,'BASE_CANDIDATE_UNKNOWN'):q.selected_base_candidate('a'*40,'amd64')
            git.assert_not_called();network.assert_not_called()
    def test_no_selector_retains_original_current_base_path(self):
        with patch.dict(q.os.environ,{},clear=True):self.assertIsNone(q.selected_base_candidate('a'*40,'amd64'))
        registry,headers=q.base_registry(None)
        self.assertEqual(registry,'https://gcr.io/v2/distroless/nodejs24-debian13/')
        self.assertNotIn('Authorization',headers)
    def test_candidate_event_scope_and_deadline_refusals(self):
        for change in ('fork','retry','other-head','other-branch','other-pr','expired','before-start','dispatch'):
            with self.subTest(change=change),tempfile.TemporaryDirectory() as t:
                config,event,env,file=self.candidate_fixture(Path(t))
                if change=='fork':event['pull_request']['head']['repo']['full_name']='foreign/repo'
                if change=='retry':env['GITHUB_RUN_ATTEMPT']='2'
                if change=='other-head':event['pull_request']['head']['sha']='b'*40
                if change=='other-branch':event['pull_request']['head']['ref']='main'
                if change=='other-pr':event['number']=29
                if change=='expired':event['pull_request']['updated_at']='2026-10-09T13:09:05Z'
                if change=='before-start':event['pull_request']['updated_at']='2026-10-09T03:09:04.999Z'
                if change=='dispatch':env['GITHUB_EVENT_NAME']='workflow_dispatch'
                file.write_text(json.dumps(event))
                with patch.dict(q.os.environ,env,clear=True),patch.object(q.subprocess,'check_output',return_value=Path('config/runtime-base-candidates.json').read_bytes()),self.assertRaises(ValueError):q.selected_base_candidate('a'*40,'amd64')
    def test_candidate_working_config_cannot_override_committed_config(self):
        with tempfile.TemporaryDirectory() as t:
            config,event,env,file=self.candidate_fixture(Path(t))
            with patch.dict(q.os.environ,env,clear=True),patch.object(q.subprocess,'check_output',return_value=b'{}'),self.assertRaisesRegex(ValueError,'BASE_CANDIDATE_CONFIG_CHANGED'):q.selected_base_candidate('a'*40,'amd64')
    def test_apk_records_are_actual_final_database_versions(self):
        self.assertEqual(q.apk_packages(b'P:musl\nV:1.2.5-r1\n\nP:libgcc\nV:15.2.0-r0\n\n'),{'musl':'1.2.5-r1','libgcc':'15.2.0-r0'})
        for raw in (b'',b'P:musl\n',b'P:musl\nV:1\n\nP:musl\nV:2\n'):
            with self.subTest(raw=raw),self.assertRaises(ValueError):q.apk_packages(raw)
    def test_virtual_final_filesystem_whiteout_preserves_no_stale_node(self):
        inventory={'usr/local/bin/node':{'type':'file','sha256':'old'},'usr/local/bin/other':{'type':'file'}}
        retained={'usr/local/bin/node':b'old'}
        m=tarfile.TarInfo('usr/local/bin/.wh.node');m.size=0
        q.record_candidate_member(None,m,inventory,retained)
        self.assertNotIn('usr/local/bin/node',inventory);self.assertNotIn('usr/local/bin/node',retained)
        self.assertIn('usr/local/bin/other',inventory)
    def test_virtual_opaque_directory_removes_lower_entries(self):
        inventory={'lib/apk/db/installed':{'type':'file'},'lib/apk/db/other':{'type':'file'},'usr/node':{'type':'file'}};retained={'lib/apk/db/installed':b'old'}
        q.record_candidate_member(None,tarfile.TarInfo('lib/apk/db/.wh..wh..opq'),inventory,retained)
        self.assertEqual(set(inventory),{'usr/node'});self.assertFalse(retained)
    def test_virtual_member_inspection_hashes_without_extraction(self):
        raw=io.BytesIO();data=b'P:musl\nV:1.2.5-r1\n\n'
        with tarfile.open(fileobj=raw,mode='w') as a:
            m=tarfile.TarInfo('lib/apk/db/installed');m.size=len(data);a.addfile(m,io.BytesIO(data))
        with tarfile.open(fileobj=io.BytesIO(raw.getvalue()),mode='r:') as a:
            inventory,retained={},{};q.record_candidate_member(a,a.getmembers()[0],inventory,retained)
        self.assertEqual(retained['lib/apk/db/installed'],data);self.assertEqual(inventory['lib/apk/db/installed']['sha256'],q.sha(data))
    def test_candidate_path_aliases_and_duplicate_layer_paths_refuse(self):
        for name in ('usr//node','usr/./node','usr/node/'):
            with self.subTest(name=name),self.assertRaisesRegex(ValueError,'CANDIDATE_PATH_NONCANONICAL'):q.canonical_candidate_name(tarfile.TarInfo(name))
        raw=io.BytesIO()
        with tarfile.open(fileobj=raw,mode='w') as a:
            a.addfile(tarfile.TarInfo('./usr/node'));a.addfile(tarfile.TarInfo('usr/node'))
        with tarfile.open(fileobj=io.BytesIO(raw.getvalue()),mode='r:') as a,self.assertRaisesRegex(ValueError,'CANDIDATE_LAYER_DUPLICATE_PATH'):q.candidate_layer_members(a,{}, {})
    def test_final_candidate_requires_current_regular_bytes_and_valid_ancestors(self):
        name='usr/local/bin/node';inventory={name:{'type':'file'},'usr/local':{'type':'link'}}
        with self.assertRaisesRegex(ValueError,'FINAL_CANDIDATE_ANCESTOR_INVALID'):q.final_candidate_regular(inventory,{name:b'new'},name)
        for inventory,retained in (({},{}),({name:{'type':'link'}},{name:b'old'}),({name:{'type':'file'}},{})):
            with self.assertRaisesRegex(ValueError,'FINAL_CANDIDATE_FILE_MISSING'):q.final_candidate_regular(inventory,retained,name)
    def test_retained_file_type_transition_cannot_reuse_old_bytes(self):
        for kind in (tarfile.SYMTYPE,tarfile.DIRTYPE,tarfile.LNKTYPE):
            with self.subTest(kind=kind):
                name='usr/local/bin/node';inventory={name:{'type':'file'}};retained={name:b'old'}
                m=tarfile.TarInfo(name);m.type=kind;m.linkname='/usr/local/bin/other'
                q.record_candidate_member(None,m,inventory,retained)
                self.assertNotIn(name,retained);self.assertNotEqual(inventory[name]['type'],'file')
    def test_directory_replaced_by_link_clears_descendants(self):
        inventory={'lib/apk':{'type':'directory'},'lib/apk/db/installed':{'type':'file'}};retained={'lib/apk/db/installed':b'old'}
        m=tarfile.TarInfo('lib/apk');m.type=tarfile.SYMTYPE;m.linkname='/new-apk'
        q.record_candidate_member(None,m,inventory,retained)
        self.assertEqual(set(inventory),{'lib/apk'});self.assertFalse(retained)
    def test_whiteout_archive_order_does_not_delete_new_layer_file(self):
        for opaque in (False,True):
            results=[]
            for whiteout_first in (False,True):
                raw=io.BytesIO();file=tarfile.TarInfo('lib/apk/db/installed');file.size=3
                whiteout=tarfile.TarInfo('lib/apk/db/'+('.wh..wh..opq' if opaque else '.wh.installed'))
                order=[whiteout,file] if whiteout_first else [file,whiteout]
                with tarfile.open(fileobj=raw,mode='w') as a:
                    for m in order:a.addfile(m,io.BytesIO(b'new') if m is file else None)
                inventory={'lib/apk/db/installed':{'type':'file'},'lib/apk/db/old':{'type':'file'}};retained={'lib/apk/db/installed':b'old'}
                with tarfile.open(fileobj=io.BytesIO(raw.getvalue()),mode='r:') as a:
                    for m in q.candidate_layer_members(a,inventory,retained):q.record_candidate_member(a,m,inventory,retained)
                self.assertEqual(retained['lib/apk/db/installed'],b'new');results.append((inventory,retained))
            self.assertEqual(results[0],results[1])
if __name__=='__main__':unittest.main()
