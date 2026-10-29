import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startWorker } from './start-worker.mts';

test('starts the worker in order and waits for each callback', async () => {
  const calls: string[] = [];
  let finishStart: (() => void) | undefined;
  const promise = startWorker(
    {
      connect: done => {
        calls.push('connect');
        done();
      },
      loadModels: done => {
        calls.push('models');
        done();
      },
    },
    {
      unlockAgendaJobs: done => {
        calls.push('unlock');
        done();
      },
      start: (options, done) => {
        assert.deepEqual(options, { maxAttempts: 10, retryDelaySeconds: 10 });
        calls.push('start');
        finishStart = done;
      },
    },
  );
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['connect', 'models', 'unlock', 'start']);
  let completed = false;
  void promise.then(() => {
    completed = true;
  });
  await Promise.resolve();
  assert.equal(completed, false);
  finishStart!();
  await promise;
});

for (const failed of ['models', 'unlock', 'start'] as const) {
  test(`stops and rejects when ${failed} fails`, async () => {
    const calls: string[] = [];
    const error = new Error(failed);
    const step = (name: string, done: (error?: Error) => void) => {
      calls.push(name);
      done(name === failed ? error : undefined);
    };
    await assert.rejects(
      startWorker(
        {
          connect: done => {
            calls.push('connect');
            done();
          },
          loadModels: done => step('models', done),
        },
        {
          unlockAgendaJobs: done => step('unlock', done),
          start: (_options, done) => step('start', done),
        },
      ),
      error,
    );
    assert.deepEqual(
      calls,
      ['connect', 'models', 'unlock', 'start'].slice(
        0,
        ['models', 'unlock', 'start'].indexOf(failed) + 2,
      ),
    );
  });
}
