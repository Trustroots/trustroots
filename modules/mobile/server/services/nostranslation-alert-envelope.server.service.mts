import { verifyEvent } from 'nostr-tools';
import { z } from 'zod';

export const translationAlertRelay = 'wss://relay.trustroots.org';
export const translationAlertKind = 24133;
export const translationAlertLifetime = 60;

const hexKey = z.string().regex(/^[0-9a-f]{64}$/);
const eventSchema = z.object({
  kind: z.literal(translationAlertKind),
  id: hexKey,
  pubkey: hexKey,
  created_at: z.int().positive(),
  sig: z.string().regex(/^[0-9a-f]{128}$/),
  content: z
    .string()
    .min(132)
    .max(22_000)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  tags: z.tuple([z.tuple([z.literal('p'), hexKey])]),
});
const relayFrame = z.tuple([z.literal('EVENT'), z.string(), eventSchema]);

export interface TranslationAlertEnvelope {
  author: string;
  recipient: string;
  eventId: string;
  expiresAt: Date;
}

export function readTranslationAlertEnvelope(
  frame: string,
  subscription: string,
  now: number,
): TranslationAlertEnvelope | undefined {
  if (frame.length > 32_768) return;
  let payload: unknown;
  try {
    payload = JSON.parse(frame);
  } catch {
    return;
  }
  const result = relayFrame.safeParse(payload);
  if (!result.success) return;
  const [, subscriptionId, event] = result.data;
  if (
    subscriptionId !== subscription ||
    event.created_at > now + 30 ||
    event.created_at <= now - translationAlertLifetime ||
    !verifyEvent(event)
  )
    return;

  return {
    author: event.pubkey,
    recipient: event.tags[0][1],
    eventId: event.id,
    expiresAt: new Date((event.created_at + translationAlertLifetime) * 1000),
  };
}
