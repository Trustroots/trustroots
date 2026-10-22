import type { Request, Response } from 'express';
import {
  createChallenge,
  decodeNpub,
} from '../services/nostr-proof.server.service.mts';
import type { UserServerDocument } from '../models/user.server.types.mts';

export async function challenge(
  req: Request & { user?: UserServerDocument },
  res: Response,
) {
  if (!req.user) return res.sendStatus(403);
  try {
    decodeNpub(req.body.nostrNpub);
  } catch {
    return res
      .status(400)
      .json({ message: 'Please provide a valid npub, never an nsec.' });
  }
  try {
    return res.json({
      event: await createChallenge(req.user._id, req.body.nostrNpub),
    });
  } catch {
    return res.status(503).json({
      message: 'Nostr verification is unavailable. Please try again.',
    });
  }
}
