"""Regression checks using fake Docker and HTTP responses; never deploys."""
import importlib.util
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch, Mock
from contextlib import ExitStack
import io
import json
import subprocess

spec = importlib.util.spec_from_file_location('deployment', Path(__file__).with_name('production-deploy.py'))
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)


class DeploymentTests(unittest.TestCase):
    def test_local_logging_requires_explicit_positive_rotation_limits(self):
        for size in ['1k', '10m', '2G']:
            deploy.validate_logging('webapp', 'local', {'max-size': size, 'max-file': '3'})
        for options in [{}, {'max-size': '0m', 'max-file': '3'},
                        {'max-size': '-1', 'max-file': '3'},
                        {'max-size': '10m', 'max-file': '0'},
                        {'max-size': '10m', 'max-file': '-1'},
                        {'max-size': '10m', 'max-file': '1.5'}]:
            with self.subTest(options=options), self.assertRaisesRegex(RuntimeError, 'positive'):
                deploy.validate_logging('webapp', 'local', options)

    def test_existing_remote_driver_stops_even_when_compose_has_changed(self):
        args = SimpleNamespace(compose=Path('/deployment/compose.yml'))
        with patch.object(deploy, 'run', side_effect=[
                'fictional-container', json.dumps({'Type': 'loki', 'Config': {}})]) as docker:
            with self.assertRaisesRegex(RuntimeError, 'Existing webapp.*migrate'):
                deploy.check_existing_logging(args)
            self.assertEqual(docker.call_args_list[0].args[0][-4:],
                             ['ps', '--all', '--quiet', 'webapp'])
            self.assertEqual(docker.call_count, 2)

    def test_existing_local_containers_and_absent_services(self):
        args = SimpleNamespace(compose=Path('/deployment/compose.yml'))
        local = json.dumps({'Type': 'local', 'Config': {'max-size': '10m', 'max-file': '3'}})
        with patch.object(deploy, 'run', side_effect=[
                'fictional-app-a\nfictional-app-b', local + '\n' + local, '',
                'fictional-database', local]) as docker:
            deploy.check_existing_logging(args)
            self.assertEqual(docker.call_args_list[1].args[0][-2:],
                             ['fictional-app-a', 'fictional-app-b'])
            for call in docker.call_args_list:
                self.assertEqual(call.kwargs['timeout'], 15)

    def test_existing_logging_inspection_must_return_every_container(self):
        args = SimpleNamespace(compose=Path('/deployment/compose.yml'))
        with patch.object(deploy, 'run', side_effect=['fictional-app', '']):
            with self.assertRaisesRegex(RuntimeError, 'Could not inspect'):
                deploy.check_existing_logging(args)

    def test_existing_local_driver_with_unbounded_rotation_is_rejected(self):
        args = SimpleNamespace(compose=Path('/deployment/compose.yml'))
        with patch.object(deploy, 'run', side_effect=[
                'fictional-app', json.dumps({'Type': 'local', 'Config': None})]):
            with self.assertRaisesRegex(RuntimeError, 'positive'):
                deploy.check_existing_logging(args)

    def test_deploy_and_rollback_stop_before_changes_when_live_logging_is_unsafe(self):
        import sys
        for action in ['deploy', 'rollback']:
            for failure in ['remote', 'timeout']:
                with self.subTest(action=action, failure=failure), tempfile.TemporaryDirectory() as directory:
                    media = Path(directory)
                    photos = media / 'photos'
                    circles = media / 'circles'
                    photos.mkdir()
                    circles.mkdir()
                    services = {name: {'logging': {'driver': 'local', 'options': {
                        'max-size': '10m', 'max-file': '3'}}, 'volumes': [
                        {'type': 'bind', 'target': '/home/app/trustroots/public/uploads-profile',
                         'source': str(photos)},
                        {'type': 'bind', 'target': '/home/app/trustroots/public/uploads-circle',
                         'source': str(circles)},
                    ]} for name in (*deploy.SERVICES, 'mongodb')}
                    commands = []
                    def docker(command, **kwargs):
                        commands.append(command)
                        if 'config' in command:
                            return json.dumps({'services': services})
                        if 'ps' in command:
                            return 'fictional-app'
                        if failure == 'timeout':
                            raise subprocess.TimeoutExpired('docker', kwargs['timeout'])
                        return json.dumps({'Type': 'loki', 'Config': {}})
                    argv = ['production-deploy.py', action, '--compose', str(media / 'compose.yml'),
                            '--media-mount', directory, '--url', 'https://example.test']
                    with patch.object(sys, 'argv', argv), \
                            patch.object(deploy.os.path, 'ismount', return_value=True), \
                            patch.object(deploy, 'run', side_effect=docker), \
                            patch.object(deploy, 'replace') as replacement, \
                            patch('builtins.input') as credentials:
                        error = subprocess.TimeoutExpired if failure == 'timeout' else RuntimeError
                        with self.assertRaises(error):
                            deploy.main()
                        replacement.assert_not_called()
                        credentials.assert_not_called()
                        self.assertFalse(any('pull' in command or 'up' in command for command in commands))
                        self.assertFalse((media / '.trustroots-previous-images.json').exists())

    def test_image_state_requires_both_immutable_ids(self):
        good = {name: 'sha256:' + 'a' * 64 for name in deploy.SERVICES}
        deploy.validate_images(good)
        for bad in [{}, {'webapp': 'latest', 'worker': 'latest'}, {**good, 'extra': 'latest'}]:
            with self.assertRaises(RuntimeError):
                deploy.validate_images(bad)

    def test_unmounted_media_stops_before_docker(self):
        args = SimpleNamespace(media_mount=Path('/missing'))
        with patch.object(deploy.os.path, 'ismount', return_value=False), patch.object(deploy, 'run') as docker:
            with self.assertRaisesRegex(RuntimeError, 'not mounted'):
                deploy.preflight(args)
            docker.assert_not_called()

    def test_preflight_rejects_remote_logging_and_wrong_storage(self):
        import json
        with tempfile.TemporaryDirectory() as directory:
            media = Path(directory)
            photos = media / 'photos'
            circles = media / 'circles'
            photos.mkdir()
            circles.mkdir()
            services = {name: {'logging': {'driver': 'local', 'options': {
                'max-size': '10m', 'max-file': '3'}}, 'volumes': [
                {'type': 'bind', 'target': '/home/app/trustroots/public/uploads-profile', 'source': str(photos)},
                {'type': 'bind', 'target': '/home/app/trustroots/public/uploads-circle', 'source': str(circles)},
            ]} for name in (*deploy.SERVICES, 'mongodb')}
            args = SimpleNamespace(media_mount=media, compose=media / 'compose.yml', url='https://example.test')
            with patch.object(deploy.os.path, 'ismount', return_value=True), patch.object(deploy, 'run') as docker:
                docker.side_effect = lambda command, **kwargs: json.dumps({'services': services}) if 'config' in command else ''
                deploy.preflight(args, runtime=False)
                services['webapp']['volumes'].pop()
                with self.assertRaisesRegex(RuntimeError, 'circle image'):
                    deploy.preflight(args, runtime=False)
                services['webapp']['volumes'].append(
                    {'type': 'bind', 'target': '/home/app/trustroots/public/uploads-circle',
                     'source': str(circles)})
                services['worker']['logging']['driver'] = 'loki'
                with self.assertRaisesRegex(RuntimeError, 'local logging'):
                    deploy.preflight(args, runtime=False)
                services['worker']['logging']['driver'] = 'local'
                services['worker']['volumes'][0]['source'] = '/somewhere-else'
                with self.assertRaisesRegex(RuntimeError, 'media mount'):
                    deploy.preflight(args, runtime=False)

    def test_replacement_uses_saved_ids_and_never_pulls(self):
        import json
        args = SimpleNamespace(compose=Path('/deployment/compose.yml'))
        images = {name: 'sha256:' + 'a' * 64 for name in deploy.SERVICES}
        def docker(command, **kwargs):
            override = Path(command[command.index('-f', 4) + 1])
            value = json.loads(override.read_text())
            self.assertEqual(value['services']['worker']['image'], images['worker'])
            self.assertIn('never', command)
            self.assertIn('--no-deps', command)
            self.assertIn('--no-build', command)
        with patch.object(deploy, 'run', side_effect=docker):
            deploy.replace(args, images)

    def test_verification_rejects_missing_session(self):
        args = SimpleNamespace(url='https://example.test')
        with patch.object(deploy, 'request', side_effect=[{'userId': None}, {}, {'userId': None}]):
            with self.assertRaisesRegex(RuntimeError, 'persist'):
                deploy.verify(args, 'verification-member', 'fictional-password')

    def test_verification_checks_session_and_running_services(self):
        args = SimpleNamespace(url='https://example.test', compose=Path('/deployment/compose.yml'))
        with patch.object(deploy, 'request', side_effect=[{'userId': None}, {}, {'userId': 'fictional-id'}, None]) as http, \
                patch.object(deploy, 'run', side_effect=['app-id', 'true', 'worker-id', 'true']):
            deploy.verify(args, 'verification-member', 'fictional-password')
            self.assertEqual(http.call_count, 4)


    def test_failed_deployment_restores_previous_images(self):
        import json
        import sys
        with tempfile.TemporaryDirectory() as directory:
            args = ['production-deploy.py', 'deploy', '--compose', str(Path(directory) / 'compose.yml'),
                    '--media-mount', directory, '--url', 'https://example.test']
            previous = {name: 'sha256:' + 'a' * 64 for name in deploy.SERVICES}
            desired = 'sha256:' + 'b' * 64
            config = json.dumps({'name': 'fictional-project', 'services': {
                name: {'image': 'example/image:latest'} for name in deploy.SERVICES}})
            def docker(command, **kwargs):
                if 'config' in command:
                    return config
                if 'inspect' in command:
                    return desired
                return ''
            with patch.object(sys, 'argv', args), patch.object(deploy, 'preflight'), \
                    patch.dict(deploy.os.environ, {'TRUSTROOTS_DEPLOY_USERNAME': 'member',
                                                   'TRUSTROOTS_DEPLOY_PASSWORD': 'fictional-password'}), \
                    patch.object(deploy, 'image_ids', return_value=previous), \
                    patch.object(deploy, 'run', side_effect=docker), \
                    patch.object(deploy, 'replace') as replacement, \
                    patch.object(deploy, 'verify', side_effect=[None, RuntimeError('failed'), None]):
                with self.assertRaisesRegex(RuntimeError, 'restored and verified'):
                    deploy.main()
                self.assertEqual(replacement.call_args_list[1].args[1], previous)
                self.assertEqual(json.loads((Path(directory) / '.trustroots-previous-images.json').read_text()), previous)

    def test_signout_accepts_redirected_html_without_parsing_json(self):
        import io
        opener = Mock()
        opener.open.return_value = io.BytesIO(b'<html>Signed out</html>')
        result = deploy.request(opener, 'https://example.test/api/auth/signout', {}, expect_json=False)
        self.assertEqual(result, b'<html>Signed out</html>')
        sent = opener.open.call_args.args[0]
        self.assertEqual(sent.get_header('Origin'), 'https://example.test')
        self.assertEqual(sent.get_header('X-trustroots-request'), '1')

    def test_readiness_timeout_is_bounded(self):
        args = SimpleNamespace(url='https://example.test')
        with patch.object(deploy, 'request', side_effect=OSError('unavailable')), \
                patch.object(deploy.time, 'monotonic', side_effect=[0, 91]):
            with self.assertRaisesRegex(RuntimeError, 'readiness'):
                deploy.verify(args, 'member', 'fictional-password')

    def test_stopped_worker_fails_verification(self):
        args = SimpleNamespace(url='https://example.test', compose=Path('/deployment/compose.yml'))
        with patch.object(deploy, 'request', side_effect=[{'userId': None}, {}, {'userId': 'fictional-id'}, None]), \
                patch.object(deploy, 'run', side_effect=['app-id', 'true', 'worker-id', 'false']):
            with self.assertRaisesRegex(RuntimeError, 'worker is not running'):
                deploy.verify(args, 'member', 'fictional-password')

    def test_state_written_atomically(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'state.json'
            deploy.save_state(target, {'worker': 'previous'})
            self.assertEqual(target.read_text(), '{"worker": "previous"}')


class DeploymentEventTests(unittest.TestCase):
    commit = 'c' * 40
    images = {name: 'sha256:' + 'b' * 64 for name in deploy.SERVICES}

    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        directory = self.stack.enter_context(tempfile.TemporaryDirectory())
        self.args = SimpleNamespace(compose=Path(directory) / 'compose.yml',
                                    url='https://example.test', action='deploy')

    def begin(self):
        path, event = deploy.begin_event(self.args, self.images)
        self.args.event_id = event['eventId']
        return path, event

    def main(self, action='deploy', replace_side_effect=None, **kwargs):
        import sys
        argv = ['production-deploy.py', action, '--compose', str(self.args.compose),
                '--media-mount', str(self.args.compose.parent), '--url', self.args.url]
        if action == 'record-success':
            argv.extend(['--event-id', self.args.event_id])
        previous = {name: 'sha256:' + 'a' * 64 for name in deploy.SERVICES}
        if action == 'rollback':
            deploy.save_state(self.args.compose.parent / '.trustroots-previous-images.json', self.images)
        config = json.dumps({'name': 'fictional-project', 'services': {
            name: {'image': 'example/image:latest'} for name in deploy.SERVICES}})
        self.commands = []

        def docker(command, **options):
            self.commands.append(command)
            if 'config' in command:
                return config
            if 'inspect' in command:
                return self.images['webapp']
            if 'exec' in command:
                return self.commit
            return ''

        with ExitStack() as stack:
            stack.enter_context(patch.object(sys, 'argv', argv))
            stack.enter_context(patch.dict(deploy.os.environ, {
                'TRUSTROOTS_DEPLOY_USERNAME': 'member',
                'TRUSTROOTS_DEPLOY_PASSWORD': 'fictional-password'}))
            stack.enter_context(patch.object(deploy, 'preflight'))
            stack.enter_context(patch.object(deploy, 'run', side_effect=docker))
            stack.enter_context(patch.object(deploy, 'image_ids', side_effect=[previous, self.images]
                                           if action == 'deploy' else [self.images, self.images]))
            replacement = stack.enter_context(patch.object(deploy, 'replace', side_effect=replace_side_effect))
            self.replacement = replacement
            verification = stack.enter_context(patch.object(deploy, 'verify', **kwargs))
            deploy.main()
        return replacement, verification

    def receipts(self):
        return [json.loads(path.read_text()) for path in
                (self.args.compose.parent / '.trustroots-deployment-events').glob('*.json')]

    def test_success_and_same_version_redeploy_are_distinct_events(self):
        self.main()
        self.main()
        receipts = self.receipts()
        self.assertEqual(len(receipts), 2)
        self.assertNotEqual(receipts[0]['eventId'], receipts[1]['eventId'])
        for event in receipts:
            self.assertEqual(event['status'], 'succeeded')
            self.assertEqual(event['images'], self.images)
            self.assertEqual(event['buildCommit'], self.commit)
            self.assertGreaterEqual(event['readinessSucceededAt'], event['startedAt'])
            self.assertNotIn('password', json.dumps(event))

    def test_attempt_is_durable_before_replacement(self):
        def replace(args, images):
            event, = self.receipts()
            self.assertEqual(event['images'], images)
            self.assertEqual(event['status'], 'pending')
            self.assertNotIn('readinessSucceededAt', event)
        self.main(replace_side_effect=replace)

    def test_failed_deployment_is_not_recoverable_as_success(self):
        with self.assertRaisesRegex(RuntimeError, 'restored and verified'):
            self.main(side_effect=[None, RuntimeError('failed'), None])
        event, = self.receipts()
        self.assertEqual(event['status'], 'failed')
        self.assertNotIn('readinessSucceededAt', event)
        self.args.event_id = event['eventId']
        with self.assertRaisesRegex(RuntimeError, 'Invalid deployment event'):
            deploy.recover_event(self.args, 'member', 'fictional-password')

    def test_explicit_rollback_is_its_own_verified_event(self):
        self.main(action='rollback')
        event, = self.receipts()
        self.assertEqual(event['action'], 'rollback')
        self.assertEqual(event['status'], 'succeeded')

    def test_failed_replacement_restores_images_without_a_success_receipt(self):
        with self.assertRaisesRegex(RuntimeError, 'restored and verified'):
            self.main(replace_side_effect=[RuntimeError('replacement failed'), None])
        self.assertEqual(self.replacement.call_count, 2)
        self.assertEqual(self.receipts()[0]['status'], 'failed')

    def test_failed_explicit_rollback_has_no_success_receipt(self):
        with self.assertRaisesRegex(RuntimeError, 'failed'):
            self.main(action='rollback', side_effect=RuntimeError('failed'))
        event, = self.receipts()
        self.assertEqual(event['status'], 'failed')

    def test_completion_failure_does_not_roll_back_healthy_deployment(self):
        original = deploy.save_event
        def save(path, event):
            if event['status'] == 'succeeded':
                raise OSError('private filesystem detail')
            original(path, event)
        with patch.object(deploy, 'save_event', side_effect=save), \
                patch('sys.stdout', new_callable=io.StringIO) as output:
            replacement, verification = self.main()
        self.assertEqual(replacement.call_count, 1)
        self.assertEqual(verification.call_count, 2)
        self.assertEqual(self.receipts()[0]['status'], 'pending')
        self.assertIn('record-success', output.getvalue())
        self.assertNotIn('private filesystem detail', output.getvalue())

    def test_interrupted_completion_recovers_same_identity_once(self):
        path, event = self.begin()
        with patch.object(deploy, 'image_ids', return_value=self.images), \
                patch.object(deploy, 'verify') as verify, \
                patch.object(deploy, 'run', return_value=self.commit):
            deploy.recover_event(self.args, 'member', 'fictional-password')
            saved = path.read_bytes()
            deploy.recover_event(self.args, 'member', 'fictional-password')
            self.assertEqual(path.read_bytes(), saved)
            verify.assert_called_once()
        self.assertEqual(len(self.receipts()), 1)
        self.assertEqual(self.receipts()[0]['eventId'], event['eventId'])

    def test_recovery_rejects_changed_origin_or_images_and_failed_readiness(self):
        path, event = self.begin()
        with patch.object(deploy, 'image_ids', return_value={}), \
                patch.object(deploy, 'verify') as verify:
            with self.assertRaisesRegex(RuntimeError, 'images do not match'):
                deploy.recover_event(self.args, 'member', 'fictional-password')
            verify.assert_not_called()
        with patch.object(deploy, 'image_ids', return_value=self.images), \
                patch.object(deploy, 'verify', side_effect=RuntimeError('readiness failed')):
            with self.assertRaisesRegex(RuntimeError, 'readiness failed'):
                deploy.recover_event(self.args, 'member', 'fictional-password')
        self.assertEqual(json.loads(path.read_text()), event)
        self.args.url = 'https://other.example.test'
        with self.assertRaisesRegex(RuntimeError, 'origin mismatch'):
            deploy.recover_event(self.args, 'member', 'fictional-password')

    def test_invalid_commit_or_changed_images_leave_pending_receipt(self):
        path, event = self.begin()
        for images, commit in [(self.images, ''), (self.images, 'untrusted-output'), ({}, self.commit)]:
            with self.subTest(images=images, commit=commit), \
                    patch.object(deploy, 'image_ids', return_value=images), \
                    patch.object(deploy, 'run', return_value=commit):
                deploy.complete_event(self.args, path, event)
                self.assertEqual(json.loads(path.read_text()), event)

    def test_atomic_write_failure_retains_previous_file_and_cleans_temporary(self):
        path, event = self.begin()
        with patch.object(deploy.os, 'replace', side_effect=OSError('disk failure')):
            with self.assertRaises(OSError):
                deploy.save_event(path, {**event, 'status': 'succeeded'})
        self.assertEqual(json.loads(path.read_text()), event)
        self.assertEqual(list(path.parent.iterdir()), [path])

    def test_initial_receipt_failure_stops_before_replacement(self):
        with patch.object(deploy, 'save_event', side_effect=OSError('disk full')):
            with self.assertRaises(OSError):
                self.main()
            self.replacement.assert_not_called()

    def test_record_success_entry_point_does_not_replace_or_pull(self):
        self.begin()
        replacement, verification = self.main(action='record-success')
        replacement.assert_not_called()
        verification.assert_called_once()
        self.assertFalse(any('pull' in command for command in self.commands))
        self.assertEqual(self.receipts()[0]['status'], 'succeeded')

    def test_failed_receipt_persistence_reports_only_controlled_warning(self):
        path, event = self.begin()
        with patch.object(deploy, 'save_event', side_effect=OSError('private detail')), \
                patch('sys.stdout', new_callable=io.StringIO) as output:
            deploy.fail_event(path, event)
        self.assertIn(event['eventId'], output.getvalue())
        self.assertNotIn('private detail', output.getvalue())

    def test_recovery_uuid_cannot_escape_journal_directory(self):
        import sys
        for identity in ['../../file', 'not-a-uuid', None]:
            argv = ['production-deploy.py', 'record-success', '--compose', str(self.args.compose),
                    '--media-mount', str(self.args.compose.parent), '--url', self.args.url]
            if identity is not None:
                argv.extend(['--event-id', identity])
            with self.subTest(identity=identity), patch.object(sys, 'argv', argv), \
                    patch('sys.stderr', new_callable=io.StringIO), \
                    self.assertRaises(SystemExit) as stopped:
                deploy.main()
            self.assertEqual(stopped.exception.code, 2)

    def test_concurrent_invocation_is_rejected_before_checks(self):
        with open(self.args.compose.parent / '.trustroots-deploy.lock', 'a') as lock:
            deploy.fcntl.flock(lock, deploy.fcntl.LOCK_EX | deploy.fcntl.LOCK_NB)
            with self.assertRaises(BlockingIOError):
                self.main()
        self.assertEqual(self.receipts(), [])


if __name__ == '__main__':
    unittest.main()
