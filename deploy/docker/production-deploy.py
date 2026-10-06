#!/usr/bin/env python3
"""Deploy and roll back app containers with prerequisite and session checks."""
import argparse
import fcntl
import getpass
import http.cookiejar
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request

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


def preflight(args, runtime=True):
    if not os.path.ismount(args.media_mount):
        raise RuntimeError('Required media filesystem is not mounted: ' + str(args.media_mount))
    config = json.loads(run(compose(args) + ['config', '--format', 'json']))
    for service in (*SERVICES, 'mongodb'):
        definition = config['services'][service]
        if definition.get('logging', {}).get('driver') != 'local':
            raise RuntimeError(service + ' must explicitly use local logging')
    for service in SERVICES:
        mounts = [v for v in config['services'][service].get('volumes', [])
                  if v.get('target') == '/home/app/trustroots/public/uploads-profile']
        if len(mounts) != 1 or mounts[0].get('type') != 'bind':
            raise RuntimeError(service + ' must bind mount profile photo storage')
        source = Path(mounts[0]['source']).resolve()
        media = args.media_mount.resolve()
        if not source.is_relative_to(media) or not source.is_dir():
            raise RuntimeError('Photo directory must exist on the required media mount')
    if not runtime:
        return
    # Emit only non-secret settings. Never print the loaded configuration.
    script = """import config from './config/config.mjs';
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['preflight', 'deploy', 'rollback'])
    parser.add_argument('--compose', type=Path, required=True)
    parser.add_argument('--media-mount', type=Path, required=True)
    parser.add_argument('--url', required=True, help='Canonical public HTTPS origin')
    args = parser.parse_args()
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
        if args.action == 'rollback':
            previous = json.loads(state.read_text())
            validate_images(previous)
            replace(args, previous)
            verify(args, username, password)
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
        try:
            replace(args, desired)
            verify(args, username, password)
        except Exception:
            print('Deployment failed; restoring previous image IDs.')
            replace(args, previous)
            verify(args, username, password)
            raise RuntimeError('Deployment failed; previous images restored and verified') from None
        print('Deployment and login session verified.')


def validate_images(images):
    import re
    if set(images) != set(SERVICES) or any(not re.fullmatch(r'sha256:[0-9a-f]{64}', image) for image in images.values()):
        raise RuntimeError('Invalid rollback image state')


if __name__ == '__main__':
    try:
        main()
    except (Exception, KeyboardInterrupt) as error:
        # External errors may include secrets: print only our controlled messages.
        message = str(error) if type(error) is RuntimeError else type(error).__name__
        raise SystemExit('Deployment stopped: ' + message)
