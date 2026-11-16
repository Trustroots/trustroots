import type { Request, Response } from 'express';
import mongoose, { type Types } from 'mongoose';
import {
  checkGravatarPhoto,
  clearMissingGravatar,
} from '../../../users/server/services/gravatar-cleanup.server.service.mts';
import type { GravatarPhotoCheck } from '../../shared/gravatar-photo-check.mts';

const User = mongoose.model('User');
let currentCheck: GravatarPhotoCheck | null = null;

interface CheckMember {
  _id: Types.ObjectId;
  emailHash?: string;
  avatarVersion?: string;
}

async function run(check: GravatarPhotoCheck): Promise<void> {
  try {
    const cleanup = check.retired !== undefined;
    const members = User.find({ avatarSource: 'gravatar' })
      .select(
        cleanup ? { emailHash: 1, avatarVersion: 1 } : { emailHash: 1, _id: 0 },
      )
      .lean<CheckMember[]>()
      .cursor({ batchSize: 50 });
    for await (const member of members) {
      const outcome = await checkGravatarPhoto(member.emailHash);
      check.counts[outcome]++;
      if (
        check.retired !== undefined &&
        outcome === 'unavailable' &&
        (await clearMissingGravatar(member))
      ) {
        check.retired++;
      }
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

export function startPhotoCheck(req: Request, res: Response): void {
  if (currentCheck?.state !== 'running') {
    currentCheck = {
      state: 'running',
      startedAt: new Date().toISOString(),
      counts: { available: 0, unavailable: 0, inconclusive: 0 },
      ...(req.query.cleanup === '1' && { retired: 0 }),
    };
    void run(currentCheck);
  }
  res.status(202).json(currentCheck);
}
