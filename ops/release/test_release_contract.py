import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from test_portal_release import ARTIFACT, FakeHost, OLD, NEW, r
import test_portal_release as fixtures
import portal_release_contract as c


class ContractTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name)
        (self.source/'Dockerfile').write_text('ARG TARGETARCH\nARG PORTAL_BUILD_REVISION\nARG NEXT_PUBLIC_PROCUREMENT_RECEIPTS_ENABLED=0\n')
        (self.source/'receipt.tsx').write_text("if(process.env.NEXT_PUBLIC_PROCUREMENT_RECEIPTS_ENABLED!=='1')return null;")
        self.compose = {'services': {'portal-app': {'build': {'args': dict(c.BUILD_ARGS)}}}}

    def test_build_arguments_come_from_approved_policy_not_runner_env_or_operator_guess(self):
        self.assertEqual(c.build_arguments(self.source, self.compose), c.BUILD_ARGS)
        self.assertEqual(c.build_arguments(self.source, self.compose, '1'), c.BUILD_ARGS)
        with self.assertRaises(c.ContractError):
            c.build_arguments(self.source, self.compose, '0')
        with self.assertRaises(r.ReleaseError), patch.object(FakeHost, 'run') as docker:
            r.prepare(FakeHost(), 'a'*40, 'b'*40, self.source/'output', '0')
        docker.assert_not_called()

    def test_new_or_disabled_build_flags_require_explicit_policy_review(self):
        for args in ({}, {'NEXT_PUBLIC_PROCUREMENT_RECEIPTS_ENABLED':'0'},
                     {**c.BUILD_ARGS, 'NEXT_PUBLIC_NEW_MODULE':'1'}):
            self.compose['services']['portal-app']['build']['args'] = args
            with self.assertRaises(c.ContractError):c.build_arguments(self.source, self.compose)
        self.compose['services']['portal-app']['build']['args'] = dict(c.BUILD_ARGS)
        with (self.source/'Dockerfile').open('a') as f:f.write('ARG SILENT_DISABLE=0\n')
        with self.assertRaises(c.ContractError):c.build_arguments(self.source, self.compose)

    def test_unregistered_public_source_flag_cannot_silently_use_a_default(self):
        for expression in ('process.env.NEXT_PUBLIC_OTHER_FEATURE', 'process.env["NEXT_PUBLIC_OTHER_FEATURE"]'):
            (self.source/'feature.ts').write_text('if('+expression+'){}')
            with self.assertRaises(c.ContractError):c.build_arguments(self.source, self.compose)

    def test_disabled_compiled_module_and_invalid_reports_are_rejected(self):
        for bad in (None, {}, {**ARTIFACT,'capabilities':{'procurement_receipts':False}},
                    {**ARTIFACT,'routes':['/employee/page']}, {**ARTIFACT,'assets':['../secret']}):
            with self.subTest(bad=bad), self.assertRaises(c.ContractError):c.validate_artifact(bad)

    def test_pages_apis_and_public_assets_cannot_disappear_but_new_ones_can_be_added(self):
        for field, value in [('routes','/admin/payroll/page'),('assets','qr/departments.pdf')]:
            previous=copy.deepcopy(ARTIFACT);previous[field]=sorted([*previous[field],value])
            with self.assertRaisesRegex(c.ContractError, 'removed'):c.verify_continuity(previous,ARTIFACT)
            c.verify_continuity(ARTIFACT,previous)

    def test_bad_existing_baseline_does_not_block_restoring_required_capability(self):
        previous=copy.deepcopy(ARTIFACT);previous['capabilities']['procurement_receipts']=False
        c.verify_continuity(previous,ARTIFACT)

    def test_missing_contract_or_forged_disabled_manifest_never_reaches_docker(self):
        fixture=fixtures.ReleaseTests();fixture.setUp();self.addCleanup(fixture.folder.cleanup)
        for field,value in [('build_args',None),('build_args',{'NEXT_PUBLIC_PROCUREMENT_RECEIPTS_ENABLED':'0'}),
                            ('artifact',{**ARTIFACT,'capabilities':{'procurement_receipts':False}})]:
            manifest={**fixture.manifest,field:value};host=FakeHost()
            with self.subTest(field=field,value=value),self.assertRaises(c.ContractError):
                r.install(host,manifest,fixture.bundle,[OLD,'sha256:'+'3'*64,'sha256:'+'4'*64], 'https://example.test',lambda *a,**k:None)
            self.assertEqual(host.calls,[])

    def test_candidate_inventory_is_checked_before_replacing_the_working_app(self):
        fixture=fixtures.ReleaseTests();fixture.setUp();self.addCleanup(fixture.folder.cleanup)
        candidate=copy.deepcopy(ARTIFACT);candidate['assets']=['different.txt']
        manifest={**fixture.manifest,'artifact':candidate};host=FakeHost();original=host.run
        def run(*args,**kwargs):
            if args[-1]==c.ARTIFACT_PROBE and args[:2]==('docker','run'):return json.dumps(candidate)
            return original(*args,**kwargs)
        host.run=run
        with self.assertRaisesRegex(c.ContractError,'removed'):
            r.install(host,manifest,fixture.bundle,[OLD,'sha256:'+'3'*64,'sha256:'+'4'*64], 'https://example.test',lambda *a,**k:None)
        self.assertEqual(host.image,OLD)
        self.assertFalse(any(call[0]=='compose' for call in host.calls))

    def test_false_manifest_cannot_hide_an_actual_disabled_image(self):
        fixture=fixtures.ReleaseTests();fixture.setUp();self.addCleanup(fixture.folder.cleanup)
        host=FakeHost();original=host.run
        def run(*args,**kwargs):
            if args[-1]==c.ARTIFACT_PROBE and args[:2]==('docker','run'):
                return json.dumps({**ARTIFACT,'capabilities':{'procurement_receipts':False}})
            return original(*args,**kwargs)
        host.run=run
        with self.assertRaisesRegex(r.ReleaseError,'differs from reviewed'):
            fixture.install(host)
        self.assertEqual(host.image,OLD)
        self.assertFalse(any(call[0]=='compose' for call in host.calls))

    def test_running_capability_mismatch_rolls_back_instead_of_certifying_release(self):
        fixture=fixtures.ReleaseTests();fixture.setUp();self.addCleanup(fixture.folder.cleanup)
        host=FakeHost();original=host.run
        def run(*args,**kwargs):
            if args[-1]==c.ARTIFACT_PROBE and args[:2]==('docker','exec') and host.image==NEW:
                return json.dumps({**ARTIFACT,'capabilities':{'procurement_receipts':False}})
            return original(*args,**kwargs)
        host.run=run
        with self.assertRaisesRegex(r.ReleaseError,'after restart'):fixture.install(host)
        self.assertEqual(host.image,OLD)
        self.assertEqual(fixture.events[-1][0],'ROLLED_BACK')


if __name__=='__main__':unittest.main()
