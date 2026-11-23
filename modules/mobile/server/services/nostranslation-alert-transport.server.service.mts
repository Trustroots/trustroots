import { createPrivateKey, sign } from 'node:crypto';
import http2 from 'node:http2';
import config from '../../../../config/config.mts';
import unifiedPush from '../../../users/server/services/unified-push.server.service.mts';
import { webPush } from '../../../users/server/services/web-push.server.transport.mts';
import type { TranslationPushDestination } from './nostranslation-alert-registration.server.service.mts';

const alert = { type: 'nostranslation-review' };

function apnsConfiguration() {
  const teamId = process.env.TRUSTROOTS_APNS_TEAM_ID;
  const keyId = process.env.TRUSTROOTS_APNS_KEY_ID;
  const topic = process.env.TRUSTROOTS_APNS_TOPIC;
  const privateKey = process.env.TRUSTROOTS_APNS_PRIVATE_KEY;
  if (!teamId || !keyId || !topic || !privateKey) return;
  const host =
    process.env.TRUSTROOTS_APNS_SANDBOX === 'true'
      ? 'https://api.sandbox.push.apple.com'
      : 'https://api.push.apple.com';
  return { teamId, keyId, topic, privateKey, host };
}

type ApnsConfiguration = NonNullable<ReturnType<typeof apnsConfiguration>>;

export function translationAlertConfiguration() {
  const android = unifiedPush.pushConfiguration();
  return {
    androidVapidKey: android.enabled ? android.publicKey : null,
    ios: Boolean(apnsConfiguration()),
  };
}
let cachedToken:
  | { configuration: ApnsConfiguration; timestamp: number; token: string }
  | undefined;

function providerToken(configuration: ApnsConfiguration) {
  const timestamp = Math.floor(Date.now() / 1000);
  if (
    cachedToken &&
    cachedToken.timestamp > timestamp - 2700 &&
    cachedToken.configuration.keyId === configuration.keyId &&
    cachedToken.configuration.teamId === configuration.teamId &&
    cachedToken.configuration.privateKey === configuration.privateKey
  ) {
    return cachedToken.token;
  }
  const encode = (input: unknown) =>
    Buffer.from(JSON.stringify(input)).toString('base64url');
  const body =
    encode({ alg: 'ES256', kid: configuration.keyId }) +
    '.' +
    encode({ iss: configuration.teamId, iat: timestamp });
  const signature = sign('sha256', Buffer.from(body), {
    key: createPrivateKey(configuration.privateKey),
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url');
  const token = body + '.' + signature;
  cachedToken = { configuration, timestamp, token };
  return token;
}

function sendApns(
  configuration: ApnsConfiguration,
  device: string,
  expiry: Date,
): Promise<void> {
  const token = providerToken(configuration);
  return new Promise((resolve, reject) => {
    const session = http2.connect(configuration.host);
    session.on('error', reject);
    session.setTimeout(5000, () =>
      session.destroy(new Error('APNs connection timed out.')),
    );
    const stream = session.request({
      ':method': 'POST',
      ':path': '/3/device/' + device,
      authorization: 'bearer ' + token,
      'content-type': 'application/json',
      'apns-topic': configuration.topic,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': String(Math.floor(expiry.valueOf() / 1000)),
    });
    stream.on('response', headers => {
      const status = headers[':status'];
      if (status === 200) resolve();
      else
        reject(
          Object.assign(new Error('APNs rejected delivery.'), {
            statusCode: status,
          }),
        );
    });
    stream.on('error', reject);
    stream.on('close', () => {
      session.close();
      reject(new Error('APNs closed before accepting the notification.'));
    });
    stream.resume();
    stream.end(
      JSON.stringify({
        ...alert,
        aps: {
          alert: {
            title: 'Trustroots',
            body: 'A translation review is ready for your approval.',
          },
          sound: 'default',
        },
      }),
    );
  });
}

export async function sendTranslationAlert(
  destination: TranslationPushDestination,
  expiry: Date,
): Promise<void> {
  const ttl = Math.floor((expiry.valueOf() - Date.now()) / 1000);
  if (ttl <= 0) return;
  if (destination.platform === 'ios') {
    const configuration = apnsConfiguration();
    if (configuration) await sendApns(configuration, destination.token, expiry);
    return;
  }
  if (
    !unifiedPush.pushConfiguration().enabled ||
    !unifiedPush.validRegistration(destination)
  )
    return;
  const { subject, publicKey, privateKey } = config.webPush;
  webPush.setVapidDetails(subject, publicKey, privateKey);
  await webPush.sendNotification(
    {
      endpoint: destination.endpoint,
      keys: { p256dh: destination.publicKey, auth: destination.auth },
    },
    JSON.stringify(alert),
    { TTL: ttl },
  );
}
