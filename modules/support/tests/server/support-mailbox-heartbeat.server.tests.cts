const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const sinon: typeof import('sinon') = require('sinon');
const {
  startSupportMailboxHeartbeat,
}: typeof import('../../server/services/support-mailbox-heartbeat.server.service.mts') = require('../../server/services/support-mailbox-heartbeat.server.service.mts');

describe('support mailbox Agenda heartbeat', () => {
  afterEach(() => sinon.restore());

  it('renews the lock on the minute and stops its timer', async () => {
    let tick!: () => void;
    const unref = sinon.spy();
    const handle = { unref } as unknown as NodeJS.Timeout;
    const setInterval = sinon
      .stub(global, 'setInterval')
      .callsFake((callback: () => void, delay?: number) => {
        assert.equal(delay, 60_000);
        tick = callback;
        return handle;
      });
    const clearIntervalStub = sinon.stub(global, 'clearInterval');
    const job = { touch: sinon.stub().resolves() };
    const heartbeat = startSupportMailboxHeartbeat(job as never);

    assert.equal(setInterval.calledOnce, true);
    assert.equal(unref.calledOnce, true);
    tick();
    await Promise.resolve();
    assert.equal(job.touch.calledOnce, true);
    assert.doesNotThrow(() => heartbeat.assertHealthy());
    heartbeat.stop();
    assert.deepEqual(clearIntervalStub.firstCall.args, [handle]);
  });

  it('reports a rejected lock renewal without throwing from the timer callback', async () => {
    let tick!: () => void;
    sinon.stub(global, 'setInterval').callsFake((callback: () => void) => {
      tick = callback;
      return { unref() {} } as unknown as NodeJS.Timeout;
    });
    sinon.stub(global, 'clearInterval');
    const error = new Error('synthetic lock failure');
    const job = { touch: sinon.stub().rejects(error) };
    const heartbeat = startSupportMailboxHeartbeat(job as never);

    assert.doesNotThrow(() => tick());
    await new Promise(resolve => setImmediate(resolve));
    assert.throws(() => heartbeat.assertHealthy(), {
      message: 'synthetic lock failure',
    });
    heartbeat.stop();
  });
});
