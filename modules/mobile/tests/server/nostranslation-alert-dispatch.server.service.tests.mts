import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import { describe, expect, it, vi } from 'vitest';
import { dispatchTranslationAlert } from '../../server/services/nostranslation-alert-dispatch.server.service.mts';

const timestamp = 1_800_000_000;
const subscription = 'fixture-alerts';
const key = generateSecretKey();
const recipient = getPublicKey(generateSecretKey());
const event = finalizeEvent(
  {
    kind: 24133,
    created_at: timestamp,
    tags: [['p', recipient]],
    content: 'A'.repeat(132),
  },
  key,
);
const message = JSON.stringify(['EVENT', subscription, event]);

describe('Dispatching Nostranslation alerts', () => {
  it('delivers a verified envelope only once to each active destination', async () => {
    const first = { id: 'first-device' };
    const second = { id: 'second-device' };
    const deliveries = new Set<string>();
    const activeDestinations = vi.fn(async () => [first, second]);
    const send = vi.fn();
    const claim = vi.fn(
      async (destination: { id: string }, envelope: { id: string }) => {
        const id = destination.id + ':' + envelope.id;
        if (deliveries.has(id)) return false;
        deliveries.add(id);
        return true;
      },
    );
    const dispatch = {
      activeDestinations,
      send,
      claim,
      now: () => timestamp * 1000,
    };

    await Promise.all([
      dispatchTranslationAlert(message, subscription, dispatch),
      dispatchTranslationAlert(message, subscription, dispatch),
    ]);

    const expiry = new Date((timestamp + 60) * 1000);
    expect(activeDestinations).toHaveBeenCalledWith({
      author: getPublicKey(key),
      recipient,
    });
    expect(claim).toHaveBeenCalledWith(first, event, expiry);
    expect(send.mock.calls).toEqual([
      [first, expiry],
      [second, expiry],
    ]);
  });

  it('ignores invalid traffic and skips alerts that expire during processing', async () => {
    let time = timestamp * 1000;
    const send = vi.fn();
    const claim = vi.fn(async () => {
      time = (timestamp + 60) * 1000;
      return true;
    });
    const activeDestinations = vi.fn(async () => [{ id: 'fixture' }]);
    const dispatch = { activeDestinations, send, claim, now: () => time };

    await dispatchTranslationAlert('invalid', subscription, dispatch);
    expect(activeDestinations).not.toHaveBeenCalled();
    await dispatchTranslationAlert(message, subscription, dispatch);
    expect(claim).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
  });

  it('continues notifying other devices if one transport fails', async () => {
    const error = new Error('Unavailable');
    const activeDestinations = vi.fn(async () => [
      { id: 'first' },
      { id: 'second' },
    ]);
    const claim = vi.fn(async () => true);
    const send = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(undefined);
    await expect(
      dispatchTranslationAlert(message, subscription, {
        activeDestinations,
        claim,
        send,
        now: () => timestamp * 1000,
      }),
    ).rejects.toMatchObject({
      errors: [error],
      message: 'Translation alert delivery failed.',
    });
    expect(send).toHaveBeenCalledTimes(2);
  });
});
