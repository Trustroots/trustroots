import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import { describe, expect, it } from 'vitest';
import {
  readTranslationAlertEnvelope,
  translationAlertKind,
} from '../../server/services/nostranslation-alert-envelope.server.service.mts';

const now = 1_800_000_000;
const connection = 'fixture-alerts';
const client = generateSecretKey();
const transport = getPublicKey(generateSecretKey());

function envelope(changes = {}) {
  return finalizeEvent(
    {
      kind: translationAlertKind,
      created_at: now,
      tags: [['p', transport]],
      content: 'A'.repeat(132),
      ...changes,
    },
    client,
  );
}

function frame(event: unknown, subscription = connection) {
  return JSON.stringify(['EVENT', subscription, event]);
}

describe('Nostranslation alert relay envelopes', () => {
  it('returns only verified delivery metadata', () => {
    const event = envelope();
    expect(readTranslationAlertEnvelope(frame(event), connection, now)).toEqual(
      {
        author: getPublicKey(client),
        recipient: transport,
        eventId: event.id,
        expiresAt: new Date((now + 60) * 1000),
      },
    );
  });

  it('rejects other subscriptions, future and expired requests, and tampered envelopes', () => {
    const event = envelope();
    for (const rejected of [
      frame(event, 'other'),
      frame(envelope({ created_at: now - 60 })),
      frame(envelope({ created_at: now + 31 })),
      frame({ ...event, sig: '0'.repeat(128) }),
      frame({ ...event, tags: [['p', getPublicKey(generateSecretKey())]] }),
    ]) {
      expect(
        readTranslationAlertEnvelope(rejected, connection, now),
      ).toBeUndefined();
    }
  });

  it('rejects malformed and out-of-scope relay traffic', () => {
    for (const rejected of [
      'x'.repeat(32_769),
      'invalid-json',
      JSON.stringify(['EOSE', connection]),
      frame(envelope({ kind: 1 })),
      frame(
        envelope({
          tags: [
            ['p', transport],
            ['p', transport],
          ],
        }),
      ),
      frame(envelope({ content: '!' + 'A'.repeat(131) })),
    ]) {
      expect(
        readTranslationAlertEnvelope(rejected, connection, now),
      ).toBeUndefined();
    }
  });
});
