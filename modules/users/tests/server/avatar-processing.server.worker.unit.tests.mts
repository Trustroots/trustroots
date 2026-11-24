import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import mockModule from '../../../../testutils/server/mock-module.mts';

async function makeWorker() {
  const child = new EventEmitter();
  const kills: string[] = [];
  const calls: unknown[][] = [];
  const process = Object.assign(child, {
    kill(signal: string) {
      kills.push(signal);
      return true;
    },
  });
  const { default: run } = await mockModule<
    typeof import('../../server/services/avatar-processing.server.worker.mts')
  >(
    new URL(
      '../../server/services/avatar-processing.server.worker.mts',
      import.meta.url,
    ),
    {
      'node:child_process': {
        fork: (...args: unknown[]) => {
          calls.push(args);
          return process;
        },
      },
    },
  );
  return { run, child, calls, kills };
}

describe('Avatar worker process lifecycle', () => {
  it('does not start a child after the deadline has expired', async () => {
    const { run, calls } = await makeWorker();
    const reason = new Error('Deadline expired');
    await assert.rejects(
      run('input.png', 'stage', AbortSignal.abort(reason)),
      reason,
    );
    assert.deepEqual(calls, []);
  });

  it('kills the worker on deadline and waits for it to close', async () => {
    const { run, child, calls, kills } = await makeWorker();
    const controller = new AbortController();
    const reason = new Error('Deadline expired');
    let settled = false;
    const processing = run('input.png', 'stage', controller.signal).finally(
      () => {
        settled = true;
      },
    );
    assert.match(
      String(calls[0]?.[0]),
      /avatar-processing\.server\.child\.mjs$/,
    );
    assert.deepEqual(calls[0]?.slice(1), [
      ['input.png', 'stage'],
      { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] },
    ]);
    controller.abort(reason);
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.deepEqual(kills, ['SIGKILL']);
    assert.equal(settled, false);
    child.emit('close', 0);
    await assert.rejects(processing, reason);
  });

  it('resolves after successful closure and removes the abort listener', async () => {
    const { run, child, kills } = await makeWorker();
    const controller = new AbortController();
    const processing = run('input.png', 'stage', controller.signal);
    child.emit('close', 0);
    await processing;
    controller.abort();
    assert.deepEqual(kills, []);
  });

  it('returns the child message when processing fails', async () => {
    const { run, child } = await makeWorker();
    const processing = run('input.png', 'stage', new AbortController().signal);
    child.emit('message', 'Invalid input image');
    child.emit('close', 1);
    await assert.rejects(processing, /Invalid input image/);
  });

  it('returns the spawn error when the child cannot start', async () => {
    const { run, child } = await makeWorker();
    const processing = run('input.png', 'stage', new AbortController().signal);
    child.emit('error', new Error('Unable to start worker'));
    child.emit('close', -1);
    await assert.rejects(processing, /Unable to start worker/);
  });

  it('returns a generic error for an unexplained worker failure', async () => {
    const { run, child } = await makeWorker();
    const processing = run('input.png', 'stage', new AbortController().signal);
    child.emit('close', null);
    await assert.rejects(processing, /Avatar processing failed/);
  });
});
