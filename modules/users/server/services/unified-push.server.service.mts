import mongoose, { type Types } from 'mongoose';
import config from './../../../../config/config.mts';
import log from '@trustroots/logger';
import { webPush } from './web-push.server.transport.mts';
interface UnifiedPushRegistrationRecord {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  endpoint: string;
  publicKey: string;
  auth: string;
  updated: Date;
  lastTestRequested?: Date;
}

interface PushRegistrationInput {
  endpoint: unknown;
  publicKey: unknown;
  auth: unknown;
}

interface ValidPushRegistration {
  endpoint: string;
  publicKey: string;
  auth: string;
}

interface PushConfiguration {
  publicKey: string;
  privateKey: string;
  subject: string;
  allowedHosts: string[];
}

interface UnifiedPushService {
  pushConfiguration: typeof pushConfiguration;
  validRegistration: typeof validRegistration;
  register: typeof register;
  unregister: typeof unregister;
  notifyUnread: typeof notifyUnread;
  hasRegistrations: typeof hasRegistrations;
  scheduleTest: typeof scheduleTest;
}

let service = {} as UnifiedPushService;

const Registration = mongoose.model<UnifiedPushRegistrationRecord>(
  'UnifiedPushRegistration',
);
function getPushConfiguration(): PushConfiguration {
  return config.webPush;
}
function pushConfiguration(): { enabled: boolean; publicKey: string | null } {
  const { publicKey, privateKey, subject, allowedHosts } =
    getPushConfiguration();
  return {
    enabled: Boolean(publicKey && privateKey && subject && allowedHosts.length),
    publicKey: publicKey || null,
  };
}
function validRegistration(
  registration: unknown,
): registration is ValidPushRegistration {
  const { endpoint, publicKey, auth } = registration as PushRegistrationInput;
  if (
    typeof endpoint !== 'string' ||
    endpoint.length > 2048 ||
    typeof publicKey !== 'string' ||
    !/^[A-Za-z0-9_-]{86,88}$/.test(publicKey) ||
    typeof auth !== 'string' ||
    !/^[A-Za-z0-9_-]{20,24}$/.test(auth)
  )
    return false;
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.hash &&
      url.port === '' &&
      getPushConfiguration().allowedHosts.includes(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}
async function register(
  userId: Types.ObjectId | string,
  registration: ValidPushRegistration,
): Promise<void> {
  await Registration.findOneAndUpdate(
    {
      endpoint: { $eq: registration.endpoint },
    },
    {
      $set: {
        user: userId,
        publicKey: registration.publicKey,
        auth: registration.auth,
        updated: new Date(),
      },
    },
    {
      upsert: true,
      // Stryker disable next-line BooleanLiteral: register discards the returned document
      new: true,
      // Stryker disable next-line BooleanLiteral: the only schema default, updated, is always in $set
      setDefaultsOnInsert: true,
    },
  );
}
async function unregister(
  userId: Types.ObjectId | string,
  endpoint: string,
): Promise<void> {
  await Registration.deleteOne({
    user: userId,
    endpoint: { $eq: endpoint },
  });
}
const testDelayMs = 15_000;
const testCooldownMs = 60_000;

export const testPushJobName = 'send Android test notification';

interface TestPushJobData {
  userId: string;
  registrationId: string;
  expiresAt: number;
}

async function scheduleTest(
  userId: Types.ObjectId,
  endpoint: string,
): Promise<'scheduled' | 'missing' | 'limited'> {
  const requestedAt = new Date();
  const target = { user: userId, endpoint: { $eq: endpoint } };
  const registration = await Registration.findOneAndUpdate(
    {
      ...target,
      $or: [
        { lastTestRequested: { $exists: false } },
        {
          lastTestRequested: {
            $lte: new Date(requestedAt.getTime() - testCooldownMs),
          },
        },
      ],
    },
    { $set: { lastTestRequested: requestedAt } },
  );
  if (!registration)
    return (await Registration.exists(target)) ? 'limited' : 'missing';

  const dueAt = Date.now() + testDelayMs;
  try {
    const { default: agenda } =
      await import('../../../../config/lib/agenda.mts');
    await agenda.schedule<TestPushJobData>(new Date(dueAt), testPushJobName, {
      userId: String(userId),
      registrationId: String(registration._id),
      expiresAt: dueAt + testCooldownMs,
    });
  } catch (error) {
    await Registration.updateOne(
      { _id: registration._id, user: userId, lastTestRequested: requestedAt },
      { $unset: { lastTestRequested: 1 } },
    );
    throw error;
  }
  return 'scheduled';
}

export async function deliverTest(data: TestPushJobData): Promise<void> {
  if (!pushConfiguration().enabled || Date.now() >= data.expiresAt) return;
  const registration = await Registration.findOne({
    _id: data.registrationId,
    user: data.userId,
  });
  if (registration) await sendPush(registration, { test: true }, 60);
}

async function sendPush(
  registration: UnifiedPushRegistrationRecord,
  payload: { senderId: string } | { test: true },
  ttl: number,
): Promise<void> {
  if (!validRegistration(registration)) return;
  webPush.setVapidDetails(
    config.webPush.subject,
    config.webPush.publicKey,
    config.webPush.privateKey,
  );
  try {
    await webPush.sendNotification(
      {
        endpoint: registration.endpoint,
        keys: { p256dh: registration.publicKey, auth: registration.auth },
      },
      JSON.stringify(payload),
      { TTL: ttl },
    );
  } catch (error) {
    const pushError = error as { statusCode?: number };
    if (pushError.statusCode === 404 || pushError.statusCode === 410) {
      await Registration.deleteOne({
        _id: registration._id,
        user: registration.user,
        updated: registration.updated,
      });
    } else {
      log('error', 'UnifiedPush delivery failed.', {
        statusCode: pushError.statusCode,
      });
    }
  }
}

async function notifyUnread(
  userId: Types.ObjectId | string,
  senderId: Types.ObjectId | string,
): Promise<void> {
  if (!pushConfiguration().enabled) return;
  const registrations = await Registration.find({ user: userId });
  await Promise.all(
    registrations.map(registration =>
      sendPush(registration, { senderId: String(senderId) }, 3600),
    ),
  );
}

async function hasRegistrations(userId: Types.ObjectId): Promise<boolean> {
  return (
    pushConfiguration().enabled &&
    Boolean(await Registration.exists({ user: userId }))
  );
}

service = {
  pushConfiguration,
  validRegistration,
  register,
  unregister,
  notifyUnread,
  hasRegistrations,
  scheduleTest,
};
export default service;

const nativeExportpushConfiguration = service.pushConfiguration;
export { nativeExportpushConfiguration as pushConfiguration };

const nativeExportvalidRegistration = service.validRegistration;
export { nativeExportvalidRegistration as validRegistration };

const nativeExportregister = service.register;
export { nativeExportregister as register };

const nativeExportunregister = service.unregister;
export { nativeExportunregister as unregister };

const nativeExportnotifyUnread = service.notifyUnread;
/** @esmNamed */
export { nativeExportnotifyUnread as notifyUnread };
