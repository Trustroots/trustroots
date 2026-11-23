import {
  readTranslationAlertEnvelope,
  type TranslationAlertEnvelope,
} from './nostranslation-alert-envelope.server.service.mts';

export interface TranslationAlertDestination {
  id: string;
}

export interface TranslationAlertDispatch<
  Destination extends TranslationAlertDestination,
> {
  activeDestinations: (pair: {
    author: string;
    recipient: string;
  }) => Promise<Destination[]>;
  claim: (
    destination: Destination,
    eventId: string,
    expiresAt: Date,
  ) => Promise<boolean>;
  send: (destination: Destination, expiresAt: Date) => Promise<void>;
  now?: () => number;
}

function expiresLater(envelope: TranslationAlertEnvelope, now: number) {
  return envelope.expiresAt.valueOf() > now;
}

/** Claim delivery durably before handing off a generic alert to the transport. */
export async function dispatchTranslationAlert<
  Destination extends TranslationAlertDestination,
>(
  frame: string,
  subscription: string,
  dispatch: TranslationAlertDispatch<Destination>,
): Promise<void> {
  const now = dispatch.now ?? Date.now;
  const envelope = readTranslationAlertEnvelope(
    frame,
    subscription,
    Math.floor(now() / 1000),
  );
  if (!envelope) return;
  const { author, recipient, eventId, expiresAt } = envelope;
  const destinations = await dispatch.activeDestinations({ author, recipient });
  const deliveries = await Promise.allSettled(
    destinations.map(async destination => {
      if (
        expiresLater(envelope, now()) &&
        (await dispatch.claim(destination, eventId, expiresAt)) &&
        expiresLater(envelope, now())
      ) {
        await dispatch.send(destination, expiresAt);
      }
    }),
  );
  const errors = deliveries
    .filter(delivery => delivery.status === 'rejected')
    .map(delivery => delivery.reason);
  if (errors.length)
    throw new AggregateError(errors, 'Translation alert delivery failed.');
}
