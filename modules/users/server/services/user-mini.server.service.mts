import { restrictedMessagingRoles } from './user-roles.server.service.mjs';
import type { PipelineStage } from 'mongoose';

type ProjectionValue = 0 | 1 | string;
type Projection = Record<string, ProjectionValue>;

interface PopulateOptions {
  path: string;
  select: string;
  model: string;
  match?: { roles: { $nin: string[] } };
}

/**
 * Single source of truth for the restricted "mini profile" field set shown
 * next to messages, contacts and experiences.
 *
 * Populate options (`miniUserPopulate`) and aggregation projections
 * (`userMiniProjectionMap`, `userMiniProjection`) are derived from this
 * list, so keep any field changes here and let the consumers follow.
 */
const userMiniProfileFields = [
  'id',
  'updated', // Used as local-avatar cache buster
  'displayName',
  'username',
  'avatarSource',
  'avatarUploaded',
  'avatarVersion',
  'emailHash',
].join(' ');

const miniProjectionMap: Projection = {
  _id: 1,
  updated: 1,
  displayName: 1,
  username: 1,
  avatarSource: 1,
  avatarUploaded: 1,
  avatarVersion: 1,
  emailHash: 1,
};

/**
 * Inclusion map (`{ field: 1 }`) for aggregations projecting a mini
 * profile, optionally extended with module-specific fields
 * @param extraFields Object Additional `{ field: 1 }` entries
 * @return Object Projection map
 */
function userMiniProjectionMap(extraFields: Projection = {}): Projection {
  return {
    ...miniProjectionMap,
    ...extraFields,
  };
}

/**
 * Nested `$project` object (`{ field: '$user.field' }`) for aggregations
 * exposing a joined user document under `prefix`
 * @param prefix String Aggregation field path to the user, defaults to '$user'
 * @param extraFields Object Additional entries in the same nested format
 * @return Object Projection object
 */
function userMiniProjection(
  prefix = '$user',
  extraFields: Projection = {},
): Projection {
  return {
    _id: `${prefix}._id`,
    updated: `${prefix}.updated`,
    displayName: `${prefix}.displayName`,
    username: `${prefix}.username`,
    avatarSource: `${prefix}.avatarSource`,
    avatarUploaded: `${prefix}.avatarUploaded`,
    avatarVersion: `${prefix}.avatarVersion`,
    emailHash: `${prefix}.emailHash`,
    ...extraFields,
  };
}

/**
 * Mongoose populate options for mini profile users
 * @param paths String Populate path(s), e.g. `'userFrom userTo'`
 * @param options Object
 * @param options.excludeRestrictedRoles Boolean Drop users with restricted
 *   roles (suspended, shadowbanned) from the result
 * @return Object Mongoose populate options
 */
function miniUserPopulate(
  paths: string,
  { excludeRestrictedRoles = false }: { excludeRestrictedRoles?: boolean } = {},
): PopulateOptions {
  const populate: PopulateOptions = {
    path: paths,
    select: userMiniProfileFields,
    model: 'User',
  };
  if (excludeRestrictedRoles) {
    populate.match = {
      roles: { $nin: restrictedMessagingRoles as string[] },
    };
  }
  return populate;
}

/**
 * Aggregation stages joining a user document and dropping users with
 * restricted roles (suspended, shadowbanned). Existing records may outlive
 * a moderation action, so listings filter these members out.
 * @param options Object
 * @param options.localField String Field on the source collection holding
 *   the user reference
 * @param options.as String Output field for the joined user
 * @return Array Aggregation stages
 */
function visibleUserLookupStages({
  localField,
  as,
}: {
  localField: string;
  as: string;
}): PipelineStage[] {
  return [
    {
      $lookup: {
        from: 'users',
        localField,
        foreignField: '_id',
        as,
      },
    },
    // Because `$lookup` returns an array with one user `[{userObject}]`,
    // we have to unwind it back to `{userObject}`
    { $unwind: `$${as}` },
    {
      $match: {
        [`${as}.roles`]: { $nin: restrictedMessagingRoles },
      },
    },
  ];
}

const service = {
  userMiniProfileFields,
  userMiniProjectionMap,
  userMiniProjection,
  miniUserPopulate,
  visibleUserLookupStages,
};
export default service;
export {
  userMiniProfileFields,
  userMiniProjectionMap,
  userMiniProjection,
  miniUserPopulate,
  visibleUserLookupStages,
};
export { service as 'module.exports' };
