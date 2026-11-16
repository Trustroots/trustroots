const assert: typeof import('node:assert').strict =
  require('node:assert').strict;
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const mockModule: typeof import('../../../../../testutils/server/mock-module.mts').default = require('../../../../../testutils/server/mock-module');
const {
  setImmediate: drain,
}: typeof import('node:timers/promises') = require('node:timers/promises');

const User = mongoose.model('User');
const servicePath =
  require.resolve('../../../server/services/gravatar-cleanup.server.service.mts');
type Cleanup =
  typeof import('../../../server/services/gravatar-cleanup.server.service.mts');

function member() {
  return {
    _id: new mongoose.Types.ObjectId(),
    emailHash: 'a'.repeat(32),
    avatarSource: 'gravatar',
  };
}

describe('Background Gravatar cleanup', () => {
  afterEach(() => sinon.restore());

  it('bounds pending work and skips repeat checks during the cooldown', async () => {
    const { queueProfileGravatarCheck } = mockModule<Cleanup>(servicePath, {
      'node:timers/promises': { setTimeout: sinon.stub().resolves() },
    });
    const update = sinon.spy(User, 'updateOne');
    const upstream = sinon
      .stub(globalThis, 'fetch')
      .resolves(new Response(null, { status: 503 }));
    let finishFirst!: (response: Response) => void;
    upstream.onFirstCall().returns(
      new Promise<Response>(resolve => {
        finishFirst = resolve;
      }),
    );
    const first = member();
    queueProfileGravatarCheck({ ...member(), avatarSource: 'local' });
    queueProfileGravatarCheck({ ...member(), emailHash: undefined });
    queueProfileGravatarCheck({ ...member(), emailHash: 'invalid' });
    queueProfileGravatarCheck(first);
    queueProfileGravatarCheck(first);
    for (let i = 0; i < 50; i++) queueProfileGravatarCheck(member());
    await drain();
    sinon.assert.calledOnce(upstream);
    finishFirst(new Response(null, { status: 503 }));
    await drain();
    assert.equal(upstream.callCount, 50);
    queueProfileGravatarCheck(first);
    await drain();
    assert.equal(upstream.callCount, 50);
    sinon.assert.notCalled(update);
  });

  it('evicts the oldest cooldown entry as the cache fills', async () => {
    const { queueProfileGravatarCheck } = mockModule<Cleanup>(servicePath, {
      'node:timers/promises': { setTimeout: sinon.stub().resolves() },
    });
    const upstream = sinon
      .stub(globalThis, 'fetch')
      .resolves(
        new Response(null, { headers: { 'content-type': 'image/png' } }),
      );
    const members = Array.from({ length: 2049 }, member);
    for (let i = 0; i < members.length; i += 50) {
      members.slice(i, i + 50).forEach(queueProfileGravatarCheck);
      await drain();
    }
    assert.equal(upstream.callCount, 2049);
    queueProfileGravatarCheck(members[0]);
    queueProfileGravatarCheck(members[2048]);
    await drain();
    assert.equal(upstream.callCount, 2050);
  });

  it('continues after a failed update without logging account details', async () => {
    const log = sinon.stub();
    const { queueProfileGravatarCheck } = mockModule<Cleanup>(servicePath, {
      '../../../../config/lib/logger.mjs': log,
      'node:timers/promises': { setTimeout: sinon.stub().resolves() },
    });
    const upstream = sinon
      .stub(globalThis, 'fetch')
      .resolves(new Response(null, { status: 404 }));
    const update = sinon
      .stub(User, 'updateOne')
      .throws(new Error('write failed'));
    queueProfileGravatarCheck(member());
    queueProfileGravatarCheck(member());
    await drain();
    sinon.assert.calledTwice(upstream);
    sinon.assert.calledTwice(update);
    assert.deepEqual(
      log.args,
      Array.from({ length: 2 }, () => [
        'error',
        'Could not update a profile with a missing Gravatar image.',
      ]),
    );
  });
});
