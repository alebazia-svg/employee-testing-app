import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch, mock_open, Mock

spec = importlib.util.spec_from_file_location('maintenance', Path(__file__).with_name('portal-storage-maintenance.py'))
maintenance = importlib.util.module_from_spec(spec)
spec.loader.exec_module(maintenance)


class RetentionTests(unittest.TestCase):
    def setUp(self):
        self.history_patch = patch.object(maintenance, 'load_history', return_value={})
        self.history_patch.start()
        self.addCleanup(self.history_patch.stop)

    def test_generated_tags_require_exact_verified_history_and_preserve_all_guards(self):
        value = dict(version='1.2.3', revision='b'*40)
        tag = maintenance.release_tag(value)
        history = {'old': value}
        image = self.image([tag, 'portal-app:rollback-before-1.2.4'])
        self.assertEqual(maintenance.candidates([image], set(), set()), [])
        self.assertEqual(maintenance.candidates([image], set(), set(), history), [image])
        for protected, used in (({'old'}, set()), (set(), {'old'})):
            self.assertEqual(maintenance.candidates([image], protected, used, history), [])
        for tags in ([tag, 'portal-app:unknown'], [tag+'f'], [tag.replace('1.2.3','1.2.2')]):
            self.assertEqual(maintenance.candidates([self.image(tags)], set(), set(), history), [])
        self.assertEqual(maintenance.candidates([self.image([tag], ['other@sha256:'+'c'*64])], set(), set(), history), [])

    def image(self, tags=None, digest=None):
        return {'Id': 'old', 'RepoTags': tags if tags is not None else ['portal-app:rollback-before-1.4.0'], 'RepoDigests': digest or []}

    def test_old_portal_only(self):
        self.assertEqual(len(maintenance.candidates([self.image()], {'current'}, set())), 1)

    def test_protected_and_used(self):
        self.assertEqual(maintenance.candidates([self.image()], {'old'}, set()), [])
        self.assertEqual(maintenance.candidates([self.image()], set(), {'old'}), [])

    def test_other_app_and_shared_tag(self):
        for tags in [['postgres:16'], ['portal-app:rollback-before-1.4.0', 'other:latest'], []]:
            self.assertEqual(maintenance.candidates([self.image(tags)], set(), set()), [])

    def test_unknown_and_digest(self):
        self.assertEqual(maintenance.candidates([self.image(['portal-app:custom-backup'])], set(), set()), [])
        self.assertEqual(maintenance.candidates([self.image(digest=['other@sha256:abc'])], set(), set()), [])

    def test_verified_portal_repository_digest_and_legacy_tags(self):
        digest = ['docker.io/library/offonika-portal-portal-app@sha256:' + 'a' * 64]
        for tags in [['portal-app:rollback-before-1.5.7'], ['mobo-access-rollback:1.5.8'], ['offonika-portal-access-rollback:pre-1.4.21-20261018']]:
            self.assertEqual(len(maintenance.candidates([self.image(tags, digest)], set(), set())), 1)

    def test_registration_guard_refuses_concurrent_release_before_registry_write(self):
        with patch('sys.argv', ['maintenance', '--register-verified', '--expected-current', 'sha256:' + 'a' * 64]), \
             patch('builtins.open', mock_open()), patch.object(maintenance.fcntl, 'flock'), \
             patch.object(maintenance, 'inspect', return_value=[{'Image': 'sha256:' + 'b' * 64}]), \
             patch.object(maintenance.subprocess, 'run') as command:
            with self.assertRaisesRegex(ValueError, 'Running image changed'):
                maintenance.main()
            command.assert_not_called()

    def test_cleanup_target_and_capacity_gate_use_identical_bytes(self):
        current = 'sha256:' + 'a' * 64
        registry = [current, 'sha256:' + 'b' * 64, 'sha256:' + 'c' * 64]
        state = Mock()
        state.read_text.return_value = __import__('json').dumps(registry)
        def inspect(kind, ids):
            return [{'Image': current}] if kind == 'container' and ids == ['portal-app'] else []
        for free in (15 * 1024**3, 15 * 1024**3 - 1):
            with self.subTest(free=free), patch('sys.argv', ['maintenance', '--apply']), \
                 patch('builtins.open', mock_open()), patch.object(maintenance.fcntl, 'flock'), \
                 patch.object(maintenance, 'STATE', state), patch.object(maintenance, 'inspect', side_effect=inspect), \
                 patch.object(maintenance, 'docker', return_value=''), \
                 patch.object(maintenance.shutil, 'disk_usage', return_value=Mock(free=free)), \
                 patch.object(maintenance.subprocess, 'run') as command:
                if free < 15 * 1024**3:
                    with self.assertRaisesRegex(RuntimeError, 'Insufficient release capacity'):
                        maintenance.main()
                else:
                    maintenance.main()
                args = command.call_args.args[0]
                self.assertEqual(args[args.index('--min-free-space') + 1], str(15 * 1024**3))
                self.assertEqual(args[:3], ['docker', 'buildx', 'prune'])

    def test_release_headroom_cannot_be_negative_or_combined_with_registration(self):
        for arguments in (['--release-headroom-bytes', '-1'],
                          ['--register-verified', '--release-headroom-bytes', '1']):
            with patch('sys.argv', ['maintenance', *arguments]), patch.object(maintenance.subprocess, 'run') as command:
                with self.assertRaises(ValueError):
                    maintenance.main()
                command.assert_not_called()

    def test_release_headroom_changes_target_without_lowering_reserve_or_broadening_cleanup(self):
        current = 'sha256:' + 'a' * 64
        state = Mock()
        state.read_text.return_value = __import__('json').dumps([current, 'sha256:'+'b'*64, 'sha256:'+'c'*64])
        def inspect(kind, ids):
            return [{'Image': current}] if kind == 'container' and ids == ['portal-app'] else []
        target = 19 * 1024**3
        with patch('sys.argv', ['maintenance', '--apply', '--release-headroom-bytes', str(4*1024**3)]), \
             patch('builtins.open', mock_open()), patch.object(maintenance.fcntl, 'flock'), \
             patch.object(maintenance, 'STATE', state), patch.object(maintenance, 'inspect', side_effect=inspect), \
             patch.object(maintenance, 'docker', return_value=''), \
             patch.object(maintenance.shutil, 'disk_usage', return_value=Mock(free=target)), \
             patch.object(maintenance.subprocess, 'run') as command:
            maintenance.main()
            command.assert_called_once_with(['docker', 'buildx', 'prune', '--all', '--force',
                '--max-used-space', '5GB', '--min-free-space', str(target)], check=True)
            self.assertEqual(maintenance.MIN_FREE_BYTES, 15*1024**3)

    def test_report_never_applies_cleanup_or_claims_ready_with_insufficient_space(self):
        current='sha256:'+'a'*64
        images=[{'Id':current,'RepoTags':['portal-app:rollback-before-1.0.1']},
                {'Id':'old','RepoTags':['offonika-portal-release:1.0.0-'+'b'*12]}]
        report=maintenance.inventory(images,[current],set(),current,20*1024**3,17*1024**3)
        self.assertEqual(report['capacity']['shortfall_bytes'],3*1024**3)
        self.assertEqual(report['images'][0]['reason'],'protected')
        self.assertFalse(report['images'][1]['eligible'])
        for flags in (['--report-json','--apply'],['--report-json','--register-verified']):
            with patch('sys.argv',['maintenance',*flags]),patch.object(maintenance.subprocess,'run') as command:
                with self.assertRaises(ValueError): maintenance.main()
                command.assert_not_called()


if __name__ == '__main__':
    unittest.main()
