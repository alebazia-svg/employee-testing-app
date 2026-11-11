"""Session tests use temporary data and fake app/Docker operations only."""
import hashlib
import json
import os
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import Mock, patch

import portal_release_session as session
import test_portal_release as fixtures
from test_portal_release import FakeHost, BASE, TARGET, OLD, NEW, REGISTRY

core = session.core


class SessionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        fixture = fixtures.ReleaseTests()
        fixture.setUp()
        self.addCleanup(fixture.folder.cleanup)
        self.fixture = fixture
        self.attempt = self.root / 'attempt'
        bundle = self.attempt / 'bundle'
        bundle.mkdir(parents=True)
        (bundle / 'image.tar.gz').write_bytes(fixture.archive.read_bytes())
        self.registry = self.root / 'registry.json'
        self.registry.write_text(json.dumps(REGISTRY))
        self.exchange = self.root / ('portal-release-session-' + 'a'*32)
        self.exchange.mkdir()
        self.incoming = self.root / 'incoming'
        self.incoming.mkdir(mode=0o700)
        self.request = dict(session='a'*32, manifest=fixture.manifest,
            plan=core.capacity_plan(fixture.bundle, fixture.manifest), incoming=str(self.incoming),
            exchange=str(self.exchange), owner_uid=os.getuid(), origin='https://example.test',
            review_timeout=60, upload_timeout=60, approved_maintenance=False, remove_archive=False)
        self.events = []
        self.addCleanup(patch.stopall)
        patch.object(core, 'LOCK', self.root / 'lock').start()
        patch.object(core, 'REGISTRY', self.registry).start()

    def record(self, stage, **values):
        self.events.append((stage, values))

    def host(self, failure=None):
        host = FakeHost(failure)
        original = host.run
        def run(*args, **kwargs):
            if args[0] == session.MAINTENANCE and '--register-verified' in args:
                self.assertEqual(args[-1], NEW)
                self.registry.write_text(json.dumps([NEW, OLD, REGISTRY[1]]))
            return original(*args, **kwargs)
        host.run = run
        return host

    def execute(self, host=None, decision='verified'):
        return session.execute(self.request, self.attempt, self.record, host=host or self.host(),
            review=lambda request, record: decision, receive_bundle=lambda *args: None)

    def test_install_review_registration_and_optional_cleanup_share_same_worker_without_sudo(self):
        self.request['remove_archive'] = True
        host = self.host()
        self.assertTrue(self.execute(host))
        self.assertEqual(self.events[-1][0], 'COMPLETE')
        self.assertEqual(json.loads(self.registry.read_text())[0], NEW)
        self.assertFalse((self.attempt / 'bundle/image.tar.gz').exists())
        self.assertFalse(any('sudo' in call for call in host.calls))
        self.assertFalse(any('prune' in call for call in host.calls))

    def test_rejected_or_timed_out_review_never_certifies_or_deletes_archive(self):
        for decision in ('reject', 'timeout'):
            with self.subTest(decision=decision):
                host = self.host()
                self.assertFalse(self.execute(host, decision))
                self.assertEqual(json.loads(self.registry.read_text()), REGISTRY)
                self.assertTrue((self.attempt / 'bundle/image.tar.gz').exists())
                self.assertFalse(any(call[0] == session.MAINTENANCE for call in host.calls))

    def test_failed_install_retains_existing_rollback_and_does_not_request_registration(self):
        host = self.host('health')
        review = Mock(return_value='verified')
        with self.assertRaises(RuntimeError):
            session.execute(self.request, self.attempt, self.record, host=host, review=review,
                            receive_bundle=lambda *args: None)
        self.assertEqual(host.image, OLD)
        self.assertEqual(host.head, BASE)
        review.assert_not_called()
        self.assertEqual(json.loads(self.registry.read_text()), REGISTRY)

    def test_concurrent_source_change_after_ui_review_does_not_register(self):
        host = self.host()
        def review(request, record):
            host.head = BASE
            return 'verified'
        with self.assertRaisesRegex(core.ReleaseError, 'commit changed'):
            session.execute(self.request, self.attempt, self.record, host=host, review=review,
                            receive_bundle=lambda *args: None)
        self.assertEqual(json.loads(self.registry.read_text()), REGISTRY)

    def test_confirmation_is_bound_to_exact_session_image_and_commit(self):
        good = dict(session=self.request['session'], target=TARGET, image=NEW, decision='verified')
        self.assertTrue(session.review_matches(good, self.request))
        for field in ('session', 'target', 'image', 'decision'):
            self.assertFalse(session.review_matches(dict(good, **{field:'wrong'}), self.request))
        (self.exchange / 'review.json').write_text(json.dumps(dict(good, image=OLD)))
        with self.assertRaisesRegex(core.ReleaseError, 'not bound'):
            session.wait_review(self.request, self.record)

    def test_review_timeout_is_bounded_and_leaves_registration_pending(self):
        times = iter([0, 0, 61])
        self.assertEqual(session.wait_review(self.request, self.record, clock=lambda: next(times), sleep=lambda n: None), 'timeout')
        self.assertEqual(self.events[-1][0], 'REVIEW_TIMED_OUT_UNREGISTERED')

    def test_unprivileged_confirmation_writes_data_without_sudo(self):
        (self.exchange / 'ready.json').write_text(json.dumps(self.request))
        args = SimpleNamespace(exchange=str(self.exchange), confirm_independent_verification=True, reject=False)
        with patch.object(session.os, 'geteuid', return_value=1003), patch.object(session.subprocess, 'run') as command:
            session.confirm(args)
            command.assert_not_called()
        value = json.loads((self.exchange / 'review.json').read_text())
        self.assertTrue(session.review_matches(value, self.request))
        self.assertEqual(session.wait_review(self.request, self.record), 'verified')

    def test_upload_is_promoted_without_copy_and_capacity_cleanup_requires_explicit_flag(self):
        archive = self.incoming / 'image.tar.gz'
        archive.write_bytes(self.fixture.archive.read_bytes())
        destination = self.attempt / 'bundle/image.tar.gz'
        destination.unlink()
        host = self.host()
        host.space = Mock(side_effect=[core.ReleaseError('Insufficient release capacity'), None])
        with patch.object(core, 'preflight'), patch.object(session.os, 'chown'):
            with self.assertRaisesRegex(core.ReleaseError, 'capacity'):
                session.receive(self.request, self.attempt, self.record, host)
            self.assertTrue(archive.exists())
            self.assertFalse(any(call[0] == session.MAINTENANCE for call in host.calls))
            self.request['approved_maintenance'] = True
            host.space = Mock(side_effect=[core.ReleaseError('Insufficient release capacity'), None])
            session.receive(self.request, self.attempt, self.record, host)
        self.assertFalse(archive.exists())
        self.assertEqual(core.digest(destination), self.request['manifest']['archive_sha256'])
        cleanup = [call for call in host.calls if call[0] == session.MAINTENANCE]
        self.assertEqual(len(cleanup), 1)
        self.assertIn('--release-headroom-bytes', cleanup[0])

    def test_symlink_or_wrong_upload_does_not_reach_docker(self):
        upload = self.incoming / 'image.tar.gz'
        upload.symlink_to(self.fixture.archive)
        with patch.object(core, 'preflight'):
            with self.assertRaisesRegex(core.ReleaseError, 'uploaded archive'):
                session.receive(self.request, self.attempt, self.record, self.host())
        self.assertTrue(upload.is_symlink())

    def test_start_pins_reviewed_plan_and_launches_only_fixed_detached_worker(self):
        plan_path = self.root / 'capacity.json'
        raw = json.dumps(self.request['plan']).encode()
        plan_path.write_bytes(raw)
        args = SimpleNamespace(plan=str(plan_path), plan_sha256=hashlib.sha256(raw).hexdigest(),
            incoming=str(self.incoming), origin='https://example.test', review_timeout=60,
            upload_timeout=60, approved_storage_maintenance=False, remove_archive=True, apply=True)
        owner = SimpleNamespace(pw_dir=str(self.root), pw_uid=os.getuid(), pw_gid=os.getgid())
        with patch.object(session, 'SESSIONS', self.root / 'sessions'), patch.object(session, 'trusted'), \
             patch.object(session.os, 'geteuid', return_value=0), patch.object(session.os, 'chown'), \
             patch.object(session.os, 'fchown'), patch.object(session.pwd, 'getpwnam', return_value=owner), \
             patch.object(session.subprocess, 'run') as command:
            session.start(args)
            actual = command.call_args.args[0]
            self.assertEqual(actual[0], 'systemd-run')
            self.assertNotIn('--wait', actual)
            self.assertNotIn('sudo', actual)
            self.assertIn('session-worker', actual)
            self.assertTrue(any('RuntimeMaxSec=' in item for item in actual))
        args.plan_sha256 = '0'*64
        with self.assertRaisesRegex(core.ReleaseError, 'plan changed'):
            session.start(args)

    def test_capacity_failure_details_remain_readable_without_root_journal_access(self):
        host = session.SessionHost(self.record)
        def failing_space(*args, **kwargs):
            print('SPACE_CHECK [{"shortfall_bytes":123}]')
            raise core.ReleaseError('Insufficient release capacity')
        with patch.object(core.Host, 'space', side_effect=failing_space):
            with self.assertRaises(core.ReleaseError):
                host.space()
        self.assertEqual(self.events[-1], ('CAPACITY_DETAIL', {'output':'SPACE_CHECK [{"shortfall_bytes":123}]'}))

    def test_data_reader_rejects_symlinks_and_unbounded_input(self):
        large = self.root / 'large.json'; large.write_bytes(b'x'*100)
        with self.assertRaises(core.ReleaseError): session.read_data(large, limit=10)
        link = self.root / 'link'; link.symlink_to(large)
        with self.assertRaises(OSError): session.read_data(link)


if __name__ == '__main__':
    unittest.main()
