import mongoose from 'mongoose';
import sinon from 'sinon';
import mockModule from '../../../../../testutils/server/mock-module.mts';
import { setImmediate as drain } from 'node:timers/promises';
import assert from 'node:assert/strict';

const User = mongoose.model('User');
const servicePath = new URL(
  '../../../server/services/gravatar-cleanup.server.service.mts',
  import.meta.url,
);
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

  it('checks only well-formed hashes and spaces requests apart', async () => {
    sinon.useFakeTimers({ now: 1_000_000, toFake: ['Date'] });
    const wait = sinon.stub().resolves();
    const { checkGravatarPhoto } = await mockModule<Cleanup>(servicePath, {
      'node:timers/promises': { setTimeout: wait },
    });
    const upstream = sinon
      .stub(globalThis, 'fetch')
      .resolves(new Response(null, { status: 404 }));
    for (const hash of ['x' + 'a'.repeat(32), 'a'.repeat(32) + 'x']) {
      assert.equal(await checkGravatarPhoto(hash), 'inconclusive');
    }
    sinon.assert.notCalled(upstream);
    assert.equal(await checkGravatarPhoto('a'.repeat(64)), 'unavailable');
    sinon.assert.notCalled(wait);
    assert.equal(await checkGravatarPhoto('b'.repeat(32)), 'unavailable');
    sinon.assert.calledOnceWithExactly(wait, 250);
  });

  it('trusts only a 404 or an image from Gravatar', async () => {
    const { checkGravatarPhoto } = await mockModule<Cleanup>(servicePath, {
      'node:timers/promises': { setTimeout: sinon.stub().resolves() },
    });
    const upstream = sinon.stub(globalThis, 'fetch');
    const image = { 'content-type': 'image/png' };
    const cases: [() => Promise<Response>, string][] = [
      [async () => new Response(null, { status: 404 }), 'unavailable'],
      [async () => new Response(null, { headers: image }), 'available'],
      [
        async () => new Response(null, { status: 500, headers: image }),
        'inconclusive',
      ],
      [
        async () =>
          new Response(null, { headers: { 'content-type': 'text/html' } }),
        'inconclusive',
      ],
      [async () => new Response(null), 'inconclusive'],
      [() => Promise.reject(new Error('offline')), 'inconclusive'],
    ];
    for (const [respond, expected] of cases) {
      upstream.callsFake(respond);
      assert.equal(await checkGravatarPhoto('a'.repeat(32)), expected);
    }
    const [url, options] = upstream.firstCall.args;
    assert.equal(
      url,
      `https://gravatar.com/avatar/${'a'.repeat(32)}?s=32&d=404`,
    );
    assert.equal(options?.method, 'HEAD');
    assert.equal(options?.redirect, 'error');
    assert.ok(options?.signal instanceof AbortSignal);
    assert.equal(await checkGravatarPhoto(['a'.repeat(32)]), 'inconclusive');
    assert.equal(upstream.callCount, cases.length);
  });

  it('retires only the unchanged Gravatar it checked', async () => {
    const { clearMissingGravatar } = await mockModule<Cleanup>(servicePath, {});
    const user = await new User({
      firstName: 'Avatar',
      lastName: 'Member',
      displayName: 'Avatar Member',
      email: `avatar-${Date.now()}@example.org`,
      username: `avatar${Date.now()}`,
      password: 'M3@n.jsI$Aw3$0m3',
      provider: 'local',
      avatarSource: 'gravatar',
      avatarVersion: 'v1',
    }).save();
    const snapshot = {
      _id: user._id,
      emailHash: user.emailHash,
      avatarVersion: 'v1',
    };
    assert.equal(
      await clearMissingGravatar({ ...snapshot, avatarVersion: 'v2' }),
      false,
    );
    assert.equal(await clearMissingGravatar(snapshot), true);
    const saved = await User.findById(user._id).lean<{
      avatarSource?: string;
    }>();
    assert.equal(saved?.avatarSource, 'none');
    await User.deleteOne({ _id: user._id });
  });

  it('skips profiles that do not use Gravatar', async () => {
    const { queueProfileGravatarCheck } = await mockModule<Cleanup>(
      servicePath,
      {},
    );
    const upstream = sinon.stub(globalThis, 'fetch');
    queueProfileGravatarCheck({ ...member(), avatarSource: 'local' });
    await drain();
    sinon.assert.notCalled(upstream);
  });

  it('rechecks a profile once its hour-long cooldown ends', async () => {
    const clock = sinon.useFakeTimers({ now: 1_000_000, toFake: ['Date'] });
    const { queueProfileGravatarCheck } = await mockModule<Cleanup>(
      servicePath,
      {
        'node:timers/promises': { setTimeout: sinon.stub().resolves() },
      },
    );
    const upstream = sinon
      .stub(globalThis, 'fetch')
      .resolves(new Response(null, { status: 503 }));
    const profile = member();
    queueProfileGravatarCheck(profile);
    await drain();
    clock.tick(60 * 60 * 1000 - 1);
    queueProfileGravatarCheck(profile);
    await drain();
    sinon.assert.calledOnce(upstream);
    clock.tick(1);
    queueProfileGravatarCheck(profile);
    await drain();
    sinon.assert.calledTwice(upstream);
  });

  it('bounds pending work and skips repeat checks during the cooldown', async () => {
    const { queueProfileGravatarCheck } = await mockModule<Cleanup>(
      servicePath,
      {
        'node:timers/promises': { setTimeout: sinon.stub().resolves() },
      },
    );
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

  it('evicts the least recently checked cooldown entry as the cache fills', async () => {
    const clock = sinon.useFakeTimers({ now: 1_000_000, toFake: ['Date'] });
    const { queueProfileGravatarCheck } = await mockModule<Cleanup>(
      servicePath,
      {
        'node:timers/promises': { setTimeout: sinon.stub().resolves() },
      },
    );
    const upstream = sinon
      .stub(globalThis, 'fetch')
      .resolves(
        new Response(null, { headers: { 'content-type': 'image/png' } }),
      );
    const members = Array.from({ length: 2049 }, member);
    const queue = async (batch: typeof members) => {
      for (let i = 0; i < batch.length; i += 50) {
        batch.slice(i, i + 50).forEach(queueProfileGravatarCheck);
        await drain();
      }
    };
    await queue(members.slice(0, 1));
    clock.tick(60 * 60 * 1000);
    await queue([...members.slice(1, 2048), members[0], members[2048]]);
    assert.equal(upstream.callCount, 2050);
    await queue([members[0], members[2], members[2048]]);
    assert.equal(upstream.callCount, 2050);
    await queue([members[1]]);
    assert.equal(upstream.callCount, 2051);
  });

  it('continues after a failed update without logging account details', async () => {
    const log = sinon.stub();
    const { queueProfileGravatarCheck } = await mockModule<Cleanup>(
      servicePath,
      {
        '@trustroots/logger': log,
        'node:timers/promises': { setTimeout: sinon.stub().resolves() },
      },
    );
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
