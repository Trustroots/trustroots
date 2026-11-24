import type { RequestHandler } from 'express';
import { Relay } from 'nostr-tools/relay';
import {
  getNostrServiceSigner,
  trustrootsNostrServiceIdentifier,
} from '../../../core/server/services/nostr-service-signer.server.mts';

export const publishServiceProfile: RequestHandler = async (_req, res) => {
  const signer = getNostrServiceSigner();
  if (!signer) {
    res.status(503).json({ message: 'The Nostr service key is unavailable.' });
    return;
  }

  const relay = new Relay('wss://relay.trustroots.org');
  try {
    const event = signer.sign({
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify({
        name: 'Trustroots',
        nip05: trustrootsNostrServiceIdentifier,
      }),
    });
    await relay.connect({ timeout: 5000 });
    await relay.publish(event);
    res.json({ id: event.id });
  } catch {
    res
      .status(502)
      .json({ message: 'The Trustroots relay did not accept the profile.' });
  } finally {
    relay.close();
  }
};
