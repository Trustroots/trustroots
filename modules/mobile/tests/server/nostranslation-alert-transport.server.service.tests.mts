import { generateKeyPairSync, verify } from 'node:crypto';
import { EventEmitter } from 'node:events';
import http2, { type ClientHttp2Session } from 'node:http2';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import config from '../../../../config/config.mts';
import { webPush } from '../../../users/server/services/web-push.server.transport.mts';
import {
  sendTranslationAlert,
  translationAlertConfiguration,
} from '../../server/services/nostranslation-alert-transport.server.service.mts';

const device = { platform: 'ios', token: 'ab'.repeat(32) } as const;
const android = {
  platform: 'android',
  endpoint: 'https://ntfy.sh/translation-fixture',
  publicKey:
    'BNPRQG83KHuc4ZkSKlmSKQWC3PQm2YD-yOiPdjFbQyB8VM6ZZSLD2caRpXad6G_2qXqb_WUz7V2T7w1KqAXbslQ',
  auth: 'abcdefghijklmnopqrstuv',
} as const;
const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
});
const time = new Date('2026-11-01T10:00:00Z');
const fiveMinutesLater = new Date('2026-11-01T10:05:00Z');
const pushConfiguration = { ...config.webPush };

function stubApns() {
  vi.stubEnv('TRUSTROOTS_APNS_TEAM_ID', 'fixture-team');
  vi.stubEnv('TRUSTROOTS_APNS_KEY_ID', 'fixture-key');
  vi.stubEnv('TRUSTROOTS_APNS_TOPIC', 'org.trustroots.fixture');
  vi.stubEnv(
    'TRUSTROOTS_APNS_PRIVATE_KEY',
    privateKey
      .export({
        type: 'pkcs8',
        format: 'pem',
      })
      .toString(),
  );
}

function captureRequest() {
  const stream = Object.assign(new EventEmitter(), {
    end: vi.fn(),
    resume: vi.fn(),
  });
  const sessionEvents = new EventEmitter();
  const session = Object.assign(sessionEvents, {
    close: vi.fn(),
    destroy: vi.fn((error: Error) => sessionEvents.emit('error', error)),
    request: vi.fn<(headers: Record<string, string>) => typeof stream>(
      () => stream,
    ),
    setTimeout: vi.fn<(delay: number, callback: () => void) => void>(),
  });
  vi.mocked(http2.connect).mockReturnValueOnce(
    session as unknown as ClientHttp2Session,
  );
  return { stream, session };
}

describe('Nostranslation alert transport', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(time.valueOf());
    vi.spyOn(http2, 'connect').mockImplementation(() => {
      throw new Error('Unexpected APNs request in the test.');
    });
    vi.stubEnv('TRUSTROOTS_APNS_TEAM_ID', undefined);
    vi.stubEnv('TRUSTROOTS_APNS_KEY_ID', undefined);
    vi.stubEnv('TRUSTROOTS_APNS_TOPIC', undefined);
    vi.stubEnv('TRUSTROOTS_APNS_PRIVATE_KEY', undefined);
    vi.stubEnv('TRUSTROOTS_APNS_SANDBOX', undefined);
  });

  afterEach(() => {
    Object.assign(config.webPush, pushConfiguration);
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('reports capabilities and only sends a live alert to a valid Android registration', async () => {
    const vapid = vi
      .spyOn(webPush, 'setVapidDetails')
      .mockImplementation(() => {});
    const deliver = vi
      .spyOn(webPush, 'sendNotification')
      .mockResolvedValue({ statusCode: 201, body: '', headers: {} });
    expect(translationAlertConfiguration()).toEqual({
      androidVapidKey: config.webPush.publicKey,
      ios: false,
    });
    await sendTranslationAlert(device, fiveMinutesLater);
    await sendTranslationAlert(android, time);
    await sendTranslationAlert(
      { ...android, endpoint: 'http://ntfy.sh/push' },
      fiveMinutesLater,
    );
    expect(http2.connect).not.toHaveBeenCalled();
    expect(deliver).not.toHaveBeenCalled();

    await sendTranslationAlert(android, fiveMinutesLater);
    expect(vapid).toHaveBeenCalledWith(
      config.webPush.subject,
      config.webPush.publicKey,
      config.webPush.privateKey,
    );
    expect(deliver).toHaveBeenCalledExactlyOnceWith(
      {
        endpoint: android.endpoint,
        keys: { p256dh: android.publicKey, auth: android.auth },
      },
      JSON.stringify({ type: 'nostranslation-review' }),
      { TTL: 300 },
    );
    config.webPush.publicKey = '';
    expect(translationAlertConfiguration().androidVapidKey).toBeNull();
    await sendTranslationAlert(android, fiveMinutesLater);
    expect(deliver).toHaveBeenCalledOnce();
  });

  it.each([
    'TRUSTROOTS_APNS_TEAM_ID',
    'TRUSTROOTS_APNS_KEY_ID',
    'TRUSTROOTS_APNS_TOPIC',
    'TRUSTROOTS_APNS_PRIVATE_KEY',
  ])('disables APNs delivery when %s is missing', async field => {
    stubApns();
    vi.stubEnv(field, undefined);
    expect(translationAlertConfiguration().ios).toBe(false);
    await sendTranslationAlert(device, fiveMinutesLater);
    expect(http2.connect).not.toHaveBeenCalled();
  });

  it('signs requests and reuses the APNs token until it expires', async () => {
    stubApns();
    vi.stubEnv('TRUSTROOTS_APNS_SANDBOX', 'true');
    expect(translationAlertConfiguration().ios).toBe(true);
    const first = captureRequest();
    const pending = sendTranslationAlert(device, fiveMinutesLater);
    first.stream.emit('response', { ':status': 200 });
    first.stream.emit('close');
    await pending;
    expect(http2.connect).toHaveBeenCalledWith(
      'https://api.sandbox.push.apple.com',
    );
    const [headers] = first.session.request.mock.calls[0]!;
    const [encodedHeader, encodedBody, signature] = headers
      .authorization!.slice('bearer '.length)
      .split('.');
    expect(
      JSON.parse(Buffer.from(encodedHeader!, 'base64url').toString()),
    ).toEqual({
      alg: 'ES256',
      kid: 'fixture-key',
    });
    expect(
      JSON.parse(Buffer.from(encodedBody!, 'base64url').toString()),
    ).toEqual({
      iss: 'fixture-team',
      iat: time.valueOf() / 1000,
    });
    expect(
      verify(
        'sha256',
        Buffer.from(encodedHeader + '.' + encodedBody),
        { key: publicKey, dsaEncoding: 'ieee-p1363' },
        Buffer.from(signature!, 'base64url'),
      ),
    ).toBe(true);
    expect(headers).toMatchObject({
      ':method': 'POST',
      ':path': '/3/device/' + device.token,
      'content-type': 'application/json',
      'apns-topic': 'org.trustroots.fixture',
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': String(fiveMinutesLater.valueOf() / 1000),
    });
    expect(first.stream.resume).toHaveBeenCalledOnce();
    expect(first.session.close).toHaveBeenCalledOnce();
    expect(JSON.parse(first.stream.end.mock.calls[0]![0])).toEqual({
      type: 'nostranslation-review',
      aps: {
        alert: {
          title: 'Trustroots',
          body: 'A translation review is ready for your approval.',
        },
        sound: 'default',
      },
    });

    vi.stubEnv('TRUSTROOTS_APNS_SANDBOX', undefined);
    const next = captureRequest();
    const sameToken = sendTranslationAlert(device, fiveMinutesLater);
    next.stream.emit('response', { ':status': 200 });
    await sameToken;
    expect(http2.connect).toHaveBeenLastCalledWith(
      'https://api.push.apple.com',
    );
    expect(next.session.request.mock.calls[0]![0].authorization).toBe(
      headers.authorization,
    );

    vi.mocked(Date.now).mockReturnValue(time.valueOf() + 2700_000);
    const renewed = captureRequest();
    const renewal = sendTranslationAlert(
      device,
      new Date(Date.now() + 300_000),
    );
    renewed.stream.emit('response', { ':status': 200 });
    await renewal;
    expect(renewed.session.request.mock.calls[0]![0].authorization).not.toBe(
      headers.authorization,
    );
  });

  it.each([
    ['TRUSTROOTS_APNS_TEAM_ID', 'reconfigured-team'],
    ['TRUSTROOTS_APNS_KEY_ID', 'reconfigured-key'],
    [
      'TRUSTROOTS_APNS_PRIVATE_KEY',
      generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
      })
        .privateKey.export({ type: 'pkcs8', format: 'pem' })
        .toString(),
    ],
  ])(
    'reissues the APNs token immediately if %s changes',
    async (field, replacement) => {
      stubApns();
      const first = captureRequest();
      const original = sendTranslationAlert(device, fiveMinutesLater);
      first.stream.emit('response', { ':status': 200 });
      await original;

      vi.stubEnv(field, replacement);
      const next = captureRequest();
      const reissued = sendTranslationAlert(device, fiveMinutesLater);
      next.stream.emit('response', { ':status': 200 });
      await reissued;
      expect(next.session.request.mock.calls[0]![0].authorization).not.toBe(
        first.session.request.mock.calls[0]![0].authorization,
      );
    },
  );

  it('reports rejected, prematurely closed and timed-out APNs requests', async () => {
    stubApns();
    const rejected = captureRequest();
    const response = sendTranslationAlert(device, fiveMinutesLater);
    rejected.stream.emit('response', { ':status': 410 });
    await expect(response).rejects.toMatchObject({
      statusCode: 410,
      message: 'APNs rejected delivery.',
    });

    const failed = captureRequest();
    const broken = sendTranslationAlert(device, fiveMinutesLater);
    const error = new Error('HTTP/2 stream reset.');
    failed.stream.emit('error', error);
    failed.stream.emit('close');
    await expect(broken).rejects.toBe(error);

    const closed = captureRequest();
    const interrupted = sendTranslationAlert(device, fiveMinutesLater);
    closed.stream.emit('close');
    await expect(interrupted).rejects.toThrow(
      'APNs closed before accepting the notification.',
    );

    const timed = captureRequest();
    const timeout = sendTranslationAlert(device, fiveMinutesLater);
    const [delay, expire] = timed.session.setTimeout.mock.calls[0]!;
    expect(delay).toBe(5000);
    expire();
    await expect(timeout).rejects.toThrow('APNs connection timed out.');
  });
});
