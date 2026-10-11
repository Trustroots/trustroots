import crypto from 'crypto';
import mongoose from 'mongoose';
import config from '../../../../config/config.mjs';
import * as nip19 from 'nostr-tools/nip19';
import { validateEvent, verifyEvent } from 'nostr-tools';
import profiles from './users.profile.server.controller.mjs';

const User = mongoose.model('User');
const challengeLifetimeMs = 60 * 1000;
const verificationPath = '/api/users/nostr/verify';

function verificationUrl() {
  return `${config.https ? 'https' : 'http'}://${
    config.domain
  }${verificationPath}`;
}

function sendBadRequest(res) {
  return res.status(400).send({ message: 'Invalid or expired Nostr proof.' });
}

function getSavedPubkey(npub) {
  try {
    const decoded = nip19.decode(npub);
    return decoded.type === 'npub' ? decoded.data : null;
  } catch {
    return null;
  }
}

function hasExactTags(event, url, nonce) {
  if (event.tags.length !== 3) return false;
  const expected = new Map([
    ['u', url],
    ['method', 'POST'],
    ['challenge', nonce],
  ]);
  for (const tag of event.tags) {
    if (tag.length !== 2 || !expected.has(tag[0])) {
      return false;
    }
    if (expected.get(tag[0]) !== tag[1]) return false;
    expected.delete(tag[0]);
  }
  return true;
}

const service = {};

service.challenge = async function (req, res) {
  if (!req.user) return res.sendStatus(403);
  const npub = req.user.nostrNpub;
  const pubkey = npub && getSavedPubkey(npub);
  if (!pubkey) {
    return res
      .status(400)
      .send({ message: 'Save a valid Nostr public key first.' });
  }

  const now = Date.now();
  const expiresAt = new Date(now + challengeLifetimeMs);
  const nonce = crypto.randomBytes(32).toString('hex');
  let user;
  try {
    user = await User.findOneAndUpdate(
      { _id: req.user._id, nostrNpub: npub },
      {
        $set: { nostrChallenge: nonce, nostrChallengeExpiresAt: expiresAt },
      },
      { new: true },
    );
  } catch {
    return res
      .status(503)
      .send({ message: 'Nostr verification is unavailable.' });
  }
  if (!user) return sendBadRequest(res);

  return res.json({
    event: {
      kind: 27235,
      created_at: Math.floor(now / 1000),
      content: '',
      tags: [
        ['u', verificationUrl()],
        ['method', 'POST'],
        ['challenge', nonce],
      ],
    },
    expiresAt: expiresAt.toISOString(),
  });
};

service.verify = async function (req, res) {
  if (!req.user) return res.sendStatus(403);
  const event = req.body && req.body.event;
  const npub = req.user.nostrNpub;
  const expectedPubkey = npub && getSavedPubkey(npub);
  if (
    !expectedPubkey ||
    !event ||
    !validateEvent(event) ||
    event.kind !== 27235 ||
    event.content !== '' ||
    !Number.isSafeInteger(event.created_at) ||
    event.pubkey !== expectedPubkey ||
    typeof event.id !== 'string' ||
    typeof event.sig !== 'string' ||
    Math.abs(Math.floor(Date.now() / 1000) - event.created_at) > 60
  ) {
    return sendBadRequest(res);
  }
  const nonceTag = event.tags.find(tag => tag[0] === 'challenge');
  if (
    !nonceTag ||
    typeof nonceTag[1] !== 'string' ||
    !hasExactTags(event, verificationUrl(), nonceTag[1])
  ) {
    return sendBadRequest(res);
  }
  if (!verifyEvent(event)) return sendBadRequest(res);

  const now = new Date();
  let user;
  try {
    user = await User.findOneAndUpdate(
      {
        _id: req.user._id,
        nostrNpub: npub,
        nostrChallenge: nonceTag[1],
        nostrChallengeExpiresAt: { $gt: now },
      },
      {
        $set: { nostrVerifiedNpub: npub, nostrVerifiedAt: now },
        $unset: { nostrChallenge: 1, nostrChallengeExpiresAt: 1 },
      },
      { new: true, projection: '+nostrVerifiedNpub +nostrVerifiedAt' },
    );
  } catch {
    return res
      .status(503)
      .send({ message: 'Nostr verification is unavailable.' });
  }
  if (!user) return sendBadRequest(res);
  return res.json(profiles.sanitizeOwnProfile(user));
};

export default service;
export { service as 'module.exports' };
