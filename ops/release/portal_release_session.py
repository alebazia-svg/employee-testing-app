#!/usr/bin/env python3
"""One authorised transient worker per exact release; no sudo policy changes."""
import argparse
import contextlib
import io
import fcntl
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import signal
import stat
import subprocess
import sys
import time
import uuid

import portal_release as core

SESSIONS = Path('/var/lib/offonika-maintenance/sessions')
MAINTENANCE = '/usr/local/sbin/portal-storage-maintenance'


def read_data(path, limit=65536):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        core.require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and info.st_size <= limit,
                     'Expected bounded regular data file')
        return stream.read(limit + 1)


def root_file(path, data):
    with Path(path).open('xb') as stream:
        os.chmod(path, 0o600)
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def trusted(path):
    for part in (Path(path), *Path(path).parents):
        info = part.stat()
        core.require(info.st_uid == 0 and not info.st_mode & 0o022, 'Immutable root-owned session/tools required')


def append_log(path, uid, event):
    fd = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_NOFOLLOW)
    with os.fdopen(fd, 'a') as stream:
        info = os.fstat(stream.fileno())
        core.require(stat.S_ISREG(info.st_mode) and info.st_uid == uid and info.st_nlink == 1,
                     'Invalid owner-readable session log')
        stream.write(json.dumps(event) + '\n')
        stream.flush()
        os.fsync(stream.fileno())


def review_matches(value, request):
    return (isinstance(value, dict) and value.get('session') == request['session']
            and value.get('target') == request['manifest']['target']
            and value.get('image') == request['manifest']['image']
            and value.get('decision') in ('verified', 'reject'))


def wait_review(request, record, clock=time.monotonic, sleep=time.sleep):
    deadline = clock() + request['review_timeout']
    path = Path(request['exchange']) / 'review.json'
    while clock() < deadline:
        try:
            value = json.loads(read_data(path))
        except FileNotFoundError:
            sleep(2)
            continue
        core.require(review_matches(value, request), 'Review is not bound to this exact session/image/commit')
        return value['decision']
    record('REVIEW_TIMED_OUT_UNREGISTERED')
    return 'timeout'


def _receive(request, attempt, record, host, clock=time.monotonic, sleep=time.sleep):
    plan = core.validate_plan(request['plan'])
    source = Path(request['incoming'])
    archive = source / 'image.tar.gz'
    try:
        with core.LOCK.open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            core.preflight(host, request['manifest'], json.loads(core.REGISTRY.read_text()), request['origin'])
            host.space(headroom=plan['load_headroom_bytes'], archive_path=archive, archive_bytes=plan['archive_bytes'])
    except core.ReleaseError as error:
        if not request['approved_maintenance'] or 'Insufficient release capacity' not in str(error):
            raise
        # Explicitly included in the reviewed session; same protected retention
        # policy, one pass only. No parent lock while maintenance takes its lock.
        host.run(MAINTENANCE, '--apply', '--release-headroom-bytes',
                 str(plan['before_transfer_bytes'] - core.SPACE_FLOOR))
        with core.LOCK.open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            core.preflight(host, request['manifest'], json.loads(core.REGISTRY.read_text()), request['origin'])
            host.space(headroom=plan['load_headroom_bytes'], archive_path=archive, archive_bytes=plan['archive_bytes'])
    record('READY_FOR_TRANSFER', incoming=str(source))
    deadline = clock() + request['upload_timeout']
    while not archive.exists():
        core.require(clock() < deadline, 'Upload timed out; current app unchanged')
        sleep(2)
    info = archive.lstat()
    core.require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and info.st_uid == request['owner_uid']
                 and info.st_size == plan['archive_bytes'], 'Invalid uploaded archive identity/size')
    core.require(core.digest(archive) == request['manifest']['archive_sha256'], 'Uploaded archive checksum mismatch')
    destination = Path(attempt) / 'bundle' / 'image.tar.gz'
    core.require(source.stat().st_dev == destination.parent.stat().st_dev, 'Use same-filesystem promotion')
    os.rename(archive, destination)
    os.chown(destination, 0, 0)
    os.chmod(destination, 0o600)
    core.require(core.digest(destination) == request['manifest']['archive_sha256'], 'Promoted archive changed')
    record('ARCHIVE_RECEIVED')


def publish_diagnostic(request, attempt, report):
    data = json.dumps(report, indent=2).encode()
    root_file(Path(attempt) / 'diagnostic.json', data)
    directory = Path(request['exchange'])
    temporary = directory / ('diagnostic-' + uuid.uuid4().hex + '.tmp')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        if os.geteuid() == 0:
            os.fchown(stream.fileno(), request['owner_uid'], -1)
        else:
            core.require(os.geteuid() == request['owner_uid'], 'Wrong diagnostic owner')
        stream.write(data); stream.flush(); os.fsync(stream.fileno())
    os.replace(temporary, directory / 'diagnostic.json')


def receive(request, attempt, record, host, clock=time.monotonic, sleep=time.sleep):
    try:
        return _receive(request, attempt, record, host, clock=clock, sleep=sleep)
    except core.ReleaseError as error:
        if not isinstance(error, core.CapacityError) and 'Insufficient release capacity' not in str(error):
            raise
        report = dict(format=1, session=request['session'], target=request['manifest']['target'],
                      state='BLOCKED_CAPACITY', app_switched_by_this_session=False, error=str(error))
        if hasattr(host, 'storage_diagnostic'):
            report.update(host.storage_diagnostic(request))
        publish_diagnostic(request, attempt, report)
        record('DIAGNOSTIC_AVAILABLE', path=str(Path(request['exchange']) / 'diagnostic.json'))
        raise core.CapacityError(str(error)) from error


class SessionHost(core.Host):
    def __init__(self, record):
        super().__init__()
        self.record = record

    def run(self, *args, **kwargs):
        if args and args[0] == MAINTENANCE:
            result = subprocess.run(args, cwd=self.app, text=True, capture_output=True, timeout=120)
            self.record('MAINTENANCE_RESULT', exit_code=result.returncode,
                        stdout=result.stdout[-16384:], stderr=result.stderr[-8192:])
            if result.returncode:
                if 'Insufficient release capacity' in result.stderr:
                    raise core.CapacityError('Insufficient release capacity after the approved maintenance pass')
                raise core.ReleaseError('Storage maintenance failed; technical output is in this session log')
            return result.stdout.strip()
        return super().run(*args, **kwargs)

    def storage_diagnostic(self, request):
        data = dict(plan=request['plan'], last_space_report=getattr(self, 'last_space_report', None))
        try:
            raw = self.run(MAINTENANCE, '--report-json', '--release-headroom-bytes',
                           str(request['plan']['before_transfer_bytes'] - core.SPACE_FLOOR))
            data['storage'] = json.loads(raw)
        except Exception as error:
            data['storage_report_error'] = type(error).__name__
        try:
            data['docker_disk'] = self.run('docker', 'system', 'df', '--format', '{{json .}}', timeout=30)
        except Exception as error:
            data['docker_report_error'] = type(error).__name__
        return data

    def space(self, *args, **kwargs):
        output = io.StringIO()
        try:
            with contextlib.redirect_stdout(output):
                return super().space(*args, **kwargs)
        finally:
            if output.getvalue():
                self.last_space_report = output.getvalue().strip()
                self.record('CAPACITY_DETAIL', output=self.last_space_report)


def execute(request, attempt, record, host=None, review=wait_review, receive_bundle=receive):
    host = host or SessionHost(record)
    manifest = core.validate_manifest(request['manifest'])
    bundle = Path(attempt) / 'bundle'
    receive_bundle(request, attempt, record, host)
    # Existing install lock, capacity checks, schema guard and rollback are reused.
    with core.LOCK.open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        core.install(host, manifest, bundle, json.loads(core.REGISTRY.read_text()), request['origin'], record)
    decision = review(request, record)
    if decision != 'verified':
        record('UNREGISTERED', reason=decision)
        return False
    # Do not certify a concurrent or replaced release. No parent lock is held
    # while maintenance acquires its own lock with the expected-image guard.
    core.require(host.git('rev-parse', 'HEAD') == manifest['target'], 'Server commit changed during review')
    host.wait(manifest['image'])
    core.verify_metadata(host.metadata(), manifest)
    core.verify_metadata(host.public_json(request['origin'], '/release-info.json'), manifest)
    core.require(host.public_json(request['origin'], '/api/health').get('ok') is True, 'Public health failed after review')
    core.require(core.contract.probe(host) == manifest['artifact'], 'Running capabilities changed during independent review')
    host.public_routes(request['origin'])
    host.run(MAINTENANCE, '--register-verified', '--expected-current', manifest['image'])
    registry = json.loads(core.REGISTRY.read_text())
    core.require(len(registry) == len(set(registry)) == 3 and registry[0] == manifest['image'], 'Registry finalisation failed')
    for image in registry:
        host.inspect('image', image)
    if request['remove_archive']:
        # Only the archive created/promoted into this root-owned attempt.
        (bundle / 'image.tar.gz').unlink()
    # Owner-approved policy: only after exact verification/registration. Failure
    # is advisory for future capacity, never false failure of a verified release.
    try:
        host.run(MAINTENANCE, '--apply', '--expected-current', manifest['image'])
        record('VERIFIED_RETENTION_COMPLETE')
    except Exception as error:
        record('VERIFIED_RETENTION_WARNING', error_type=type(error).__name__)
    core.require(json.loads(core.REGISTRY.read_text()) == registry, 'Registry changed during retention')
    for image in registry:
        host.inspect('image', image)
    storage_status = 'not_available'
    if hasattr(host, 'storage_diagnostic'):
        try:
            report = dict(format=1, session=request['session'], target=manifest['target'],
                          state='VERIFIED_RELEASE_STORAGE_REPORT', **host.storage_diagnostic(request))
            publish_diagnostic(request, attempt, report)
            storage_status = 'reported'
            record('STORAGE_REPORT_AVAILABLE', path=str(Path(request['exchange']) / 'diagnostic.json'))
        except Exception as error:
            storage_status = 'report_failed'
            record('STORAGE_REPORT_UNAVAILABLE', error_type=type(error).__name__)
    record('COMPLETE', image=manifest['image'], target=manifest['target'], storage_report=storage_status)
    return True


def worker(attempt):
    attempt = Path(attempt).resolve()
    core.require(attempt.parent == SESSIONS and re.fullmatch(r'[a-f0-9]{32}', attempt.name), 'Invalid session identity')
    trusted(attempt)
    request = json.loads(read_data(attempt / 'request.json'))
    core.require(request['session'] == attempt.name, 'Session identity mismatch')
    started = time.monotonic()
    def record(stage, **values):
        event = dict(stage=stage, elapsed_seconds=round(time.monotonic() - started, 2), **values)
        # The private journal remains independent of the public monitor file.
        with (attempt / 'journal.jsonl').open('a') as journal:
            os.chmod(attempt / 'journal.jsonl', 0o600)
            journal.write(json.dumps(event) + '\n'); journal.flush(); os.fsync(journal.fileno())
        try:
            append_log(Path(request['exchange']) / 'events.jsonl', request['owner_uid'], event)
        except Exception:
            print('MONITOR_LOG_UNAVAILABLE stage=' + stage, file=sys.stderr, flush=True)
    def interrupted(signum, frame):
        raise core.ReleaseError('Worker interrupted by signal ' + str(signum))
    for signum in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
        signal.signal(signum, interrupted)
    try:
        record('STARTED', target=request['manifest']['target'])
        return execute(request, attempt, record)
    except core.CapacityError as error:
        record('BLOCKED_CAPACITY', message=str(error))
        return False
    except BaseException as error:
        record('FAILED', error_type=type(error).__name__,
               message=str(error) if isinstance(error, (core.ReleaseError, core.contract.ContractError)) else 'See private attempt evidence')
        raise


def start(args):
    raw_plan = read_data(args.plan)
    core.require(hashlib.sha256(raw_plan).hexdigest() == args.plan_sha256, 'Reviewed capacity/manifest plan changed')
    plan = core.validate_plan(json.loads(raw_plan))
    manifest = plan['manifest']
    core.require(re.fullmatch(r'https://[a-zA-Z0-9.-]+(?::\d+)?', args.origin), 'HTTPS origin required')
    core.require(60 <= args.review_timeout <= 3600 and 60 <= args.upload_timeout <= 1800,
                 'Invalid bounded upload/review timeouts')
    if not args.apply:
        print('SESSION_VALIDATED_ONLY; no worker or application action')
        return
    core.require(os.geteuid() == 0, 'Start the exact approved session with sudo in native Terminal')
    trusted(Path(__file__).resolve())
    owner = pwd.getpwnam('bela')
    source = Path(args.incoming).resolve()
    core.require(source.is_relative_to(Path(owner.pw_dir).resolve()) and source.is_dir()
                 and source.stat().st_uid == owner.pw_uid and not source.stat().st_mode & 0o077,
                 'Use a private Bela-owned incoming directory')
    core.require(not (source / 'image.tar.gz').exists(), 'Wait for READY_FOR_TRANSFER before uploading')
    SESSIONS.mkdir(parents=True, exist_ok=True, mode=0o700)
    trusted(SESSIONS)
    token = uuid.uuid4().hex
    attempt = SESSIONS / token
    attempt.mkdir(mode=0o700)
    bundle = attempt / 'bundle'
    bundle.mkdir(mode=0o700)
    core.require(source.stat().st_dev == bundle.stat().st_dev, 'Use same-filesystem archive promotion')
    exchange = Path(owner.pw_dir) / ('portal-release-session-' + token)
    exchange.mkdir(mode=0o700)
    os.chown(exchange, owner.pw_uid, owner.pw_gid)
    log = exchange / 'events.jsonl'
    fd = os.open(log, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    os.fchown(fd, owner.pw_uid, owner.pw_gid); os.close(fd)
    request = dict(session=token, manifest=manifest, plan=plan, incoming=str(source), origin=args.origin,
                   exchange=str(exchange), owner_uid=owner.pw_uid, review_timeout=args.review_timeout,
                   upload_timeout=args.upload_timeout, remove_archive=args.remove_archive,
                   approved_maintenance=args.approved_storage_maintenance)
    core.require(len(json.dumps(request).encode()) <= 65536, 'Capability/session request exceeds bounded input; review inventory size before release')
    root_file(attempt / 'request.json', json.dumps(request).encode())
    root_file(bundle / 'manifest.json', json.dumps(manifest).encode())
    ready = exchange / 'ready.json'
    root_file(ready, json.dumps(request).encode())
    os.chown(ready, owner.pw_uid, owner.pw_gid)
    # Start detached so native Terminal/SSH disconnect does not kill the release.
    unit = 'portal-release-' + token
    subprocess.run(['systemd-run', '--unit', unit, '--collect', '--property=RuntimeMaxSec=' + str(args.upload_timeout + args.review_timeout + 1200),
                    '--property=TimeoutStopSec=300', '/usr/bin/python3', str(Path(__file__).resolve()),
                    'session-worker', '--attempt', str(attempt)], check=True, timeout=30)
    print(json.dumps(dict(session=token, unit=unit, exchange=str(exchange), state='STARTED_NOT_COMPLETE')), flush=True)


def confirm(args):
    core.require(args.confirm_independent_verification or args.reject, 'Explicit independent verification or rejection required')
    exchange = Path(args.exchange).resolve()
    request = json.loads(read_data(exchange / 'ready.json'))
    core.validate_manifest(request['manifest'])
    core.require(exchange.name == 'portal-release-session-' + request['session'], 'Exchange/session mismatch')
    value = dict(session=request['session'], target=request['manifest']['target'], image=request['manifest']['image'],
                 decision='reject' if args.reject else 'verified')
    # Ordinary owner data, never a command/script. Root worker checks exact identity.
    temporary = exchange / ('review-' + uuid.uuid4().hex + '.tmp')
    root_file(temporary, json.dumps(value).encode())
    core.require(not (exchange / 'review.json').exists(), 'Review already submitted')
    os.replace(temporary, exchange / 'review.json')
    print('REVIEW_SUBMITTED; monitor events.jsonl for COMPLETE, not this command exit alone')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    launch = sub.add_parser('session-start')
    launch.add_argument('--plan', required=True)
    launch.add_argument('--plan-sha256', required=True)
    launch.add_argument('--incoming', required=True)
    launch.add_argument('--origin', required=True)
    launch.add_argument('--review-timeout', type=int, default=1800)
    launch.add_argument('--upload-timeout', type=int, default=900)
    launch.add_argument('--approved-storage-maintenance', action='store_true',
                        help='Only if this exact session includes approval for one existing retention pass')
    launch.add_argument('--remove-archive', action='store_true', help='Remove only this session archive after verified registration')
    launch.add_argument('--apply', action='store_true')
    acknowledge = sub.add_parser('session-confirm')
    acknowledge.add_argument('--exchange', required=True)
    acknowledge.add_argument('--confirm-independent-verification', action='store_true')
    acknowledge.add_argument('--reject', action='store_true')
    run = sub.add_parser('session-worker')
    run.add_argument('--attempt', required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == 'session-start':
            return start(args)
        if args.command == 'session-confirm':
            return confirm(args)
        core.require(os.geteuid() == 0, 'Worker requires the authorised root session')
        if not worker(args.attempt):
            raise SystemExit(2)
        return
    except (core.ReleaseError, OSError, ValueError, subprocess.SubprocessError) as error:
        print('SESSION_FAILED: ' + str(error), file=sys.stderr)
        raise SystemExit(1)


if __name__ == '__main__':
    main()
