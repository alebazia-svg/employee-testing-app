import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('maintenance', Path(__file__).with_name('portal-storage-maintenance.py'))
maintenance = importlib.util.module_from_spec(spec)
spec.loader.exec_module(maintenance)


class RetentionTests(unittest.TestCase):
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


if __name__ == '__main__':
    unittest.main()
