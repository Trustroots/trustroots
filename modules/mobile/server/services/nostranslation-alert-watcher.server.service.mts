import mongoose, { type Types } from 'mongoose';
import log from '@trustroots/logger';
import { dispatchTranslationAlert } from './nostranslation-alert-dispatch.server.service.mts';
import {
  translationAlertKind,
  translationAlertRelay,
} from './nostranslation-alert-envelope.server.service.mts';
import {
  alertRegistrations,
  type AlertRegistrationRecord,
} from './nostranslation-alert-registration.server.service.mts';
import { sendTranslationAlert } from './nostranslation-alert-transport.server.service.mts';

const subscription = 'trustroots-translation-alerts';
const maxInFlight = 32;

async function memberSessionIsActive(registration: AlertRegistrationRecord) {
  const session = await mongoose
    .model<{
      _id: Types.ObjectId;
      user: Types.ObjectId;
      revokedAt: Date | null;
      refreshExpiresAt: Date;
      authVersion: number;
    }>('MobileSession')
    .findOne({
      _id: registration.session,
      user: registration.user,
      revokedAt: null,
      refreshExpiresAt: { $gt: new Date() },
    })
    .select('authVersion')
    .lean();
  if (!session) return false;
  const authVersion = session.authVersion ?? 0;
  return Boolean(
    await mongoose.model('User').exists({
      _id: registration.user,
      roles: { $ne: 'suspended' },
      $or:
        authVersion === 0
          ? [{ authVersion: 0 }, { authVersion: { $exists: false } }]
          : [{ authVersion }],
    }),
  );
}

async function activeDestinations(pair: { author: string; recipient: string }) {
  const registration = await alertRegistrations()
    .findOne({
      _id: { $eq: pair.recipient },
      author: { $eq: pair.author },
      expiresAt: { $gt: new Date() },
    })
    .lean();
  return registration && (await memberSessionIsActive(registration))
    ? [{ id: registration._id, registration }]
    : [];
}

type Destination = Awaited<ReturnType<typeof activeDestinations>>[number];

async function claim(
  destination: Destination,
  eventId: string,
  expiresAt: Date,
) {
  try {
    await mongoose.model('NostranslationAlertClaim').create({
      _id: destination.id + ':' + eventId,
      expiresAt,
    });
    return true;
  } catch (error) {
    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000
    )
      return false;
    throw error;
  }
}

async function send(destination: Destination, expiresAt: Date) {
  const { registration } = destination;
  const current = await alertRegistrations()
    .findOne({
      _id: { $eq: registration._id },
      session: registration.session,
      author: { $eq: registration.author },
      expiresAt: { $gt: new Date() },
    })
    .lean();
  if (!current || !(await memberSessionIsActive(current))) return;
  try {
    await sendTranslationAlert(current.destination, expiresAt);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error &&
      'statusCode' in error &&
      (error.statusCode === 410 ||
        (error.statusCode === 404 &&
          current.destination.platform === 'android'))
    ) {
      await alertRegistrations().deleteOne({
        _id: { $eq: current._id },
        session: current.session,
        destination: { $eq: current.destination },
      });
      return;
    }
    throw error;
  }
}

/** Run only in the worker. The durable claim coordinates redundant workers. */
export function watchNostranslationAlerts() {
  let inFlight = 0;
  let delay = 1000;
  function open() {
    const socket = new WebSocket(translationAlertRelay);
    socket.addEventListener('open', () => {
      delay = 1000;
      socket.send(
        JSON.stringify([
          'REQ',
          subscription,
          {
            kinds: [translationAlertKind],
            since: Math.floor(Date.now() / 1000) - 60,
          },
        ]),
      );
    });
    socket.addEventListener('message', event => {
      if (typeof event.data !== 'string' || inFlight >= maxInFlight) return;
      inFlight += 1;
      void dispatchTranslationAlert(event.data, subscription, {
        activeDestinations,
        claim,
        send,
      })
        .catch(() => {
          log('error', '[Worker] Nostranslation alert dispatch failed.');
        })
        .finally(() => {
          inFlight -= 1;
        });
    });
    socket.addEventListener('error', () => {
      log('error', '[Worker] Nostranslation relay connection failed.');
    });
    socket.addEventListener(
      'close',
      () => {
        setTimeout(open, delay).unref();
        delay = Math.min(delay * 2, 60_000);
      },
      { once: true },
    );
  }
  open();
}
