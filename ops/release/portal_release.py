#!/usr/bin/env python3
"""Offline image preparation and guarded, explicitly invoked VPS installation.

No credentials, image/container pruning, migration execution or automatic registry
registration. Installation is intentionally limited to schema/config-compatible releases.
"""
import argparse
import datetime
import fcntl
import hashlib
import gzip
import io
import json
import os
from pathlib import Path
import re
import signal
import stat
import subprocess
import sys
import tempfile
import tarfile
import time
import urllib.request

GIB = 1024 ** 3
SPACE_FLOOR = 15 * GIB
APP = Path('/docker/employee-testing-app')
STORAGE_LAYOUT = Path('/usr/local/lib/offonika-release/storage-layout.json')
LOCK = Path('/run/lock/offonika-portal-storage.lock')
REGISTRY = Path('/var/lib/offonika-maintenance/verified-images.json')
COMPOSE_IMAGE = 'offonika-portal-portal-app:latest'
PROTECTED_PATHS = ['prisma', 'docker-compose.portal.yml', 'scripts/start-portal.mjs']


class ReleaseError(RuntimeError):
    pass


class CapacityError(ReleaseError):
    pass


def require(ok, message):
    if not ok:
        raise ReleaseError(message)


def read_storage_layout():
    """Root-published paths only; read-only checks never invoke Docker or sudo."""
    fd = os.open(STORAGE_LAYOUT, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        require(info.st_uid == 0 and not info.st_mode & 0o022 and stat.S_ISREG(info.st_mode)
                and info.st_nlink == 1 and info.st_size <= 16384, 'Untrusted storage layout')
        data = json.load(stream)
    require(data.get('format') == 1, 'Unsupported storage layout')
    for key in ('docker_root', 'containerd_root', 'app_root'):
        require(isinstance(data.get(key), str) and Path(data[key]).is_absolute(), 'Invalid storage path: ' + key)
    require(data['app_root'] == str(APP), 'Storage layout belongs to another application')
    return data


def digest(path):
    checksum = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            checksum.update(block)
    return checksum.hexdigest()


def validate_archive(path, manifest):
    # Reject any archive that could overwrite :latest or another application's tag.
    expected_tag = 'offonika-portal-release:' + manifest['version'] + '-' + manifest['target'][:12]
    with tarfile.open(path, 'r|gz') as archive:
        for member in archive:
            if member.name in ('manifest.json', './manifest.json'):
                require(member.isfile() and member.size <= 65536, 'Invalid archive manifest')
                items = json.load(archive.extractfile(member))
                require(len(items) == 1 and items[0].get('RepoTags') == [expected_tag], 'Unexpected image tags in archive')
                return items[0]
    raise ReleaseError('Missing Docker save manifest')


def capacity_plan(bundle, manifest):
    """Stream compressed layer contents, never trusting compressed image size as disk use.

    Shared layers are intentionally not subtracted: this is a conservative budget,
    not a promise of exact allocation. No files are extracted to the filesystem.
    """
    validate_manifest(manifest)
    archive = Path(bundle) / manifest['archive']
    require(digest(archive) == manifest['archive_sha256'], 'Archive checksum mismatch')
    metadata = validate_archive(archive, manifest)
    layers = metadata.get('Layers')
    require(isinstance(layers, list) and layers and all(isinstance(x, str) for x in layers)
            and len(set(layers)) == len(layers), 'Missing or duplicate image layers')
    pending = set(layers)
    stored = expanded = 0
    with tarfile.open(archive, 'r|gz') as tar:
        for member in tar:
            if member.name not in pending:
                continue
            require(member.isfile(), 'Image layer must be a regular file')
            pending.remove(member.name)
            stored += member.size
            with io.BufferedReader(tar.extractfile(member)) as stream:
                prefix = stream.peek(512)
                # Docker save can contain raw tar layers or gzip OCI blobs.
                if prefix[:2] == b'\x1f\x8b':
                    content = gzip.GzipFile(fileobj=stream, mode='rb')
                else:
                    require(len(prefix) >= 512 and (prefix[257:262] == b'ustar' or not any(prefix[:512])),
                            'Unsupported layer encoding; repack before planning')
                    content = stream
                try:
                    for block in iter(lambda: content.read(1024 * 1024), b''):
                        expanded += len(block)
                finally:
                    if content is not stream:
                        content.close()
    require(not pending and expanded > 0, 'Missing or empty image layer payload')
    archive_bytes = archive.stat().st_size
    # Budget blob storage, two expanded-layer equivalents (unpack/temp/FS
    # amplification), plus 1 GiB for metadata, allocation and concurrent growth.
    headroom = stored + 2 * expanded + GIB
    return dict(format=1, manifest=manifest, reserve_bytes=SPACE_FLOOR,
                archive_bytes=archive_bytes, stored_layer_bytes=stored,
                expanded_layer_bytes=expanded, load_headroom_bytes=headroom,
                before_transfer_bytes=SPACE_FLOOR + archive_bytes + headroom,
                before_load_bytes=SPACE_FLOOR + headroom, after_load_bytes=SPACE_FLOOR)


def validate_plan(plan):
    require(isinstance(plan, dict) and plan.get('format') == 1, 'Unsupported capacity plan')
    validate_manifest(plan.get('manifest', {}))
    for field in ('archive_bytes', 'stored_layer_bytes', 'expanded_layer_bytes', 'load_headroom_bytes'):
        require(type(plan.get(field)) is int and plan[field] > 0, 'Invalid capacity bytes: ' + field)
    headroom = plan['stored_layer_bytes'] + 2 * plan['expanded_layer_bytes'] + GIB
    require(plan.get('reserve_bytes') == SPACE_FLOOR and plan['load_headroom_bytes'] == headroom
            and plan.get('before_transfer_bytes') == SPACE_FLOOR + plan['archive_bytes'] + headroom
            and plan.get('before_load_bytes') == SPACE_FLOOR + headroom
            and plan.get('after_load_bytes') == SPACE_FLOOR, 'Capacity budget or 15 GiB reserve changed')
    return plan


def filesystem_budget(entries):
    """Combine roles sharing a filesystem; count load budget once and archive once."""
    groups = {}
    for entry in entries:
        group = groups.setdefault(entry['device'], dict(paths=[], available_bytes=entry['available_bytes'],
                                                       load_bytes=0, archive_bytes=0))
        group['paths'].append(entry['path'])
        group['available_bytes'] = min(group['available_bytes'], entry['available_bytes'])
        group['load_bytes'] = max(group['load_bytes'], entry.get('load_bytes', 0))
        group['archive_bytes'] = max(group['archive_bytes'], entry.get('archive_bytes', 0))
    reports = []
    for group in groups.values():
        required = SPACE_FLOOR + group['load_bytes'] + group['archive_bytes']
        reports.append(dict(paths=sorted(set(group['paths'])), reserve_bytes=SPACE_FLOOR,
                            required_bytes=required, available_bytes=group['available_bytes'],
                            shortfall_bytes=max(0, required - group['available_bytes'])))
    return reports


def version(value):
    require(isinstance(value, str) and re.fullmatch(r'\d+\.\d+\.\d+', value), 'Stable x.y.z version required')
    return tuple(map(int, value.split('.')))


def validate_manifest(data):
    require(data.get('format') == 1, 'Unsupported manifest')
    for key in ('base', 'target'):
        require(re.fullmatch(r'[a-f0-9]{40}', data.get(key, '')), 'Full commit required: ' + key)
    version(data.get('version'))
    require(re.fullmatch(r'sha256:[a-f0-9]{64}', data.get('image', '')), 'Invalid image ID')
    require(re.fullmatch(r'[a-f0-9]{64}', data.get('archive_sha256', '')), 'Invalid archive checksum')
    require(data.get('platform') == 'linux/amd64', 'VPS requires linux/amd64')
    require(data.get('archive') == 'image.tar.gz', 'Unexpected archive name')
    return data


class Host:
    def __init__(self, app=APP):
        self.app = Path(app)

    def run(self, *args, timeout=300, cwd=None):
        result = subprocess.run(args, cwd=cwd or self.app, text=True, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, timeout=timeout)
        # Never echo env/config or raw command output on failures: it may contain secrets.
        require(result.returncode == 0, 'Command failed: ' + args[0] + ' (exit ' + str(result.returncode) + ')')
        return result.stdout.strip()

    def git(self, *args):
        if os.geteuid() == 0:
            return self.run('runuser', '-u', 'bela', '--', 'git', *args)
        return self.run('git', *args)

    def inspect(self, kind, ident):
        return json.loads(self.run('docker', kind, 'inspect', ident))[0]

    def current(self):
        return self.inspect('container', 'portal-app')

    def compose(self):
        return self.run('env', 'PORTAL_ENV_FILE=server.env', 'docker', 'compose',
                        '--env-file', 'server.env', '-f', 'docker-compose.portal.yml',
                        'up', '-d', '--no-build', '--no-deps', 'portal-app')

    def metadata(self):
        return json.loads(self.run('docker', 'exec', 'portal-app', 'node', '-e',
                                  "process.stdout.write(require('fs').readFileSync('/app/public/release-info.json','utf8'))"))

    def public_json(self, origin, route):
        # No redirects: a health redirect must not be mistaken for a healthy app.
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *args):
                return None
        request = urllib.request.Request(origin + route, headers={'Cache-Control': 'no-cache'})
        with urllib.request.build_opener(NoRedirect).open(request, timeout=15) as response:
            require(response.status == 200, 'Public check failed: ' + route)
            return json.load(response)

    def public_routes(self, origin):
        for route, accepted in [('/login', {200}), ('/employee', {200, 307}),
                                ('/admin/workday', {200, 307}), ('/admin/payroll', {200, 307})]:
            code = self.run('curl', '--silent', '--show-error', '--max-time', '15',
                            '--output', '/dev/null', '--write-out', '%{http_code}', origin + route)
            require(int(code) in accepted, 'Unexpected HTTP status ' + code + ' for ' + route)

    def space(self, headroom=0, archive_path=None, archive_bytes=0, storage_layout=None):
        # Predict destination capacity before transfer; check again after transfer
        # and extraction. Existing archive bytes are already reflected in f_bavail.
        if storage_layout is None:
            root = self.run('docker', 'info', '--format', '{{.DockerRootDir}}')
            containerd = Path('/var/lib/containerd')
        else:
            root = storage_layout['docker_root']
            containerd = Path(storage_layout['containerd_root'])
        roles = [(Path(root), headroom, 0), (containerd, headroom, 0), (self.app, 0, 0)]
        if archive_path is not None:
            roles.append((Path(archive_path), 0, archive_bytes))
        entries = []
        for destination, load_bytes, transfer_bytes in roles:
            path = destination.resolve()
            while not path.exists() and path != path.parent:
                path = path.parent
            stats = os.statvfs(path)
            entries.append(dict(path=str(destination), device=path.stat().st_dev,
                                available_bytes=stats.f_bavail * stats.f_frsize,
                                load_bytes=load_bytes, archive_bytes=transfer_bytes))
        reports = filesystem_budget(entries)
        print('SPACE_CHECK ' + json.dumps(reports), flush=True)
        if any(item['shortfall_bytes'] for item in reports):
            raise CapacityError('Insufficient release capacity; archive/load headroom must remain above the 15 GiB reserve')
        return reports

    def wait(self, image, timeout=180):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            container = self.current()
            state = container['State']
            if container['Image'] == image and state['Status'] == 'running' and state.get('Health', {}).get('Status') == 'healthy':
                return
            if state['Status'] in ('exited', 'dead'):
                break
            time.sleep(3)
        raise ReleaseError('Container did not become healthy')


def snapshot(container):
    # Hashes compare confidential settings without writing them to the release log.
    fields = {'env': sorted(container['Config'].get('Env') or []),
              'mounts': sorted(container['Mounts'], key=lambda m: m['Destination'])}
    return hashlib.sha256(json.dumps(fields, sort_keys=True).encode()).hexdigest()


def verify_metadata(info, manifest):
    require(info.get('version') == manifest['version'] and info.get('revision') == manifest['target']
            and info.get('source') == 'clean', 'Release metadata does not match committed source')
    require(isinstance(info.get('builtAt'), str), 'Missing build date')
    datetime.datetime.fromisoformat(info['builtAt'].replace('Z', '+00:00'))


def preflight(host, manifest, registry, origin):
    require(host.git('rev-parse', 'HEAD') == manifest['base'], 'Server base changed; rebuild/reconcile release')
    status = host.git('status', '--porcelain', '--untracked-files=all')
    require(not status or all(line.startswith('?? .rollback/') for line in status.splitlines()), 'Server checkout has unrelated changes')
    host.git('fetch', 'origin', 'design-local-updates')
    host.git('merge-base', '--is-ancestor', manifest['target'], 'origin/design-local-updates')
    host.git('merge-base', '--is-ancestor', manifest['base'], manifest['target'])
    require(not host.git('diff', '--name-only', manifest['base'], manifest['target'], '--', *PROTECTED_PATHS),
            'Schema, migrations or deployment configuration changed; use a separately reviewed release')
    pkg = json.loads(host.git('show', manifest['target'] + ':package.json'))
    lock = json.loads(host.git('show', manifest['target'] + ':package-lock.json'))
    require(pkg['version'] == lock['version'] == lock['packages']['']['version'] == manifest['version'], 'Package versions differ')
    old_info = host.metadata()
    public_info = host.public_json(origin, '/release-info.json')
    require(public_info == old_info, 'Public and container release identities differ')
    base_pkg = json.loads(host.git('show', manifest['base'] + ':package.json'))
    require(old_info.get('version') == base_pkg['version'], 'Checkout and installed version differ')
    require(version(manifest['version']) > version(old_info['version']), 'New release must increase version')
    current = host.current()
    require(current['State']['Status'] == 'running' and current['State'].get('Health', {}).get('Status') == 'healthy', 'Current release is unhealthy')
    require(isinstance(registry, list) and len(registry) == len(set(registry)) == 3
            and registry[0] == current['Image'], 'Verified registry does not match current release plus two rollback images')
    for ident in registry:
        require(re.fullmatch(r'sha256:[a-f0-9]{64}', ident), 'Invalid registry identity')
        host.inspect('image', ident)
    # Startup invokes migrate deploy. Refuse pending/drifted migrations before restart.
    host.run('docker', 'exec', 'portal-app', 'node', 'node_modules/prisma/build/index.js', 'migrate', 'status')
    host.space()
    return current, old_info


def install(host, manifest, bundle, registry, origin, record):
    validate_manifest(manifest)
    record('PREFLIGHT', target=manifest['target'], version=manifest['version'])
    archive = Path(bundle) / manifest['archive']
    require(digest(archive) == manifest['archive_sha256'], 'Archive checksum mismatch')
    plan = capacity_plan(bundle, manifest)
    record('CAPACITY_PLANNED', **{key: value for key, value in plan.items() if key != 'manifest'})
    host.space(headroom=plan['load_headroom_bytes'], archive_path=archive)
    old, old_info = preflight(host, manifest, registry, origin)
    old_image = old['Image']
    old_snapshot = snapshot(old)
    db_id = host.inspect('container', 'portal-postgres')['Id']
    old_tag = host.inspect('image', COMPOSE_IMAGE)['Id']
    require(old_tag == old_image, 'Compose image tag differs from running image')
    record('LOADING', previous_image=old_image, target_image=manifest['image'])
    host.run('docker', 'image', 'load', '-i', str(archive), timeout=600)
    image = host.inspect('image', manifest['image'])
    expected_tag = 'offonika-portal-release:' + manifest['version'] + '-' + manifest['target'][:12]
    require(host.inspect('image', expected_tag)['Id'] == manifest['image'], 'Loaded image tag does not match manifest identity')
    require(image['Os'] == 'linux' and image['Architecture'] == 'amd64', 'Wrong image architecture')
    # Isolated one-shot process: no secrets, network, volumes or startup/migrations.
    candidate = json.loads(host.run('docker', 'run', '--rm', '--network', 'none', '--read-only',
                                   '--entrypoint', 'node', manifest['image'], '-e',
                                   "process.stdout.write(require('fs').readFileSync('/app/public/release-info.json','utf8'))"))
    verify_metadata(candidate, manifest)
    host.space(archive_path=archive)  # After loading, preserve the full reserve on every filesystem.
    require(host.git('rev-parse', 'HEAD') == manifest['base'] and host.current()['Image'] == old_image,
            'Server changed during preparation')
    host.run('docker', 'image', 'tag', old_image, 'portal-app:rollback-before-' + manifest['version'])
    # This journal survives interruption. The image load must never overwrite :latest.
    record('INSTALLING', previous_image=old_image, base=manifest['base'], target_image=manifest['image'])
    try:
        host.git('checkout', '--detach', manifest['target'])
        host.run('docker', 'image', 'tag', manifest['image'], COMPOSE_IMAGE)
        host.compose()
        host.wait(manifest['image'])
        require(snapshot(host.current()) == old_snapshot, 'Environment or upload mounts changed')
        require(host.inspect('container', 'portal-postgres')['Id'] == db_id, 'Database container changed')
        verify_metadata(host.metadata(), manifest)
        require(host.public_json(origin, '/api/health').get('ok') is True, 'Public health check failed')
        host.public_routes(origin)
        public = host.public_json(origin, '/release-info.json')
        verify_metadata(public, manifest)
        require(public == candidate, 'Public and image build identities differ')
        require(host.git('rev-parse', 'HEAD') == manifest['target'], 'Server commit changed')
        # Registration is deliberately separate, after independent business/UI checks.
        record('AWAITING_INDEPENDENT_VERIFICATION', previous_image=old_image, target_image=manifest['image'])
    except BaseException:
        # A full disk or broken log pipe must never prevent restoration.
        def recovery_record(stage, **values):
            try:
                record(stage, **values)
            except Exception:
                print('RECOVERY_LOG_UNAVAILABLE stage=' + stage, file=sys.stderr, flush=True)
        recovery_record('ROLLING_BACK', previous_image=old_image, base=manifest['base'])
        try:
            host.git('checkout', '--detach', manifest['base'])
            host.run('docker', 'image', 'tag', old_image, COMPOSE_IMAGE)
            host.compose()
            host.wait(old_image)
            require(snapshot(host.current()) == old_snapshot, 'Rollback environment/mount mismatch')
            require(host.inspect('container', 'portal-postgres')['Id'] == db_id, 'Rollback database container mismatch')
            host.public_routes(origin)
            require(host.metadata() == old_info, 'Rollback metadata mismatch')
            require(host.public_json(origin, '/api/health').get('ok') is True, 'Rollback public health failed')
            require(host.public_json(origin, '/release-info.json') == old_info, 'Rollback public identity mismatch')
            recovery_record('ROLLED_BACK', previous_image=old_image)
        except BaseException:
            recovery_record('ROLLBACK_FAILED', previous_image=old_image, base=manifest['base'])
            raise ReleaseError('Rollback failed; preserve journal and recover the recorded image/base manually')
        raise


def prepare(host, base, target, output, receipts_enabled):
    require(re.fullmatch(r'[a-f0-9]{40}', base) and re.fullmatch(r'[a-f0-9]{40}', target), 'Use full commits')
    host.git('merge-base', '--is-ancestor', base, target)
    require(not host.git('diff', '--name-only', base, target, '--', *PROTECTED_PATHS), 'Incompatible schema/config change')
    pkg = json.loads(host.git('show', target + ':package.json'))
    lock = json.loads(host.git('show', target + ':package-lock.json'))
    require(pkg['version'] == lock['version'] == lock['packages']['']['version'], 'Package versions differ')
    require(version(pkg['version']) > version(json.loads(host.git('show', base + ':package.json'))['version']), 'Version must increase')
    output = Path(output).resolve()
    require(not output.exists(), 'Output already exists; preserve prior attempts')
    output.mkdir(parents=True, mode=0o700)
    tag = 'offonika-portal-release:' + pkg['version'] + '-' + target[:12]
    with tempfile.TemporaryDirectory(prefix='portal-release-source-') as directory:
        # Committed files only; dirty/untracked files and local secrets never enter the build.
        source = Path(directory)
        tar = source / 'source.tar'
        host.git('archive', '--format=tar', '--output=' + str(tar), target)
        host.run('tar', '-xf', str(tar), '-C', directory)
        tar.unlink()
        build_started = time.monotonic()
        print('BUILDING linux/amd64 from committed archive ' + target, flush=True)
        host.run('docker', 'buildx', 'build', '--platform', 'linux/amd64', '--load',
                 '--build-arg', 'PORTAL_BUILD_REVISION=' + target,
                 '--build-arg', 'NEXT_PUBLIC_PROCUREMENT_RECEIPTS_ENABLED=' + receipts_enabled, '-t', tag, directory, timeout=1800)
        print('BUILD_COMPLETE seconds=' + str(round(time.monotonic() - build_started, 2)), flush=True)
        image = host.inspect('image', tag)
        require(image['Os'] == 'linux' and image['Architecture'] == 'amd64', 'Builder produced wrong platform')
        archive = output / 'image.tar.gz'
        # Streaming prevents a multi-GB image from entering Python memory.
        with archive.open('wb') as stream:
            save = subprocess.Popen(['docker', 'image', 'save', tag], stdout=subprocess.PIPE)
            try:
                zipped = subprocess.run(['gzip', '-1'], stdin=save.stdout, stdout=stream)
                save.stdout.close()
                require(save.wait() == 0 and zipped.returncode == 0, 'Image archive export failed')
            finally:
                if save.poll() is None:
                    save.terminate()
                    save.wait()
    manifest = dict(format=1, base=base, target=target, version=pkg['version'], image=image['Id'],
                    platform='linux/amd64', archive='image.tar.gz', archive_sha256=digest(archive))
    validate_manifest(manifest)
    validate_archive(archive, manifest)
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (output / 'capacity.json').write_text(json.dumps(capacity_plan(output, manifest), indent=2) + '\n')
    print(json.dumps(manifest, indent=2), flush=True)


def main():
    if len(sys.argv) > 1 and sys.argv[1].startswith('session-'):
        from portal_release_session import main as session_main
        return session_main(sys.argv[1:])
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    build = sub.add_parser('prepare')
    build.add_argument('--base', required=True)
    build.add_argument('--target', required=True)
    build.add_argument('--output', required=True)
    build.add_argument('--receipts-enabled', required=True, choices=('0', '1'),
                       help='Use the already approved production build flag; do not change it during release hardening')
    deploy = sub.add_parser('install')
    deploy.add_argument('--bundle', required=True)
    deploy.add_argument('--origin', required=True)
    deploy.add_argument('--apply', action='store_true', help='Explicitly install; otherwise validate manifest/archive only')
    planner = sub.add_parser('plan', help='Measure an existing bundle locally, without rebuilding it')
    planner.add_argument('--bundle', required=True)
    planner.add_argument('--output', required=True, help='New capacity JSON file; transfer this small file first')
    checker = sub.add_parser('check-space', help='Read-only VPS capacity check before transferring the archive')
    checker.add_argument('--plan', required=True)
    checker.add_argument('--archive-directory', required=True)
    checker.add_argument('--archive-present', action='store_true')
    args = parser.parse_args()
    if args.command == 'check-space':
        plan = validate_plan(json.loads(Path(args.plan).read_text()))
        archive = Path(args.archive_directory).resolve() / 'image.tar.gz'
        if args.archive_present:
            require(archive.is_file() and archive.stat().st_size == plan['archive_bytes']
                    and digest(archive) == plan['manifest']['archive_sha256'], 'Transferred archive does not match capacity plan')
        if os.geteuid() != 0:
            return Host().space(headroom=plan['load_headroom_bytes'], archive_path=archive,
                                archive_bytes=0 if args.archive_present else plan['archive_bytes'],
                                storage_layout=read_storage_layout())
        with LOCK.open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return Host().space(headroom=plan['load_headroom_bytes'], archive_path=archive,
                                archive_bytes=0 if args.archive_present else plan['archive_bytes'])
    if args.command == 'plan':
        bundle = Path(args.bundle).resolve()
        manifest = validate_manifest(json.loads((bundle / 'manifest.json').read_text()))
        plan = capacity_plan(bundle, manifest)
        with Path(args.output).open('x') as stream:
            stream.write(json.dumps(plan, indent=2) + '\n')
        print(json.dumps(plan, indent=2), flush=True)
        return
    if args.command == 'prepare':
        return prepare(Host(Path.cwd()), args.base, args.target, args.output, args.receipts_enabled)
    bundle = Path(args.bundle).resolve()
    manifest = validate_manifest(json.loads((bundle / 'manifest.json').read_text()))
    require(digest(bundle / manifest['archive']) == manifest['archive_sha256'], 'Archive checksum mismatch')
    require(re.fullmatch(r'https://[a-zA-Z0-9.-]+(?::\d+)?', args.origin), 'HTTPS origin required, without path')
    validate_archive(bundle / manifest['archive'], manifest)
    if not args.apply:
        print('BUNDLE_VALIDATED_ONLY; server/container/registry untouched')
        return
    require(os.geteuid() == 0, 'Installation needs sudo in native Terminal')
    # Immutable reviewed bundle/script must be root-owned before privileged execution.
    for path in (bundle, bundle / 'manifest.json', bundle / manifest['archive'], Path(__file__).resolve()):
        for part in (path, *path.parents):
            stat = part.stat()
            require(stat.st_uid == 0 and stat.st_mode & 0o022 == 0,
                    'Root-owned, non-writable bundle/script and parent directories required')
    with LOCK.open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        # Fail before any action if logging is unavailable; keep unique attempt history.
        journal_dir = Path('/var/lib/offonika-maintenance/releases')
        journal_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        journal = journal_dir / (str(time.time_ns()) + '.jsonl')
        started = time.monotonic()
        with journal.open('x', buffering=1) as stream:
            os.chmod(journal, 0o600)
            def record(stage, **values):
                item = dict(stage=stage, elapsed_seconds=round(time.monotonic() - started, 2), **values)
                stream.write(json.dumps(item) + '\n')
                stream.flush()
                os.fsync(stream.fileno())
                print(json.dumps(item), flush=True)
            def interrupted(signum, frame):
                raise ReleaseError('Interrupted by signal ' + str(signum))
            for signum in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
                signal.signal(signum, interrupted)
            install(Host(), manifest, bundle, json.loads(REGISTRY.read_text()), args.origin, record)
        print('Registry unchanged. Independently verify business/UI states before register-verified.', flush=True)


if __name__ == '__main__':
    try:
        main()
    except (ReleaseError, OSError, ValueError, subprocess.SubprocessError, tarfile.TarError, EOFError) as error:
        print('RELEASE_FAILED: ' + str(error), file=sys.stderr)
        sys.exit(1)
