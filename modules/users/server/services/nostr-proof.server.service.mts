import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { nip19, validateEvent, verifyEvent, type Event } from 'nostr-tools';
import config from '../../../../config/config.mts';
import { hashToken } from './action-token.server.service.mts';
import type {
  UserServerRecord,
  UserServerModel,
} from '../models/user.server.types.mts';

const User = mongoose.model<UserServerRecord, UserServerModel>('User');
const lifetime = 300;
export const proofError =
  'Sign a fresh Nostr challenge with the matching key before saving.';

export function decodeNpub(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid Nostr public key.');
  const decoded = nip19.decode(value.trim().toLowerCase());
  if (decoded.type !== 'npub') throw new Error('Invalid Nostr public key.');
  return decoded.data;
}

function endpoint() {
  return `${config.https ? 'https' : 'http'}://${config.domain}/api/users`;
}

export async function createChallenge(
  userId: mongoose.Types.ObjectId,
  npub: unknown,
) {
  const pubkey = decodeNpub(npub);
  const nonce = crypto.randomBytes(32).toString('hex');
  const createdAt = Math.floor(Date.now() / 1000);
  const result = await User.updateOne(
    { _id: userId },
    {
      $set: {
        nostrChallenge: hashToken(pubkey + nonce),
        nostrChallengeExpiresAt: new Date((createdAt + lifetime) * 1000),
      },
    },
  );
  if (!result.matchedCount) throw new Error(proofError);
  return {
    kind: 27235,
    created_at: createdAt,
    content: '',
    tags: [
      ['u', endpoint()],
      ['method', 'PUT'],
      ['challenge', nonce],
    ],
  };
}

export async function consumeProof(
  userId: mongoose.Types.ObjectId,
  npub: string,
  value: unknown,
): Promise<boolean> {
  const pubkey = decodeNpub(npub);
  if (!validateEvent(value) || !('id' in value) || !('sig' in value))
    return false;
  const event = value as Event;
  const now = Math.floor(Date.now() / 1000);
  if (
    event.kind !== 27235 ||
    event.content !== '' ||
    event.pubkey !== pubkey ||
    !Number.isSafeInteger(event.created_at) ||
    event.created_at > now + 30 ||
    event.created_at < now - lifetime ||
    event.tags.length !== 3
  )
    return false;
  const nonce = event.tags.find(tag => tag[0] === 'challenge')?.[1];
  if (!nonce || !/^[0-9a-f]{64}$/.test(nonce)) return false;
  const expected = new Map([
    ['u', endpoint()],
    ['method', 'PUT'],
    ['challenge', nonce],
  ]);
  for (const tag of event.tags) {
    if (tag.length !== 2 || expected.get(tag[0]) !== tag[1]) return false;
    expected.delete(tag[0]);
  }
  // Reconstruct from JSON fields so a cached verification symbol cannot bypass verification.
  if (
    !verifyEvent({
      id: event.id,
      sig: event.sig,
      pubkey: event.pubkey,
      kind: event.kind,
      created_at: event.created_at,
      content: event.content,
      tags: event.tags,
    })
  )
    return false;
  const consumed = await User.updateOne(
    {
      _id: userId,
      nostrChallenge: hashToken(pubkey + nonce),
      nostrChallengeExpiresAt: { $gt: new Date() },
    },
    { $unset: { nostrChallenge: 1, nostrChallengeExpiresAt: 1 } },
  );
  return consumed.modifiedCount === 1;
}
