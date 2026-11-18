import { setTimeout as delay } from 'node:timers/promises';
import mongoose, { type Types } from 'mongoose';
import log from '@trustroots/logger';
import type {
  UserServerModel,
  UserServerRecord,
} from '../models/user.server.types.mts';

const REQUEST_INTERVAL_MS = 250;
const REQUEST_TIMEOUT_MS = 5000;
const PROFILE_RECHECK_INTERVAL_MS = 60 * 60 * 1000;
const MAX_PENDING_PROFILES = 50;
const MAX_RECENT_PROFILES = 2048;
const hashPattern = /^(?:[a-f0-9]{32}|[a-f0-9]{64})$/i;

interface AvatarSnapshot {
  _id: Types.ObjectId;
  emailHash?: string;
  avatarVersion?: string | null;
}

let nextRequestAt = 0;
let profileQueue = Promise.resolve();
const pendingProfiles = new Set<string>();
const recentProfiles = new Map<string, number>();

function isGravatarHash(hash: unknown): hash is string {
  return typeof hash === 'string' && hashPattern.test(hash);
}

export async function checkGravatarPhoto(
  hash: unknown,
): Promise<'available' | 'unavailable' | 'inconclusive'> {
  if (!isGravatarHash(hash)) {
    return 'inconclusive';
  }

  const now = Date.now();
  const startAt = Math.max(now, nextRequestAt);
  nextRequestAt = startAt + REQUEST_INTERVAL_MS;
  if (startAt > now) await delay(startAt - now);

  const response = await fetch(
    `https://gravatar.com/avatar/${hash}?s=32&d=404`,
    {
      method: 'HEAD',
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  ).catch(() => undefined);
  if (response?.status === 404) return 'unavailable';
  if (
    response?.status === 200 &&
    response.headers.get('content-type')?.startsWith('image/')
  ) {
    return 'available';
  }
  return 'inconclusive';
}

export async function clearMissingGravatar({
  _id,
  emailHash,
  avatarVersion,
}: AvatarSnapshot): Promise<boolean> {
  const User = mongoose.model<UserServerRecord, UserServerModel>('User');
  const { modifiedCount } = await User.updateOne(
    {
      _id,
      avatarSource: 'gravatar',
      emailHash,
      avatarVersion: avatarVersion ?? null,
    },
    { $set: { avatarSource: 'none' } },
  ).exec();
  return modifiedCount === 1;
}

export function queueProfileGravatarCheck(
  profile: AvatarSnapshot & { avatarSource?: string },
): void {
  if (
    profile.avatarSource !== 'gravatar' ||
    !isGravatarHash(profile.emailHash) ||
    pendingProfiles.size >= MAX_PENDING_PROFILES
  ) {
    return;
  }
  const key = String(profile._id);
  if (pendingProfiles.has(key) || (recentProfiles.get(key) ?? 0) > Date.now()) {
    return;
  }

  pendingProfiles.add(key);
  profileQueue = profileQueue
    .then(async () => {
      if ((await checkGravatarPhoto(profile.emailHash)) === 'unavailable') {
        await clearMissingGravatar(profile);
      }
    })
    .catch(() => {
      log('error', 'Could not update a profile with a missing Gravatar image.');
    })
    .finally(() => {
      pendingProfiles.delete(key);
      recentProfiles.delete(key);
      recentProfiles.set(key, Date.now() + PROFILE_RECHECK_INTERVAL_MS);
      if (recentProfiles.size > MAX_RECENT_PROFILES) {
        recentProfiles.delete(recentProfiles.keys().next().value!);
      }
    });
}
