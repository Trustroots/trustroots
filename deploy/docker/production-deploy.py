#!/usr/bin/env python3
"""Deploy and roll back app containers with prerequisite and session checks."""
import argparse
from datetime import datetime, timezone
import fcntl
import getpass
import http.cookiejar
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
import uuid

SERVICES = ('webapp', 'worker')


def run(args, timeout=60, capture=True):
    result = subprocess.run(args, timeout=timeout, check=True, text=True,
                            stdout=subprocess.PIPE if capture else None,
                            stderr=subprocess.PIPE if capture else None)
    return result.stdout.strip() if capture else ''


def compose(args):
    return ['docker', 'compose', '-f', str(args.compose)]


def image_ids(args):
    images = {}
    for service in SERVICES:
        container = run(compose(args) + ['ps', '-q', service])
        if not container or '\n' in container:
            raise RuntimeError('Expected one running container for ' + service)
        images[service] = run(['docker', 'inspect', '--format', '{{.Image}}', container])
    return images


def validate_logging(service, driver, options):
    if driver != 'local':
        raise RuntimeError(service + ' must explicitly use local logging; migrate existing containers separately')
    if not re.fullmatch(r'[1-9][0-9]*[kKmMgG]', str(options.get('max-size', ''))) or \
            not re.fullmatch(r'[1-9][0-9]*', str(options.get('max-file', ''))):
        raise RuntimeError(service + ' must set positive local logging max-size and max-file limits')


def check_existing_logging(args):
    for service in (*SERVICES, 'mongodb'):
        # Include stopped containers: they can still be removed during recreation.
        containers = run(compose(args) + ['ps', '--all', '--quiet', service], timeout=15).split()
        if not containers:
            continue
        configs = run(['docker', 'inspect', '--format', '{{json .HostConfig.LogConfig}}',
                       *containers], timeout=15).splitlines()
        if len(configs) != len(containers):
            raise RuntimeError('Could not inspect existing ' + service + ' logging')
        for value in configs:
            config = json.loads(value)
            validate_logging('Existing ' + service, config.get('Type'), config.get('Config') or {})


PROFILE_PHOTO_MOUNT = '/home/app/trustroots/public/uploads-profile'
CIRCLE_IMAGE_MOUNT = '/home/app/trustroots/public/uploads-circle'


def require_media_directory(service, volumes, target, label, media):
    mounts = [volume for volume in volumes if volume.get('target') == target]
    if len(mounts) != 1 or mounts[0].get('type') != 'bind':
        raise RuntimeError(service + ' must bind mount ' + label)
    source = Path(mounts[0]['source']).resolve()
    if not source.is_relative_to(media) or not source.is_dir():
        raise RuntimeError(label.capitalize() + ' directory must exist on the required media mount')


def preflight(args, runtime=True):
    if not os.path.ismount(args.media_mount):
        raise RuntimeError('Required media filesystem is not mounted: ' + str(args.media_mount))
    config = json.loads(run(compose(args) + ['config', '--format', 'json']))
    for service in (*SERVICES, 'mongodb'):
        definition = config['services'][service]
        logging = definition.get('logging', {})
        validate_logging(service, logging.get('driver'), logging.get('options') or {})
    media = args.media_mount.resolve()
    for service in SERVICES:
        volumes = config['services'][service].get('volumes', [])
        require_media_directory(
            service, volumes, PROFILE_PHOTO_MOUNT, 'profile photo storage', media)
        require_media_directory(
            service, volumes, CIRCLE_IMAGE_MOUNT, 'circle image storage', media)
    check_existing_logging(args)
    if not runtime:
        return
    # Emit only non-secret settings. Never print the loaded configuration.
    script = """import config from './config/config.mts';
import mongoose from 'mongoose';
if (config.https !== true || config.sessionProxy !== true ||
    'https://' + config.domain !== process.env.DEPLOY_ORIGIN) process.exit(2);
try {
  await mongoose.connect(config.db.uri, {...config.db.options, serverSelectionTimeoutMS: 5000});
  await mongoose.connection.db.admin().ping();
  await mongoose.disconnect();
} catch (_) { process.exit(3); }
"""
    run(compose(args) + ['exec', '-T', '-e', 'NODE_ENV=production',
                         '-e', 'DEPLOY_ORIGIN=' + args.url, 'webapp',
                         'node', '--input-type=module', '-e', script], timeout=15)


def replace(args, images):
    # JSON is valid YAML; an override pins both services to immutable image IDs.
    override = {'services': {service: {'image': image} for service, image in images.items()}}
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json') as file:
        json.dump(override, file)
        file.flush()
        run(compose(args) + ['-f', file.name, 'up', '-d', '--no-build', '--no-deps',
                             '--pull', 'never', '--force-recreate', *SERVICES],
            timeout=180, capture=False)


def request(opener, url, data=None, expect_json=True):
    headers = {'Origin': urllib.parse.urlsplit(url).scheme + '://' + urllib.parse.urlsplit(url).netloc,
               'X-Trustroots-Request': '1'}
    if data is not None:
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, headers=headers,
                                 data=None if data is None else json.dumps(data).encode())
    with opener.open(req, timeout=5) as response:
        return json.load(response) if expect_json else response.read()


def verify(args, username, password):
    deadline = time.monotonic() + 90
    while True:
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        try:
            session = request(opener, args.url + '/api/auth/session')
            if 'userId' not in session:
                raise RuntimeError('Session endpoint not ready')
            break
        except Exception:
            if time.monotonic() >= deadline:
                raise RuntimeError('Application readiness check failed') from None
            time.sleep(2)
    request(opener, args.url + '/api/auth/signin', {'username': username, 'password': password})
    if not request(opener, args.url + '/api/auth/session').get('userId'):
        raise RuntimeError('Login did not persist a session')
    request(opener, args.url + '/api/auth/signout', {}, expect_json=False)
    for service in SERVICES:
        container = run(compose(args) + ['ps', '-q', service])
        if not container or run(['docker', 'inspect', '--format', '{{.State.Running}}', container]) != 'true':
            raise RuntimeError(service + ' is not running')


def save_state(path, images):
    with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, delete=False) as file:
        json.dump(images, file)
        temporary = file.name
    os.replace(temporary, path)


def event_time():
    return datetime.now(timezone.utc).isoformat()


def save_event(path, event):
    """Persist the receipt across process interruption and host restart."""
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, delete=False) as file:
            temporary = file.name
            json.dump(event, file)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, path)
        temporary = None
        descriptor = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
    finally:
        if temporary is not None:
            os.unlink(temporary)


def begin_event(args, images):
    validate_images(images)
    directory = args.compose.parent / '.trustroots-deployment-events'
    directory.mkdir(mode=0o700, exist_ok=True)
    # Persist the new directory entry as well as its contents.
    descriptor = os.open(directory.parent, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)
    identity = str(uuid.uuid4())
    event = {'schemaVersion': 1, 'eventId': identity, 'action': args.action,
             'origin': args.url, 'images': images, 'startedAt': event_time(),
             'status': 'pending'}
    path = directory / (identity + '.json')
    save_event(path, event)
    print('Deployment event: ' + identity, flush=True)
    return path, event


def complete_event(args, path, event):
    # Receipt failures must not enter the deployment rollback handler.
    try:
        if image_ids(args) != event['images']:
            raise RuntimeError('Running images changed')
        commit = run(compose(args) + ['exec', '-T', 'webapp', 'node', '-e',
                     'console.log(process.env.TRUSTROOTS_BUILD_COMMIT || "")'], timeout=15)
        if not re.fullmatch(r'[0-9a-f]{40}', commit):
            raise RuntimeError('Missing build commit')
        completed = {**event, 'status': 'succeeded', 'buildCommit': commit,
                     'readinessSucceededAt': event_time()}
        save_event(path, completed)
        print('Deployment success recorded: ' + event['eventId'])
    except Exception:
        # Docker and filesystem errors may contain private configuration.
        print('WARNING: Success receipt incomplete for event ' + event['eventId'] +
              '; use record-success to recheck and recover it. No rollback was requested.')


def recover_event(args, username, password):
    path = args.compose.parent / '.trustroots-deployment-events' / (args.event_id + '.json')
    event = json.loads(path.read_text())
    if event.get('eventId') != args.event_id or event.get('schemaVersion') != 1 or \
            event.get('origin') != args.url or event.get('status') not in ('pending', 'succeeded'):
        raise RuntimeError('Invalid deployment event or origin mismatch')
    validate_images(event['images'])
    if event['status'] == 'succeeded':
        print('Deployment success already recorded: ' + args.event_id)
        return
    if image_ids(args) != event['images']:
        raise RuntimeError('Running images do not match the pending deployment event')
    verify(args, username, password)
    complete_event(args, path, event)


def fail_event(path, event):
    try:
        save_event(path, {**event, 'status': 'failed', 'failedAt': event_time()})
    except Exception:
        print('WARNING: Could not record failure for deployment event ' + event['eventId'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['preflight', 'deploy', 'rollback', 'record-success'])
    parser.add_argument('--event-id', help='Existing pending UUID, required for record-success')
    parser.add_argument('--compose', type=Path, required=True)
    parser.add_argument('--media-mount', type=Path, required=True)
    parser.add_argument('--url', required=True, help='Canonical public HTTPS origin')
    args = parser.parse_args()
    if args.action == 'record-success':
        try:
            if str(uuid.UUID(args.event_id)) != args.event_id:
                raise ValueError()
        except (ValueError, TypeError, AttributeError):
            parser.error('record-success requires a canonical UUID --event-id')
    elif args.event_id is not None:
        parser.error('--event-id is only valid with record-success')
    args.compose = args.compose.resolve()
    args.media_mount = args.media_mount.resolve()
    parsed = urllib.parse.urlsplit(args.url)
    if parsed.scheme != 'https' or not parsed.netloc or parsed.path or parsed.query or parsed.fragment or parsed.username:
        parser.error('--url must be a plain HTTPS origin, without a trailing slash')
    state = args.compose.parent / '.trustroots-previous-images.json'
    with open(args.compose.parent / '.trustroots-deploy.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        preflight(args, runtime=args.action != 'rollback')
        if args.action == 'preflight':
            print('Deployment prerequisites passed.')
            return
        username = os.environ.get('TRUSTROOTS_DEPLOY_USERNAME') or input('Verification account username: ')
        password = os.environ.get('TRUSTROOTS_DEPLOY_PASSWORD') or getpass.getpass('Verification account password: ')
        if not username or not password:
            raise RuntimeError('A verification account is required')
        if args.action == 'record-success':
            recover_event(args, username, password)
            return
        if args.action == 'rollback':
            previous = json.loads(state.read_text())
            validate_images(previous)
            path, event = begin_event(args, previous)
            try:
                replace(args, previous)
                verify(args, username, password)
            except Exception:
                fail_event(path, event)
                raise
            complete_event(args, path, event)
            print('Rollback verified.')
            return
        # Verify credentials and the existing deployment before changing anything.
        verify(args, username, password)
        previous = image_ids(args)
        validate_images(previous)
        # Protect previous images from dangling-image pruning with explicit tags.
        project = json.loads(run(compose(args) + ['config', '--format', 'json']))['name']
        for service, image in previous.items():
            run(['docker', 'tag', image, project + '-' + service + '-rollback:previous'])
        save_state(state, previous)
        run(compose(args) + ['pull', *SERVICES], timeout=600, capture=False)
        config = json.loads(run(compose(args) + ['config', '--format', 'json']))
        desired = {s: run(['docker', 'image', 'inspect', '--format', '{{.Id}}',
                          config['services'][s]['image']]) for s in SERVICES}
        path, event = begin_event(args, desired)
        try:
            replace(args, desired)
            verify(args, username, password)
        except Exception:
            fail_event(path, event)
            print('Deployment failed; restoring previous image IDs.')
            replace(args, previous)
            verify(args, username, password)
            raise RuntimeError('Deployment failed; previous images restored and verified') from None
        complete_event(args, path, event)
        print('Deployment and login session verified.')


def validate_images(images):
    if set(images) != set(SERVICES) or any(not re.fullmatch(r'sha256:[0-9a-f]{64}', image) for image in images.values()):
        raise RuntimeError('Invalid rollback image state')


if __name__ == '__main__':
    try:
        main()
    except (Exception, KeyboardInterrupt) as error:
        # External errors may include secrets: print only our controlled messages.
        message = str(error) if type(error) is RuntimeError else type(error).__name__
        raise SystemExit('Deployment stopped: ' + message)
