import { differenceInYears, subMonths } from 'date-fns';
import type { PipelineStage, Types } from 'mongoose';
import {
  userMiniProjection,
  visibleUserLookupStages,
} from '../../../users/server/services/user-mini.server.service.mts';
import type { PlaceHostPage, PlaceHostResult } from '../../shared/offer.js';

export type PlaceHostSearchDocument = Omit<
  PlaceHostResult<Types.ObjectId, Date>,
  'user' | 'age'
> & {
  user: PlaceHostResult<Types.ObjectId, Date>['user'] & {
    birthdate?: Date | null;
  };
};

type SearchAggregate = (
  stages: PipelineStage[],
) => Promise<PlaceHostSearchDocument[]>;

const pageSize = 30;

const countPublicExperiences: PipelineStage[] = [
  {
    $lookup: {
      from: 'experiences',
      let: { host: '$user._id' },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ['$userTo', '$$host'] },
            public: true,
            removedAt: { $exists: false },
          },
        },
        ...visibleUserLookupStages({ localField: 'userFrom', as: 'author' }),
        { $count: 'total' },
      ],
      as: 'experienceCounts',
    },
  },
  {
    $set: {
      experienceCount: {
        $ifNull: [{ $arrayElemAt: ['$experienceCounts.total', 0] }, 0],
      },
    },
  },
];

export async function listPlaceHosts(
  aggregate: SearchAggregate,
  offerStages: PipelineStage[],
  query: Record<string, unknown>,
): Promise<PlaceHostPage<Types.ObjectId, Date>> {
  const offset = typeof query.offset === 'string' ? Number(query.offset) : 0;
  const start = Number.isSafeInteger(offset) ? Math.max(offset, 0) : 0;
  const byExperience = query.sort === 'experiences';
  const nameOrder = { sortName: 1, 'user.username': 1, _id: 1 } as const;
  const now = new Date();

  const results = await aggregate([
    ...offerStages,
    ...(byExperience ? countPublicExperiences : []),
    {
      $set: {
        sortName: {
          $toLower: {
            $cond: [
              { $eq: [{ $ifNull: ['$user.displayName', ''] }, ''] },
              '$user.username',
              '$user.displayName',
            ],
          },
        },
      },
    },
    {
      $sort: {
        ...(byExperience && { experienceCount: -1 }),
        ...(query.sort === 'activity' && { 'user.seen': -1 }),
        ...nameOrder,
      },
    },
    { $skip: start },
    { $limit: pageSize + 1 },
    ...(!byExperience ? countPublicExperiences : []),
    {
      $project: {
        type: 1,
        status: 1,
        volunteering: 1,
        location: '$locationFuzzy',
        user: userMiniProjection('$user', { birthdate: '$user.birthdate' }),
        experienceCount: 1,
        activity: {
          $switch: {
            branches: [
              {
                case: {
                  $gte: ['$user.seen', subMonths(now, 1)],
                },
                then: 'past-month',
              },
              {
                case: {
                  $gte: ['$user.seen', subMonths(now, 6)],
                },
                then: 'past-six-months',
              },
              {
                case: {
                  $gte: ['$user.seen', subMonths(now, 24)],
                },
                then: 'past-two-years',
              },
            ],
            default: 'older',
          },
        },
      },
    },
  ]);

  const offers = results
    .slice(0, pageSize)
    .map(({ user: { birthdate, ...user }, ...offer }) => ({
      ...offer,
      user,
      ...(birthdate && { age: differenceInYears(now, birthdate) }),
    }));

  if (results.length > pageSize) {
    return { offers, nextOffset: start + pageSize };
  }
  return { offers };
}
