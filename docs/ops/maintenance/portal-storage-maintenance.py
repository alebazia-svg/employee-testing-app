#!/usr/bin/env python3
"""Conservative host maintenance; never prune containers, volumes or unknown images."""
import argparse
import fcntl
import json
import re
import shutil
import subprocess
from pathlib import Path

STATE = Path('/var/lib/offonika-maintenance/verified-images.json')
ROLLBACK_TAG = re.compile(r'^(portal-app:rollback-before-\d+\.\d+\.\d+|mobo-access-rollback:\d+\.\d+\.\d+|offonika-portal-access-rollback:pre-\d+\.\d+\.\d+-\d{8})$')
PORTAL_REPOS = {'portal-app', 'offonika-portal-portal-app', 'mobo-access-rollback', 'offonika-portal-access-rollback'}


def portal_digest(digest):
    repo, separator, checksum = digest.partition('@')
    repo = repo.removeprefix('docker.io/library/')
    return bool(separator and repo in PORTAL_REPOS and re.fullmatch(r'sha256:[a-f0-9]{64}', checksum))


def docker(*args):
    return subprocess.check_output(['docker', *args], text=True).strip()


def inspect(kind, ids):
    return json.loads(docker(kind, 'inspect', *ids)) if ids else []


def used_images():
    return {c['Image'] for c in inspect('container', docker('ps', '-aq').split())}


def candidates(images, protected, used):
    return [i for i in images if i['Id'] not in protected | used
            and i.get('RepoTags')
            and all(ROLLBACK_TAG.fullmatch(t) for t in i['RepoTags'])
            and all(portal_digest(d) for d in i.get('RepoDigests', []))]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--register-verified', action='store_true',
                        help='Only after independently verifying the current release')
    args = parser.parse_args()
    lock = open('/run/lock/offonika-portal-storage.lock', 'w')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    current = inspect('container', ['portal-app'])[0]['Image']
    verified = json.loads(STATE.read_text())
    if not isinstance(verified, list) or not all(re.fullmatch(r'sha256:[a-f0-9]{64}', i) for i in verified):
        raise ValueError('Invalid verified image registry; refusing cleanup')
    if args.register_verified:
        verified = list(dict.fromkeys([current, *verified]))[:3]
        if len(verified) != 3:
            raise ValueError('Need current release and two verified rollback images')
        inspect('image', verified)
        temporary = STATE.with_suffix('.tmp')
        temporary.write_text(json.dumps(verified, indent=2) + '\n')
        temporary.replace(STATE)
        print('Registered verified release:', current)
        return
    if len(verified) != 3 or len(set(verified)) != 3 or current != verified[0]:
        raise ValueError('Current release not registered with two rollback images; refusing cleanup')
    inspect('image', verified)
    images = inspect('image', list(set(docker('image', 'ls', '-aq', '--no-trunc').split())))
    for item in candidates(images, set(verified), used_images()):
        print('Unused old portal rollback:', item['Id'], item['RepoTags'], flush=True)
        if args.apply:
            # Recheck identity, tags and every container, including stopped ones.
            fresh = inspect('image', [item['Id']])[0]
            if not candidates([fresh], set(verified), used_images()):
                continue
            for tag in fresh['RepoTags']:
                if inspect('image', [tag])[0]['Id'] != item['Id']:
                    raise ValueError('Image tag changed; refusing cleanup')
                subprocess.run(['docker', 'image', 'rm', tag], check=True)
    if args.apply:
        # This is a retention target, not a hard disk quota. Active cache is safe.
        subprocess.run(['docker', 'buildx', 'prune', '--all', '--force',
                        '--max-used-space', '5GB', '--min-free-space', '15GB'], check=True)
    free = shutil.disk_usage('/').free
    print('Free GiB:', round(free / 1024**3, 2), flush=True)
    if free < 15 * 1024**3:
        raise RuntimeError('Less than 15 GiB free: do not deploy; inspect disk usage')


if __name__ == '__main__':
    main()
