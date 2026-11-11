"""Opt-in real Docker transitions; only uniquely named fixture containers are touched.
Run: PORTAL_RELEASE_DOCKER_TEST=1 python3 -m unittest discover -s ops/release -p test_docker_release.py -v
Git/public HTTP are fixtures; Docker load, tag, recreate, health and rollback are real.
"""
import gzip
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
import uuid

from test_portal_release import FakeHost, BASE, TARGET, NEW_INFO, OLD_INFO, r


@unittest.skipUnless(os.getenv('PORTAL_RELEASE_DOCKER_TEST') == '1', 'Opt-in Docker fixture test')
class DockerReleaseTests(unittest.TestCase):
    def test_prepare_uses_committed_source_and_embeds_exact_revision(self):
        import shutil
        with tempfile.TemporaryDirectory(prefix='portal-prepare-test-') as directory:
            root = Path(directory)
            source = root / 'source'
            source.mkdir()
            (source / 'scripts').mkdir()
            shutil.copy(Path(__file__).resolve().parents[2] / 'scripts/write-release-info.mjs',
                        source / 'scripts/write-release-info.mjs')
            (source / 'Dockerfile').write_text("""FROM node:22-bookworm-slim
WORKDIR /app
ARG PORTAL_BUILD_REVISION
ENV PORTAL_BUILD_REVISION=$PORTAL_BUILD_REVISION
COPY . .
RUN mkdir -p public && node scripts/write-release-info.mjs
""")
            host = r.Host(source)
            host.run('git', 'init', '-q')
            def commit(value):
                (source / 'package.json').write_text(json.dumps(dict(version=value)))
                (source / 'package-lock.json').write_text(json.dumps(dict(version=value, packages={'': dict(version=value)})))
                host.run('git', 'add', 'Dockerfile', 'scripts/write-release-info.mjs', 'package.json', 'package-lock.json')
                host.run('git', '-c', 'user.name=Release fixture', '-c', 'user.email=release@example.test', 'commit', '-qm', value)
                return host.git('rev-parse', 'HEAD')
            base = commit('1.0.0')
            target = commit('1.0.1')
            # Neither this secret nor the dirty version may enter the committed source build.
            (source / '.env').write_text('FIXTURE_SECRET=must-not-enter-image')
            (source / 'package.json').write_text(json.dumps(dict(version='9.9.9')))
            tag = 'offonika-portal-release:1.0.1-' + target[:12]
            try:
                output = root / 'bundle'
                r.prepare(host, base, target, output, '0')
                data = r.validate_manifest(json.loads((output / 'manifest.json').read_text()))
                self.assertEqual(data['archive_sha256'], r.digest(output / 'image.tar.gz'))
                result = json.loads(host.run('docker', 'run', '--rm', '--network', 'none', '--entrypoint', 'node', data['image'],
                    '-e', "process.stdout.write(JSON.stringify({meta:require('./public/release-info.json'),secret:require('fs').existsSync('/app/.env')}))"))
                r.verify_metadata(result['meta'], data)
                self.assertFalse(result['secret'])
                self.assertEqual(result['meta']['version'], '1.0.1')
            finally:
                subprocess.run(['docker', 'image', 'rm', tag], capture_output=True)

    def test_install_and_failed_public_check_restore_real_previous_container(self):
        prefix = 'portal-release-test-' + uuid.uuid4().hex[:10]
        temp = tempfile.TemporaryDirectory(prefix=prefix)
        root = Path(temp.name)
        tags = []
        fixture_target = uuid.uuid4().hex + uuid.uuid4().hex[:8]
        names = [prefix + '-app', prefix + '-db']
        def docker(*args, **kwargs):
            return subprocess.check_output(['docker', *args], text=True, **kwargs).strip()
        try:
            (root / 'server.cjs').write_text("""
const http=require('http'), fs=require('fs');
const meta=fs.readFileSync('/app/public/release-info.json','utf8');
http.createServer((q,s)=>{s.end(q.url==='/release-info.json'?meta:JSON.stringify({ok:true}));}).listen(3000,'0.0.0.0');
""")
            (root / 'Dockerfile').write_text('''FROM node:22-bookworm-slim
WORKDIR /app
COPY metadata.json /app/public/release-info.json
COPY server.cjs /app/server.cjs
CMD ["node", "/app/server.cjs"]
''')
            ids = []
            for index, meta in enumerate((OLD_INFO, dict(NEW_INFO, revision=fixture_target), dict(OLD_INFO, version='0.9.0'), dict(OLD_INFO, version='0.8.0'))):
                tag = prefix + ':' + str(index)
                tags.append(tag)
                (root / 'metadata.json').write_text(json.dumps(meta))
                docker('build', '--platform', 'linux/amd64', '-q', '-t', tag, str(root))
                ids.append(json.loads(docker('image', 'inspect', tag))[0]['Id'])
            old, new, *previous = ids
            # UUID isolated target prevents touching production release tags.
            release_tag = 'offonika-portal-release:1.0.1-' + fixture_target[:12]
            tags.append(release_tag)
            docker('tag', new, release_tag)
            archive = root / 'image.tar.gz'
            with archive.open('wb') as dest:
                proc = subprocess.Popen(['docker', 'save', release_tag], stdout=subprocess.PIPE)
                with gzip.GzipFile(fileobj=dest, mode='wb', compresslevel=1) as zipped:
                    while chunk := proc.stdout.read(1024 * 1024):
                        zipped.write(chunk)
                proc.stdout.close()
                self.assertEqual(proc.wait(), 0)
            compose_tag = prefix + ':installed'
            tags.append(compose_tag)
            docker('tag', old, compose_tag)
            compose = root / 'compose.json'
            compose.write_text(json.dumps(dict(services={
                'app': dict(image=compose_tag, container_name=names[0], healthcheck=dict(
                    test=['CMD', 'node', '-e', "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"],
                    interval='1s', timeout='3s', retries=3)),
                'db': dict(image=tags[0], container_name=names[1]),
            })))
            command = ['docker', 'compose', '-p', prefix, '-f', str(compose)]
            subprocess.run(command + ['up', '-d'], check=True, capture_output=True)
            manifest = dict(format=1, base=BASE, target=fixture_target, version='1.0.1', image=new,
                            archive='image.tar.gz', platform='linux/amd64', archive_sha256=r.digest(archive))
            real = r.Host(root)
            class DockerHost(FakeHost):
                def current(self):
                    return real.inspect('container', names[0])
                def inspect(self, kind, ident):
                    if ident == 'portal-postgres':
                        ident = names[1]
                    if ident == r.COMPOSE_IMAGE:
                        ident = compose_tag
                    return real.inspect(kind, ident)
                def run(self, *args, **kwargs):
                    if 'migrate' in args:
                        return ''  # No real database/schema in this isolated transition fixture.
                    args = tuple(compose_tag if arg == r.COMPOSE_IMAGE else arg for arg in args)
                    if args[:4] == ('docker', 'image', 'tag', old) and args[-1].startswith('portal-app:rollback-'):
                        return ''  # Production rollback tags must never be touched by a fixture.
                    return real.run(*args, **kwargs)
                def compose(self):
                    subprocess.run(command + ['up', '-d', '--no-build', '--no-deps', 'app'], check=True, capture_output=True)
                def wait(self, image, **kwargs):
                    r.Host.wait(self, image, timeout=30)
                def metadata(self):
                    return json.loads(real.run('docker', 'exec', names[0], 'cat', '/app/public/release-info.json'))
                def public_json(self, origin, route):
                    if route == '/api/health':
                        return dict(ok=True)
                    return self.metadata()
                def public_routes(self, origin):
                    if self.fail == 'route' and self.current()['Image'] == new:
                        raise r.ReleaseError('Injected external HTTP 502')
                def space(self):
                    pass  # No production host paths in the local fixture.
                def git(self, *args):
                    if args[0] == 'checkout' and args[-1] == fixture_target:
                        self.head = fixture_target
                        return ''
                    return super().git(*args)
            for failure in (None, 'route'):
                docker('tag', old, compose_tag)
                subprocess.run(command + ['up', '-d', '--no-build', '--no-deps', 'app'], check=True, capture_output=True)
                host = DockerHost(failure)
                host.wait(old)
                events = []
                if failure:
                    with self.assertRaisesRegex(r.ReleaseError, '502'):
                        r.install(host, manifest, root, [old, *previous], 'https://fixture.test', lambda stage, **kw: events.append(stage))
                    self.assertEqual(host.current()['Image'], old)
                    self.assertEqual(events[-1], 'ROLLED_BACK')
                else:
                    r.install(host, manifest, root, [old, *previous], 'https://fixture.test', lambda stage, **kw: events.append(stage))
                    self.assertEqual(host.current()['Image'], new)
                    self.assertEqual(events[-1], 'AWAITING_INDEPENDENT_VERIFICATION')
        finally:
            if (root / 'compose.json').exists():
                subprocess.run(['docker', 'compose', '-p', prefix, '-f', str(root / 'compose.json'), 'down'], capture_output=True)
            if tags:
                # Exact fixture tags only. No pruning, volumes or existing app containers.
                subprocess.run(['docker', 'image', 'rm', *tags], capture_output=True)
            temp.cleanup()


if __name__ == '__main__':
    unittest.main()
