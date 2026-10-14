import mongoose, { type PipelineStage } from 'mongoose';
import type { ExperienceCountRequest } from '../../shared/experience.js';
import userMiniService from '../../../users/server/services/user-mini.server.service.mjs';
import { prepareExperienceCount } from '../services/experience-payload.server.service.mts';
import {
  isValidExperienceCountUserTo,
  type ExperienceCountAggregateGroup,
  type ExperienceCountNext,
  type ExperienceCountProcessResponses,
  type ExperienceCountRequestHandlerRequest,
  type ExperienceCountResponseWriter,
} from './experience-count.server.contracts.mts';

const Experience = mongoose.model('Experience');

interface ExperienceCountTotals {
  publicCount: number;
  privateCount: number;
}

export async function getExperienceCount(
  req: ExperienceCountRequestHandlerRequest,
  res: ExperienceCountResponseWriter,
  next: ExperienceCountNext,
  processResponses: ExperienceCountProcessResponses,
): Promise<unknown> {
  const { userTo } = req.query;

  if (!isValidExperienceCountUserTo(userTo)) {
    return res
      .status(400)
      .send({ message: 'Missing or invalid `userTo` request param' });
  }

  try {
    const request: ExperienceCountRequest = { userTo };
    const isSelf = req.user._id.equals(request.userTo);
    const visibilityStages: PipelineStage[] =
      userMiniService.visibleUserLookupStages({
        localField: 'userFrom',
        as: 'author',
      });
    const pipeline: PipelineStage[] = [
      {
        $match: {
          userTo: new mongoose.Types.ObjectId(request.userTo),
          removedAt: { $exists: false },
          ...(isSelf ? {} : { public: true }),
        },
      },
      ...visibilityStages,
      { $group: { _id: '$public', count: { $sum: 1 } } },
    ];
    const groups =
      await Experience.aggregate<ExperienceCountAggregateGroup>(
        pipeline,
      ).exec();
    const counts = groups.reduce<ExperienceCountTotals>(
      (result, group) => {
        result[group._id ? 'publicCount' : 'privateCount'] = group.count;
        return result;
      },
      { publicCount: 0, privateCount: 0 },
    );

    return res
      .status(200)
      .json(
        prepareExperienceCount(counts.publicCount, counts.privateCount, isSelf),
      );
  } catch (error: unknown) {
    return processResponses(res, next, error);
  }
}
