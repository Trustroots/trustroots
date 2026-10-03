const mongoose = require('mongoose');
const webPush = require('web-push');
const config = require('../../../../config/config');
const log = require('../../../../config/lib/logger');

const Registration = mongoose.model('UnifiedPushRegistration');

function pushConfiguration() {
  const { publicKey, privateKey, subject, allowedHosts } = config.webPush;
  return {
    enabled: Boolean(publicKey && privateKey && subject && allowedHosts.length),
    publicKey: publicKey || null,
  };
}

function validRegistration({ endpoint, publicKey, auth }) {
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
      config.webPush.allowedHosts.includes(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

async function register(userId, registration) {
  await Registration.findOneAndUpdate(
    { endpoint: registration.endpoint },
    {
      $set: {
        user: userId,
        publicKey: registration.publicKey,
        auth: registration.auth,
        updated: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function unregister(userId, endpoint) {
  await Registration.deleteOne({ user: userId, endpoint });
}

async function notifyUnread(userId, senderId) {
  if (!pushConfiguration().enabled) return;
  const registrations = await Registration.find({ user: userId });
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
            keys: { p256dh: registration.publicKey, auth: registration.auth },
          },
          JSON.stringify({ senderId: String(senderId) }),
          { TTL: 3600 },
        );
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await Registration.deleteOne({ _id: registration._id, user: userId });
        } else {
          log('error', 'UnifiedPush unread-message delivery failed.', {
            error,
          });
        }
      }
    }),
  );
}

module.exports = {
  pushConfiguration,
  validRegistration,
  register,
  unregister,
  notifyUnread,
};
