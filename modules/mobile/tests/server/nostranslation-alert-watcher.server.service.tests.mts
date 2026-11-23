import mongoose from 'mongoose';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDatabase } from '../../../../testutils/server/data.server.testutil.mts';
import { webPush } from '../../../users/server/services/web-push.server.transport.mts';
import { watchNostranslationAlerts } from '../../server/services/nostranslation-alert-watcher.server.service.mts';

const author = generateSecretKey();
const recipient = getPublicKey(generateSecretKey());
const subscription = 'trustroots-translation-alerts';
const destination = {
  platform: 'android',
  endpoint: 'https://ntfy.sh/translation-fixture',
  publicKey:
    'BNPRQG83KHuc4ZkSKlmSKQWC3PQm2YD-yOiPdjFbQyB8VM6ZZSLD2caRpXad6G_2qXqb_WUz7V2T7w1KqAXbslQ',
  auth: 'abcdefghijklmnopqrstuv',
};
const Registrations = mongoose.model('NostranslationAlertRegistration');
const Claims = mongoose.model('NostranslationAlertClaim');
const User = mongoose.model('User');
const MobileSession = mongoose.model('MobileSession');

class FixtureSocket extends EventTarget {
  static instances: FixtureSocket[] = [];
  send = vi.fn();
  readonly url: string;

  constructor(url: string) {
    super();
    this.url = url;
    FixtureSocket.instances.push(this);
  }

  message(data: unknown) {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }
}

function signedFrame(signingKey = author) {
  const event = finalizeEvent(
    {
      kind: 24133,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', recipient]],
      content: 'A'.repeat(132),
    },
    signingKey,
  );
  return { event, frame: JSON.stringify(['EVENT', subscription, event]) };
}

async function registerMember(authVersion = 0) {
  const user = await User.create({
    public: true,
    firstName: 'Review',
    lastName: 'Watcher',
    displayName: 'Review Watcher',
    email: 'watcher@example.test',
    username: 'reviewwatcher',
    password: 'strong-fixture-password',
    provider: 'local',
    roles: ['user'],
    authVersion,
  });
  const expiresAt = new Date(Date.now() + 60_000);
  const session = await MobileSession.create({
    user: user._id,
    authVersion,
    accessTokenHash: 'fixture-access-hash',
    refreshTokenHash: 'fixture-refresh-hash',
    accessExpiresAt: expiresAt,
    refreshExpiresAt: expiresAt,
  });
  await Registrations.create({
    _id: recipient,
    user: user._id,
    session: session._id,
    author: getPublicKey(author),
    destination,
    expiresAt,
  });
  return session._id;
}

describe('Nostranslation relay watcher', () => {
  beforeEach(() => {
    FixtureSocket.instances = [];
    vi.stubGlobal('WebSocket', FixtureSocket);
    vi.spyOn(webPush, 'setVapidDetails').mockImplementation(() => {});
    vi.spyOn(webPush, 'sendNotification').mockImplementation(async () => {
      throw new Error('Unexpected Web Push request in the test.');
    });
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await clearDatabase();
  });

  it('subscribes to fresh review events and reconnects with backoff', async () => {
    vi.useFakeTimers();
    watchNostranslationAlerts();
    const [first] = FixtureSocket.instances;
    first!.dispatchEvent(new Event('open'));
    expect(first!.url).toBe('wss://relay.trustroots.org');
    expect(first!.send).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify([
        'REQ',
        subscription,
        { kinds: [24133], since: Math.floor(Date.now() / 1000) - 60 },
      ]),
    );
    first!.message(new Uint8Array());
    first!.dispatchEvent(new Event('error'));
    first!.dispatchEvent(new Event('close'));
    await vi.advanceTimersByTimeAsync(999);
    expect(FixtureSocket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    const second = FixtureSocket.instances[1]!;
    second.dispatchEvent(new Event('close'));
    await vi.advanceTimersByTimeAsync(1999);
    expect(FixtureSocket.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    const third = FixtureSocket.instances[2]!;
    third.dispatchEvent(new Event('open'));
    third.dispatchEvent(new Event('close'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(FixtureSocket.instances).toHaveLength(4);
  });

  it('claims a replayed review once when two workers see the same event', async () => {
    const session = await registerMember();
    await MobileSession.collection.updateOne(
      { _id: session },
      { $unset: { authVersion: '' } },
    );
    const delivery = vi.mocked(webPush.sendNotification).mockResolvedValue({
      statusCode: 201,
      body: '',
      headers: {},
    });
    const create = vi.spyOn(Claims, 'create');
    watchNostranslationAlerts();
    watchNostranslationAlerts();
    const { event, frame } = signedFrame();
    for (const socket of FixtureSocket.instances) socket.message(frame);
    await vi.waitFor(() => {
      expect(create).toHaveBeenCalledTimes(2);
      expect(delivery).toHaveBeenCalledOnce();
    });
    expect(
      await Claims.countDocuments({ _id: recipient + ':' + event.id }),
    ).toBe(1);
  });

  it('ignores non-text frames and bounds the relay work accepted in one burst', async () => {
    const lookup = vi.spyOn(Registrations, 'findOne');
    watchNostranslationAlerts();
    const socket = FixtureSocket.instances[0]!;
    const { frame } = signedFrame();
    socket.message({ toString: () => frame });
    expect(lookup).not.toHaveBeenCalled();

    // Each unfinished dispatch holds a slot until its promise settles.
    for (let index = 0; index < 32; index += 1) socket.message('invalid');
    socket.message(frame);
    expect(lookup).not.toHaveBeenCalled();
    await new Promise<void>(resolve => setImmediate(resolve));

    socket.message(frame);
    expect(lookup).toHaveBeenCalledOnce();
    expect(await Claims.countDocuments()).toBe(0);
  });

  it('only claims notifications from the author attached to the destination', async () => {
    await registerMember();
    const delivery = vi.mocked(webPush.sendNotification).mockResolvedValue({
      statusCode: 201,
      body: '',
      headers: {},
    });
    watchNostranslationAlerts();
    const socket = FixtureSocket.instances[0]!;
    const wrongAuthor = signedFrame(generateSecretKey());
    const pairedAuthor = signedFrame();
    socket.message(wrongAuthor.frame);
    socket.message(pairedAuthor.frame);
    await vi.waitFor(() => {
      expect(delivery).toHaveBeenCalledOnce();
    });
    expect(await Claims.distinct('_id')).toEqual([
      recipient + ':' + pairedAuthor.event.id,
    ]);
  });

  it.each([404, 410])(
    'removes an Android destination when its distributor returns %s',
    async statusCode => {
      await registerMember(2);
      vi.mocked(webPush.sendNotification).mockRejectedValue(
        Object.assign(new Error('Subscription not found.'), { statusCode }),
      );
      watchNostranslationAlerts();
      FixtureSocket.instances[0]!.message(signedFrame().frame);
      await vi.waitFor(async () => {
        expect(await Registrations.findById(recipient)).toBeNull();
      });
      expect(webPush.sendNotification).toHaveBeenCalledOnce();
    },
  );

  it('skips a delivery if the mobile session is revoked after the claim', async () => {
    const session = await registerMember();
    const update = vi
      .spyOn(Claims, 'create')
      .mockImplementationOnce(async () => {
        await MobileSession.updateOne(
          { _id: session },
          { revokedAt: new Date() },
        );
        return new Claims();
      });
    const lookup = vi.spyOn(MobileSession, 'findOne');
    watchNostranslationAlerts();
    FixtureSocket.instances[0]!.message(signedFrame().frame);
    await vi.waitFor(() => {
      expect(update).toHaveBeenCalledOnce();
      expect(lookup).toHaveBeenCalledTimes(2);
    });
    expect(
      await MobileSession.collection.findOne({ _id: session }),
    ).toMatchObject({
      revokedAt: expect.any(Date),
    });
    FixtureSocket.instances[0]!.message(signedFrame().frame);
    await vi.waitFor(() => {
      expect(lookup).toHaveBeenCalledTimes(3);
    });
    expect(update).toHaveBeenCalledOnce();
    expect(webPush.sendNotification).not.toHaveBeenCalled();
  });

  it('can claim a replay after a temporary database write failure', async () => {
    await registerMember();
    const create = vi
      .spyOn(Claims, 'create')
      .mockRejectedValueOnce(new Error('Database unavailable.'));
    vi.mocked(webPush.sendNotification).mockResolvedValue({
      statusCode: 201,
      body: '',
      headers: {},
    });
    watchNostranslationAlerts();
    const socket = FixtureSocket.instances[0]!;
    const { frame, event } = signedFrame();
    socket.message(frame);
    await vi.waitFor(() => {
      expect(create).toHaveBeenCalledOnce();
    });
    expect(webPush.sendNotification).not.toHaveBeenCalled();
    socket.message(frame);
    await vi.waitFor(() => {
      expect(webPush.sendNotification).toHaveBeenCalledOnce();
    });
    expect(
      await Claims.countDocuments({ _id: recipient + ':' + event.id }),
    ).toBe(1);
  });

  it.each([
    new Error('Service unavailable.'),
    Object.assign(new Error('Service unavailable.'), { statusCode: 503 }),
  ])(
    'keeps a destination registered on a temporary delivery failure (%s)',
    async failure => {
      await registerMember();
      vi.mocked(webPush.sendNotification).mockRejectedValue(failure);
      watchNostranslationAlerts();
      const { frame, event } = signedFrame();
      FixtureSocket.instances[0]!.message(frame);
      await vi.waitFor(() => {
        expect(webPush.sendNotification).toHaveBeenCalledOnce();
      });
      expect(await Registrations.findById(recipient)).not.toBeNull();
      expect(
        await Claims.countDocuments({ _id: recipient + ':' + event.id }),
      ).toBe(1);
    },
  );
});
