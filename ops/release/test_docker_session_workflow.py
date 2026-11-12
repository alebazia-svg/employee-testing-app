"""Real local Docker/HTTP/owner-file/registry transitions across three releases.
Source ancestry and DB migration state are adapters; this never uses production.
"""
import builtins
import contextlib
import gzip
import importlib.util
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import uuid

import portal_release_session as session
from test_portal_release import FakeHost

core = session.core


@unittest.skipUnless(os.getenv('PORTAL_RELEASE_DOCKER_TEST') == '1', 'Opt-in local Docker session workflow')
class DockerSessionWorkflow(unittest.TestCase):
    def test_three_verified_releases_preserve_current_and_two_reserves(self):
        prefix='portal-session-cycle-'+uuid.uuid4().hex[:10]
        minor=int(uuid.uuid4().hex[:6],16)
        temporary=tempfile.TemporaryDirectory(prefix=prefix)
        root=Path(temporary.name)
        tags=[]
        with socket.socket() as sock:
            sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
        origin='http://127.0.0.1:'+str(port)
        names=[prefix+'-app',prefix+'-db']
        def docker(*args):
            return subprocess.check_output(['docker',*args],text=True).strip()
        try:
            (root/'server.cjs').write_text("""const http=require('http'),fs=require('fs');
const meta=JSON.parse(fs.readFileSync('/app/public/release-info.json','utf8'));
http.createServer((q,s)=>{s.setHeader('content-type','application/json');s.end(JSON.stringify(q.url==='/release-info.json'?meta:{ok:true,screenVersion:meta.version}));}).listen(3000,'0.0.0.0');""")
            (root/'Dockerfile').write_text('FROM node:22-bookworm-slim\nWORKDIR /app\nCOPY meta.json /app/public/release-info.json\nCOPY server.cjs ./server.cjs\nCMD ["node","server.cjs"]\n')
            records=[]
            for index in range(6):
                version=('8.'+str(minor)+'.'+str(8+index)) if index<2 else ('9.'+str(minor)+'.'+str(index-2))
                commit=uuid.uuid4().hex+uuid.uuid4().hex[:8]
                metadata=dict(version=version,revision=commit,source='clean',builtAt='2026-11-12T00:00:00Z')
                tag='offonika-portal-release:'+version+'-'+commit[:12]
                (root/'meta.json').write_text(json.dumps(metadata))
                docker('build','--platform','linux/amd64','-q','-t',tag,str(root)); tags.append(tag)
                records.append(dict(meta=metadata,tag=tag,image=json.loads(docker('image','inspect',tag))[0]['Id']))
            compose_tag=prefix+':installed'; tags.append(compose_tag)
            docker('tag',records[2]['image'],compose_tag)
            compose=root/'compose.json'
            compose.write_text(json.dumps(dict(services={
                'app':dict(image=compose_tag,container_name=names[0],ports=['127.0.0.1:'+str(port)+':3000'],healthcheck=dict(
                    test=['CMD','node','-e',"fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"],interval='1s',timeout='3s',retries=3)),
                'db':dict(image=records[0]['tag'],container_name=names[1])})))
            command=['docker','compose','-p',prefix,'-f',str(compose)]
            subprocess.run(command+['up','-d'],capture_output=True,check=True)
            registry=root/'registry.json'; registry.write_text(json.dumps([records[2]['image'],records[1]['image'],records[0]['image']]))
            spec=importlib.util.spec_from_file_location('cycle_maintenance',Path(__file__).resolve().parents[2]/'docs/ops/maintenance/portal-storage-maintenance.py')
            maintenance=importlib.util.module_from_spec(spec); spec.loader.exec_module(maintenance)
            real=core.Host(root)
            by_commit={item['meta']['revision']:item for item in records}
            head=records[2]['meta']['revision']
            original_docker=maintenance.docker
            original_run=subprocess.run
            def inspect(kind, ids):
                ids=[names[0] if item=='portal-app' else item for item in ids]
                return json.loads(docker(kind,'inspect',*ids)) if ids else []
            def scoped_docker(*args):
                if args[:3]==('image','ls','-aq'):
                    present=set(docker('image','ls','-aq','--no-trunc').split())
                    return '\n'.join(item['image'] for item in records if item['image'] in present)
                return original_docker(*args)
            def scoped_run(args, **kwargs):
                if args[:3]==['docker','buildx','prune']:
                    return subprocess.CompletedProcess(args,0)  # Never prune the developer's builder.
                if args[:3]==['docker','image','rm']:
                    self.assertTrue(all(tag in tags for tag in args[3:]))
                return original_run(args,**kwargs)
            class DockerHost(FakeHost):
                def git(self,*args):
                    nonlocal head
                    if args[:2]==('rev-parse','HEAD'): return head
                    if args[0]=='show':
                        item=by_commit[args[1].split(':')[0]]
                        version=item['meta']['version']
                        return json.dumps(dict(version=version,packages={'':dict(version=version)}))
                    if args[0]=='checkout': head=args[-1]
                    return ''
                def current(self): return real.inspect('container',names[0])
                def inspect(self,kind,ident):
                    if ident=='portal-postgres': ident=names[1]
                    if ident==core.COMPOSE_IMAGE: ident=compose_tag
                    return real.inspect(kind,ident)
                def metadata(self):
                    return json.loads(real.run('docker','exec',names[0],'cat','/app/public/release-info.json'))
                def public_json(self,ignored,route): return real.public_json(origin,route)
                def public_routes(self,ignored): return real.public_routes(origin)
                def compose(self): original_run(command+['up','-d','--no-build','--no-deps','app'],capture_output=True,check=True)
                def wait(self,image,**kw): core.Host.wait(self,image,timeout=30)
                def space(self,**kwargs): return []  # Native test FS, not VPS capacity accounting.
                def run(self,*args,**kwargs):
                    if args[0]==session.MAINTENANCE:
                        with patch('sys.argv',['maintenance',*args[1:]]): maintenance.main()
                        return ''
                    if 'migrate' in args: return ''  # No application DB in this transport fixture.
                    args=tuple(compose_tag if arg==core.COMPOSE_IMAGE else arg for arg in args)
                    if args[:3]==('docker','image','tag') and args[-1].startswith('portal-app:rollback-before-'):
                        tags.append(args[-1])
                    return real.run(*args,**kwargs)
            host=DockerHost()
            host.wait(records[2]['image'])
            with contextlib.ExitStack() as stack:
                stack.enter_context(patch.object(core,'LOCK',root/'storage.lock'))
                stack.enter_context(patch.object(core,'REGISTRY',registry))
                stack.enter_context(patch.object(maintenance,'STATE',registry))
                stack.enter_context(patch.object(maintenance,'inspect',side_effect=inspect))
                stack.enter_context(patch.object(maintenance,'docker',side_effect=scoped_docker))
                stack.enter_context(patch.object(maintenance,'open',side_effect=lambda path,*a,**k: builtins.open(root/'storage.lock' if str(path)=='/run/lock/offonika-portal-storage.lock' else path,*a,**k),create=True))
                stack.enter_context(patch.object(maintenance.subprocess,'run',side_effect=scoped_run))
                stack.enter_context(patch.object(session.os,'chown'))
                for index in (3,4,5):
                    target=records[index]
                    incoming=root/('incoming-'+str(index)); incoming.mkdir(mode=0o700)
                    archive=incoming/'image.tar.gz'
                    with archive.open('wb') as output:
                        save=subprocess.Popen(['docker','save',target['tag']],stdout=subprocess.PIPE)
                        with gzip.GzipFile(fileobj=output,mode='wb',compresslevel=1) as zipped:
                            shutil.copyfileobj(save.stdout,zipped,1024*1024)
                        save.stdout.close(); self.assertEqual(save.wait(),0)
                    manifest=dict(format=1,base=head,target=target['meta']['revision'],version=target['meta']['version'],
                        image=target['image'],platform='linux/amd64',archive='image.tar.gz',archive_sha256=core.digest(archive))
                    plan=core.capacity_plan(incoming,manifest)
                    attempt=root/('attempt-'+str(index)); (attempt/'bundle').mkdir(parents=True)
                    (attempt/'bundle/manifest.json').write_text(json.dumps(manifest))
                    token=uuid.uuid4().hex; exchange=root/('portal-release-session-'+token); exchange.mkdir()
                    request=dict(session=token,manifest=manifest,plan=plan,incoming=str(incoming),exchange=str(exchange),
                        owner_uid=os.getuid(),origin=origin,review_timeout=60,upload_timeout=60,approved_maintenance=False,remove_archive=True)
                    (exchange/'ready.json').write_text(json.dumps(request))
                    events=[]
                    if index==3:
                        baseline=(host.current()['Id'],real.public_json(origin,'/release-info.json'),registry.read_bytes())
                        for failure in ('capacity','expired_upload'):
                            failed_attempt=root/('failed-'+failure); (failed_attempt/'bundle').mkdir(parents=True)
                            failed_request=dict(request)
                            failed_request['exchange']=str(root/('diagnostic-'+failure)); Path(failed_request['exchange']).mkdir()
                            original_space=host.space
                            if failure=='capacity':
                                def limited_space(**kwargs):
                                    if kwargs.get('headroom'):
                                        available=os.statvfs(root).f_bavail*os.statvfs(root).f_frsize
                                        real.space(headroom=available+core.GIB,archive_path=archive,
                                            storage_layout={'docker_root':str(root),'containerd_root':str(root)})
                                    return []
                                host.space=limited_space
                                with self.assertRaises(core.CapacityError):
                                    session.receive(failed_request,failed_attempt,lambda *a,**k:None,host)
                            else:
                                empty=root/'expired-incoming'; empty.mkdir(); failed_request['incoming']=str(empty)
                                times=iter([0,0,61])
                                with self.assertRaisesRegex(core.ReleaseError,'Upload timed out'):
                                    session.receive(failed_request,failed_attempt,lambda *a,**k:None,host,
                                        clock=lambda:next(times),sleep=lambda n:None)
                            host.space=original_space
                            self.assertEqual((host.current()['Id'],real.public_json(origin,'/release-info.json'),registry.read_bytes()),baseline)
                    def review(req,record):
                        visible=real.public_json(origin,'/release-info.json')
                        self.assertEqual(visible['revision'],target['meta']['revision'])
                        self.assertEqual(real.public_json(origin,'/login')['screenVersion'],target['meta']['version'])
                        session.confirm(SimpleNamespace(exchange=str(exchange),confirm_independent_verification=True,reject=False))
                        return session.wait_review(req,record)
                    self.assertTrue(session.execute(request,attempt,lambda stage,**values:events.append(stage),host=host,review=review))
                    expected=[records[index-i]['image'] for i in range(3)]
                    self.assertEqual(json.loads(registry.read_text()),expected)
                    for image in expected: docker('image','inspect',image)
                    self.assertEqual(events[-1],'COMPLETE')
                    self.assertFalse((attempt/'bundle/image.tar.gz').exists())
                    self.assertEqual(host.current()['Image'],target['image'])
        finally:
            if (root/'compose.json').exists():
                subprocess.run(['docker','compose','-p',prefix,'-f',str(root/'compose.json'),'down'],capture_output=True)
            if tags: subprocess.run(['docker','image','rm',*set(tags)],capture_output=True)
            temporary.cleanup()


if __name__=='__main__': unittest.main()
