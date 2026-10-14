import mongoose, { type Types } from 'mongoose';
import webPush from 'web-push';
import config from './../../../../config/config.mjs';
import log from './../../../../config/lib/logger.mjs';
interface UnifiedPushRegistrationRecord {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  endpoint: string;
  publicKey: string;
  auth: string;
  updated: Date;
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
      endpoint: registration.endpoint,
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
      new: true,
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
    endpoint,
  });
}
async function notifyUnread(
  userId: Types.ObjectId | string,
  senderId: Types.ObjectId | string,
): Promise<void> {
  if (!pushConfiguration().enabled) return;
  const registrations = await Registration.find({
    user: userId,
  });
  webPush.setVapidDetails(
    config.webPush.subject,
    config.webPush.publicKey,
    config.webPush.privateKey,
  );
  await Promise.all(
    registrations.map(async registration => {
      try {
        await webPush.sendNotification(
          {
            endpoint: registration.endpoint,
            keys: {
              p256dh: registration.publicKey,
              auth: registration.auth,
            },
          },
          JSON.stringify({
            senderId: String(senderId),
          }),
          {
            TTL: 3600,
          },
        );
      } catch (error) {
        const pushError = error as { statusCode?: number };
        if (pushError.statusCode === 404 || pushError.statusCode === 410) {
          await Registration.deleteOne({
            _id: registration._id,
            user: userId,
          });
        } else {
          log('error', 'UnifiedPush unread-message delivery failed.', {
            error,
          });
        }
      }
    }),
  );
}
service = {
  pushConfiguration,
  validRegistration,
  register,
  unregister,
  notifyUnread,
};
export default service;
export { service as 'module.exports' };

const nativeExportpushConfiguration = service.pushConfiguration;
export { nativeExportpushConfiguration as pushConfiguration };

const nativeExportvalidRegistration = service.validRegistration;
export { nativeExportvalidRegistration as validRegistration };

const nativeExportregister = service.register;
export { nativeExportregister as register };

const nativeExportunregister = service.unregister;
export { nativeExportunregister as unregister };

const nativeExportnotifyUnread = service.notifyUnread;
export { nativeExportnotifyUnread as notifyUnread };
