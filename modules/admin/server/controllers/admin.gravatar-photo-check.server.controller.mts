import { setTimeout as delay } from 'node:timers/promises';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import type { GravatarPhotoCheck } from '../../shared/gravatar-photo-check.mts';

const User = mongoose.model('User');
const REQUEST_INTERVAL_MS = 250;
const REQUEST_TIMEOUT_MS = 5000;
let currentCheck: GravatarPhotoCheck | null = null;

async function checkPhoto(
  hash: unknown,
): Promise<keyof GravatarPhotoCheck['counts']> {
  if (
    typeof hash !== 'string' ||
    !/^(?:[a-f0-9]{32}|[a-f0-9]{64})$/i.test(hash)
  ) {
    return 'inconclusive';
  }

  const [response] = await Promise.all([
    fetch(`https://gravatar.com/avatar/${hash}?s=32&d=404`, {
      method: 'HEAD',
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch(() => undefined),
    delay(REQUEST_INTERVAL_MS),
  ]);
  if (response?.status === 404) return 'unavailable';
  if (
    response?.status === 200 &&
    response.headers.get('content-type')?.startsWith('image/')
  ) {
    return 'available';
  }
  return 'inconclusive';
}

async function run(check: GravatarPhotoCheck): Promise<void> {
  try {
    const members = User.find({ avatarSource: 'gravatar' })
      .select({ emailHash: 1, _id: 0 })
      .lean<{ emailHash?: unknown }[]>()
      .cursor({ batchSize: 50 });
    for await (const member of members) {
      const outcome = await checkPhoto(member.emailHash);
      check.counts[outcome]++;
    }
    check.state = 'complete';
  } catch {
    check.state = 'failed';
  }
  check.finishedAt = new Date().toISOString();
}

export function getPhotoCheck(_req: Request, res: Response): void {
  res.set('Cache-Control', 'no-store').json(currentCheck);
}

export function startPhotoCheck(_req: Request, res: Response): void {
  if (currentCheck?.state !== 'running') {
    currentCheck = {
      state: 'running',
      startedAt: new Date().toISOString(),
      counts: { available: 0, unavailable: 0, inconclusive: 0 },
    };
    void run(currentCheck);
  }
  res.status(202).json(currentCheck);
}
