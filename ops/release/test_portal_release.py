import importlib.util
import io
import gzip
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('release', Path(__file__).with_name('portal_release.py'))
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)
BASE = 'a' * 40
TARGET = 'b' * 40
OLD = 'sha256:' + '1' * 64
NEW = 'sha256:' + '2' * 64
REGISTRY = [OLD, 'sha256:' + '3' * 64, 'sha256:' + '4' * 64]
OLD_INFO = dict(version='1.0.0', revision=BASE, source='clean', builtAt='2026-11-01T00:00:00Z')
NEW_INFO = dict(version='1.0.1', revision=TARGET, source='clean', builtAt='2026-11-11T00:00:00Z')
ARTIFACT = dict(format=1, routes=['/api/procurement/receipts/route', '/employee/page'],
                assets=['manifest.webmanifest'], capabilities={'procurement_receipts': True})


def container(image):
    return dict(Image=image, Id='portal', State=dict(Status='running', Health=dict(Status='healthy')),
                Config=dict(Env=['SECRET=never-log']), Mounts=[dict(Destination='/app/uploads', Source='volume')])


class FakeHost:
    def __init__(self, fail=None):
        self.head = BASE
        self.image = OLD
        self.tag = OLD
        self.calls = []
        self.fail = fail
        self.space_calls = 0

    def git(self, *args):
        self.calls.append(('git', *args))
        if args[:2] == ('rev-parse', 'HEAD'):
            return self.head
        if args[0] == 'show':
            commit, path = args[1].split(':')
            v = '1.0.0' if commit == BASE else '1.0.1'
            return json.dumps(dict(version=v, packages={'': dict(version=v)}))
        if args[0] == 'diff':
            return 'prisma/schema.prisma' if self.fail == 'schema' else ''
        if args[0] == 'status':
            return ' M lib/auth.ts' if self.fail == 'dirty' else ''
        if args[0] == 'checkout':
            self.head = args[-1]
        return ''

    def current(self):
        result = container(self.image)
        if self.fail == 'mount' and self.image == NEW:
            result['Mounts'] = []
        return result

    def inspect(self, kind, ident):
        if kind == 'container':
            return dict(Id='database')
        return dict(Id=self.tag if ident == r.COMPOSE_IMAGE else (NEW if ident.startswith('offonika-portal-release:') else ident), Os='linux', Architecture='amd64')

    def metadata(self):
        return NEW_INFO if self.image == NEW else OLD_INFO

    def public_json(self, origin, route):
        if route == '/api/health':
            if self.fail == 'public' and self.image == NEW:
                raise r.ReleaseError('HTTP 503')
            return dict(ok=True)
        return self.metadata()

    def public_routes(self, origin):
        if self.fail == 'route' and self.image == NEW:
            raise r.ReleaseError('HTTP 502')

    def space(self, **kwargs):
        self.space_calls += 1
        if self.fail == 'space' or (self.fail == 'extraction-space' and self.space_calls == 3):
            raise r.ReleaseError('space')

    def run(self, *args, **kwargs):
        self.calls.append(args)
        if args[-1] == r.contract.ARTIFACT_PROBE:
            return json.dumps(ARTIFACT)
        if 'migrate' in args and self.fail == 'pending':
            raise r.ReleaseError('pending migrations')
        if args[:3] == ('docker', 'image', 'tag'):
            if args[-1] == r.COMPOSE_IMAGE:
                self.tag = args[3]
        if args[:2] == ('docker', 'run'):
            return json.dumps(OLD_INFO if self.fail == 'metadata' else NEW_INFO)
        return ''

    def compose(self):
        self.calls.append(('compose', self.tag))
        self.image = self.tag
        if self.fail == 'compose' and self.image == NEW:
            raise r.ReleaseError('compose failed after recreation')

    def wait(self, image, **kwargs):
        if image == NEW:
            if self.fail in ('health', 'rollback'):
                raise r.ReleaseError('unhealthy')
            if self.fail == 'interrupt':
                raise KeyboardInterrupt()
            if self.fail == 'explicit-exit':
                raise SystemExit(52)
        if image == OLD and self.fail == 'rollback':
            raise r.ReleaseError('old image unhealthy')


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.bundle = Path(self.folder.name)
        self.archive = self.bundle / 'image.tar.gz'
        self.manifest = dict(format=1, base=BASE, target=TARGET, version='1.0.1', image=NEW,
                             archive='image.tar.gz', platform='linux/amd64',
                             build_args=dict(r.contract.BUILD_ARGS), artifact=ARTIFACT)
        self.write_archive(['offonika-portal-release:1.0.1-' + TARGET[:12]])
        self.events = []

    def write_archive(self, tags):
        content = json.dumps([dict(RepoTags=tags, Layers=['layer.tar'])]).encode()
        with tarfile.open(self.archive, 'w:gz') as archive:
            info = tarfile.TarInfo('manifest.json')
            info.size = len(content)
            archive.addfile(info, io.BytesIO(content))
            layer = io.BytesIO()
            with tarfile.open(fileobj=layer, mode='w'):
                pass
            raw = layer.getvalue()
            info = tarfile.TarInfo('layer.tar')
            info.size = len(raw)
            archive.addfile(info, io.BytesIO(raw))
        self.manifest['archive_sha256'] = r.digest(self.archive)

    def install(self, host, registry=None):
        r.install(host, self.manifest, self.bundle, REGISTRY if registry is None else registry,
                  'https://example.test', lambda stage, **values: self.events.append((stage, values)))

    def test_success_waits_for_independent_verification_and_never_registers_or_cleans(self):
        host = FakeHost()
        self.install(host)
        self.assertEqual(host.image, NEW)
        self.assertEqual(host.head, TARGET)
        self.assertEqual(self.events[-1][0], 'AWAITING_INDEPENDENT_VERIFICATION')
        commands = repr(host.calls)
        self.assertNotIn('prune', commands)
        self.assertNotIn('register', commands)
        self.assertNotIn("'migrate', 'deploy'", commands)
        self.assertNotIn('SECRET', repr(self.events))

    def test_all_failures_after_recreation_restore_image_commit_and_verify_rollback(self):
        for failure in ('health', 'public', 'route', 'mount', 'compose', 'interrupt', 'explicit-exit'):
            with self.subTest(failure=failure):
                self.events = []
                host = FakeHost(failure)
                with self.assertRaises((r.ReleaseError, KeyboardInterrupt, SystemExit)):
                    self.install(host)
                self.assertEqual(host.image, OLD)
                self.assertEqual(host.head, BASE)
                self.assertEqual(self.events[-1][0], 'ROLLED_BACK')

    def test_preflight_and_extraction_failures_do_not_restart_current_app(self):
        for failure in ('schema', 'dirty', 'space', 'extraction-space', 'pending', 'metadata'):
            with self.subTest(failure=failure):
                host = FakeHost(failure)
                with self.assertRaises(r.ReleaseError):
                    self.install(host)
                self.assertEqual(host.image, OLD)
                self.assertEqual(host.head, BASE)
                self.assertFalse(any(call[0] == 'compose' for call in host.calls))

    def test_stale_registry_fails_closed(self):
        host = FakeHost()
        with self.assertRaises(r.ReleaseError):
            self.install(host, list(reversed(REGISTRY)))
        self.assertFalse(any(call[:3] == ('docker', 'image', 'load') for call in host.calls))

    def test_rollback_failure_is_reported_separately(self):
        with self.assertRaisesRegex(r.ReleaseError, 'Rollback failed'):
            self.install(FakeHost('rollback'))
        self.assertEqual(self.events[-1][0], 'ROLLBACK_FAILED')

    def test_checksum_failure_precedes_all_host_actions(self):
        self.archive.write_bytes(b'corrupt')
        host = FakeHost()
        with self.assertRaisesRegex(r.ReleaseError, 'checksum'):
            self.install(host)
        self.assertEqual(host.calls, [])

    def test_archive_cannot_replace_latest_or_other_application_tags(self):
        for tags in ([r.COMPOSE_IMAGE], ['postgres:16'], ['offonika-portal-release:1.0.1-' + TARGET[:12], r.COMPOSE_IMAGE]):
            self.write_archive(tags)
            host = FakeHost()
            with self.assertRaisesRegex(r.ReleaseError, 'tags'):
                self.install(host)
            self.assertEqual(host.calls, [])

    def test_log_storage_failure_does_not_prevent_rollback(self):
        host = FakeHost('health')
        def broken_log(stage, **values):
            if stage == 'ROLLING_BACK':
                raise OSError('No space left on device')
            self.events.append((stage, values))
        with self.assertRaises(r.ReleaseError):
            r.install(host, self.manifest, self.bundle, REGISTRY, 'https://example.test', broken_log)
        self.assertEqual(host.image, OLD)
        self.assertEqual(host.head, BASE)
        self.assertEqual(self.events[-1][0], 'ROLLED_BACK')

    def test_capacity_plan_keeps_reserve_and_counts_all_layers_without_rebuilding(self):
        plan = r.capacity_plan(self.bundle, self.manifest)
        self.assertEqual(plan['reserve_bytes'], 15 * r.GIB)
        self.assertEqual(plan['archive_bytes'], self.archive.stat().st_size)
        self.assertEqual(plan['expanded_layer_bytes'], 10240)
        self.assertGreater(plan['before_transfer_bytes'], plan['before_load_bytes'])
        self.assertEqual(plan['before_transfer_bytes'] - plan['before_load_bytes'], self.archive.stat().st_size)
        self.assertEqual(plan['after_load_bytes'], 15 * r.GIB)
        self.assertEqual(r.validate_plan(plan), plan)

    def test_gzip_layer_is_budgeted_by_expanded_bytes_not_compressed_size(self):
        raw = io.BytesIO()
        with tarfile.open(fileobj=raw, mode='w') as layer:
            info = tarfile.TarInfo('compressible-file')
            body = b'x' * 1024 * 1024
            info.size = len(body)
            layer.addfile(info, io.BytesIO(body))
        packed = gzip.compress(raw.getvalue())
        metadata = json.dumps([dict(RepoTags=['offonika-portal-release:1.0.1-' + TARGET[:12]], Layers=['blob.gz'])]).encode()
        with tarfile.open(self.archive, 'w:gz') as archive:
            for name, data in [('manifest.json', metadata), ('blob.gz', packed)]:
                info = tarfile.TarInfo(name); info.size = len(data)
                archive.addfile(info, io.BytesIO(data))
        self.manifest['archive_sha256'] = r.digest(self.archive)
        plan = r.capacity_plan(self.bundle, self.manifest)
        self.assertEqual(plan['expanded_layer_bytes'], len(raw.getvalue()))
        self.assertEqual(plan['stored_layer_bytes'], len(packed))
        self.assertGreater(plan['expanded_layer_bytes'], 100 * plan['stored_layer_bytes'])

    def test_capacity_plan_rejects_missing_layers_and_tampered_floor(self):
        plan = r.capacity_plan(self.bundle, self.manifest)
        for field in ('reserve_bytes', 'load_headroom_bytes', 'before_transfer_bytes', 'before_load_bytes', 'after_load_bytes'):
            with self.subTest(field=field), self.assertRaises(r.ReleaseError):
                r.validate_plan(dict(plan, **{field: 1}))
        content = json.dumps([dict(RepoTags=['offonika-portal-release:1.0.1-' + TARGET[:12]], Layers=['absent'])]).encode()
        with tarfile.open(self.archive, 'w:gz') as archive:
            info = tarfile.TarInfo('manifest.json'); info.size = len(content)
            archive.addfile(info, io.BytesIO(content))
        self.manifest['archive_sha256'] = r.digest(self.archive)
        with self.assertRaisesRegex(r.ReleaseError, 'Missing'):
            r.capacity_plan(self.bundle, self.manifest)

    def test_shared_filesystem_does_not_double_count_docker_and_containerd(self):
        entries = [dict(device=1, path='/docker', available_bytes=30*r.GIB, load_bytes=4*r.GIB),
                   dict(device=1, path='/containerd', available_bytes=30*r.GIB, load_bytes=4*r.GIB),
                   dict(device=1, path='/bundle', available_bytes=30*r.GIB, archive_bytes=r.GIB)]
        report, = r.filesystem_budget(entries)
        self.assertEqual(report['required_bytes'], 20*r.GIB)
        self.assertEqual(report['shortfall_bytes'], 0)

    def test_separate_archive_filesystem_has_its_own_reserve_and_transfer_cost(self):
        entries = [dict(device=1, path='/docker', available_bytes=19*r.GIB, load_bytes=4*r.GIB),
                   dict(device=2, path='/bundle', available_bytes=15*r.GIB, archive_bytes=r.GIB)]
        docker, archive = r.filesystem_budget(entries)
        self.assertEqual(docker['shortfall_bytes'], 0)
        self.assertEqual(archive['shortfall_bytes'], r.GIB)
        archive_present, = r.filesystem_budget([dict(device=2, path='/bundle', available_bytes=15*r.GIB)])
        self.assertEqual(archive_present['required_bytes'], 15*r.GIB)

    def test_capacity_shortfall_is_detected_before_host_mutation_or_image_load(self):
        host = FakeHost()
        with patch.object(host, 'space', side_effect=r.ReleaseError('release headroom')):
            with self.assertRaisesRegex(r.ReleaseError, 'headroom'):
                self.install(host)
        self.assertEqual(host.calls, [])
        self.assertEqual(host.image, OLD)

    def test_manifest_rejects_wrong_architecture_paths_and_invalid_identities(self):
        for key, value in [('platform', 'linux/arm64'), ('archive', '../image.tar.gz'),
                           ('target', 'HEAD'), ('image', 'latest'), ('version', '1.0.1;touch /tmp/x')]:
            with self.subTest(key=key), self.assertRaises(r.ReleaseError):
                r.validate_manifest(dict(self.manifest, **{key: value}))

    def test_public_routes_reject_errors_and_unexpected_redirects(self):
        host = r.Host(self.bundle)
        for code in ('500', '502', '503', '404', '000', '302'):
            with patch.object(host, 'run', return_value=code), self.assertRaises(r.ReleaseError):
                host.public_routes('https://example.test')
        with patch.object(host, 'run', side_effect=['200'] + ['307'] * 9):
            host.public_routes('https://example.test')

    def test_snapshot_does_not_depend_on_env_order(self):
        left = container(OLD)
        left['Config']['Env'] = ['B=2', 'A=1']
        right = container(OLD)
        right['Config']['Env'] = ['A=1', 'B=2']
        self.assertEqual(r.snapshot(left), r.snapshot(right))


if __name__ == '__main__':
    unittest.main()
