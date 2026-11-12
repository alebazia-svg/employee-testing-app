#!/usr/bin/env python3
"""Conservative host maintenance; never prune containers, volumes or unknown images."""
import argparse
import fcntl
import json
import os
import re
import shutil
import stat
import subprocess
import tempfile
from pathlib import Path

MIN_FREE_BYTES = 15 * 1024**3

STATE = Path('/var/lib/offonika-maintenance/verified-images.json')
HISTORY = Path('/var/lib/offonika-maintenance/verified-history.json')
ROLLBACK_TAG = re.compile(r'^(portal-app:rollback-before-\d+\.\d+\.\d+|mobo-access-rollback:\d+\.\d+\.\d+|offonika-portal-access-rollback:pre-\d+\.\d+\.\d+-\d{8})$')
PORTAL_REPOS = {'portal-app', 'offonika-portal-portal-app', 'mobo-access-rollback', 'offonika-portal-access-rollback'}


def portal_digest(digest, generated=False):
    repo, separator, checksum = digest.partition('@')
    repo = repo.removeprefix('docker.io/library/')
    return bool(separator and repo in PORTAL_REPOS | ({'offonika-portal-release'} if generated else set())
                and re.fullmatch(r'sha256:[a-f0-9]{64}', checksum))


def release_tag(value):
    if not isinstance(value, dict) or not re.fullmatch(r'\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?', str(value.get('version', ''))) \
            or not re.fullmatch(r'[a-f0-9]{40}', str(value.get('revision', ''))):
        raise ValueError('Invalid verified history identity')
    return 'offonika-portal-release:' + value['version'] + '-' + value['revision'][:12]


def load_history():
    try:
        fd = os.open(HISTORY, os.O_RDONLY | os.O_NOFOLLOW)
    except FileNotFoundError:
        return {}
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        if info.st_uid != 0 or info.st_mode & 0o022 or not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > 4*1024**2:
            raise ValueError('Untrusted verified history')
        values = json.load(stream)
    if not isinstance(values, dict):
        raise ValueError('Invalid verified history')
    for image, value in values.items():
        if not re.fullmatch(r'sha256:[a-f0-9]{64}', image):
            raise ValueError('Invalid verified image identity')
        release_tag(value)
    return values


def save_history(values):
    fd, temporary = tempfile.mkstemp(prefix='.verified-history-', dir=HISTORY.parent)
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(values, stream, indent=2); stream.flush(); os.fsync(stream.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, HISTORY)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)


def docker(*args):
    return subprocess.check_output(['docker', *args], text=True).strip()


def inspect(kind, ids):
    return json.loads(docker(kind, 'inspect', *ids)) if ids else []


def used_images():
    return {c['Image'] for c in inspect('container', docker('ps', '-aq').split())}


def candidates(images, protected, used, history=None):
    history = history or {}
    def allowed(item):
        known = release_tag(history[item['Id']]) if item['Id'] in history else None
        return all(ROLLBACK_TAG.fullmatch(t) or (known is not None and t == known) for t in item['RepoTags']) \
            and all(portal_digest(d, generated=known is not None) for d in item.get('RepoDigests', []))
    return [i for i in images if i['Id'] not in protected | used
            and i.get('RepoTags')
            and allowed(i)]


def inventory(images, protected, used, current, required, available, history=None):
    eligible = {image['Id'] for image in candidates(images, set(protected), used, history)}
    rows = []
    for item in images:
        tags = item.get('RepoTags') or []
        if item['Id'] not in set(protected) | {current} and not any(
                tag.split(':')[0] in PORTAL_REPOS or tag.startswith('offonika-portal-release:') for tag in tags):
            continue
        reason = ('protected' if item['Id'] in protected or item['Id'] == current else
                  'container_used' if item['Id'] in used else
                  'eligible_old_portal_image' if item['Id'] in eligible else 'unrecognised_or_mixed_identity')
        rows.append(dict(id=item['Id'], tags=tags, protected=item['Id'] in protected or item['Id'] == current,
                         used=item['Id'] in used, eligible=item['Id'] in eligible, reason=reason))
    return dict(format=1, current_image=current, verified_images=protected, images=rows,
                capacity=dict(reserve_bytes=MIN_FREE_BYTES, required_bytes=required, available_bytes=available,
                              shortfall_bytes=max(0, required-available)))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--report-json', action='store_true', help='Read-only bounded release storage report')
    parser.add_argument('--register-verified', action='store_true',
                        help='Only after independently verifying the current release')
    parser.add_argument('--expected-current', help='Guard registration against a concurrent release (full image ID)')
    parser.add_argument('--release-headroom-bytes', type=int, default=0,
                        help='Additional temporary release capacity above the unchanged 15 GiB reserve')
    args = parser.parse_args()
    if args.release_headroom_bytes < 0 or (args.release_headroom_bytes and args.register_verified):
        raise ValueError('Release headroom must be nonnegative and is not a registration option')
    if args.report_json and (args.apply or args.register_verified):
        raise ValueError('Storage report cannot apply cleanup or registration')
    target_free_bytes = MIN_FREE_BYTES + args.release_headroom_bytes
    if args.expected_current and (not (args.register_verified or args.apply) or not re.fullmatch(r'sha256:[a-f0-9]{64}', args.expected_current)):
        raise ValueError('--expected-current requires registration or cleanup and a full image ID')
    with open('/run/lock/offonika-portal-storage.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        current = inspect('container', ['portal-app'])[0]['Image']
        if args.expected_current and current != args.expected_current:
            raise ValueError('Running image changed since independent verification; refusing operation')
        verified = json.loads(STATE.read_text())
        if not isinstance(verified, list) or not all(re.fullmatch(r'sha256:[a-f0-9]{64}', i) for i in verified):
            raise ValueError('Invalid verified image registry; refusing cleanup')
        if args.register_verified:
            verified = list(dict.fromkeys([current, *verified]))[:3]
            if len(verified) != 3:
                raise ValueError('Need current release and two verified rollback images')
            inspect('image', verified)
            history = load_history()
            metadata = json.loads(docker('exec', 'portal-app', 'cat', '/app/public/release-info.json'))
            release_tag(metadata)
            value = dict(version=metadata['version'], revision=metadata['revision'])
            if current in history and history[current] != value:
                raise ValueError('Verified image history identity changed')
            history[current] = value
            save_history(history)
            temporary = STATE.with_suffix('.tmp')
            temporary.write_text(json.dumps(verified, indent=2) + '\n')
            temporary.replace(STATE)
            print('Registered verified release:', current)
            return
        if len(verified) != 3 or len(set(verified)) != 3 or current != verified[0]:
            raise ValueError('Current release not registered with two rollback images; refusing cleanup')
        inspect('image', verified)
        history = load_history()
        images = inspect('image', list(set(docker('image', 'ls', '-aq', '--no-trunc').split())))
        if args.report_json:
            print(json.dumps(inventory(images, verified, used_images(), current, target_free_bytes, shutil.disk_usage('/').free, history)))
            return
        for item in candidates(images, set(verified), used_images(), history):
            print('Unused old portal rollback:', item['Id'], item['RepoTags'], flush=True)
            if args.apply:
                # Recheck identity, tags and every container, including stopped ones.
                fresh = inspect('image', [item['Id']])[0]
                if not candidates([fresh], set(verified), used_images(), history):
                    continue
                for tag in fresh['RepoTags']:
                    if item['Id'] in used_images():
                        raise ValueError('Image became container-used; refusing cleanup')
                    if inspect('image', [tag])[0]['Id'] != item['Id']:
                        raise ValueError('Image tag changed; refusing cleanup')
                    subprocess.run(['docker', 'image', 'rm', tag], check=True)
        if args.apply:
            # This is a retention target, not a hard disk quota. Active cache is safe.
            subprocess.run(['docker', 'buildx', 'prune', '--all', '--force',
                            '--max-used-space', '5GB', '--min-free-space', str(target_free_bytes)], check=True)
        free = shutil.disk_usage('/').free
        print('Free GiB:', round(free / 1024**3, 2), flush=True)
        print('Capacity bytes:', {'reserve': MIN_FREE_BYTES, 'release_headroom': args.release_headroom_bytes,
                                  'required': target_free_bytes, 'shortfall': max(0, target_free_bytes - free)}, flush=True)
        if free < target_free_bytes:
            raise RuntimeError('Insufficient release capacity above 15 GiB reserve: do not deploy; inspect disk usage')

if __name__ == '__main__':
    main()
