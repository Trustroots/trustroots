import type { QueryFilter, Model, Types } from 'mongoose';
import type { UserServerRecord } from '../models/user.server.types.mts';
import { initialConnectionHistoryState } from './connection-history.server.service.mts';

const selectedFields =
  '+connectionHistory +connectionSearchKeys +connectionHistoryInitialised +connectionHistoryRevision ' +
  'email extSitesCouchers extSitesBW extSitesCS extSitesWS extSitesServas nostrNpub additionalProvidersData';

const identityPaths = [
  'email',
  'extSitesCouchers',
  'extSitesBW',
  'extSitesCS',
  'extSitesWS',
  'extSitesServas',
  'nostrNpub',
  'additionalProvidersData',
] as const;

function identityFilter(record: UserServerRecord): Record<string, unknown> {
  return Object.fromEntries(
    identityPaths.map(path => {
      const value = path.split('.').reduce<unknown>((current, part) => {
        if (!current || typeof current !== 'object') return undefined;
        return (current as Record<string, unknown>)[part];
      }, record);
      return [path, value === undefined ? { $exists: false } : value];
    }),
  );
}

/**
 * Initialise one existing user's baseline with a conditional write. Re-read
 * after CAS misses so concurrent profile writes win and deleted users are
 * skipped. The marker makes repeated runs idempotent.
 */
export async function initialiseConnectionHistoryForUser(
  User: Model<UserServerRecord>,
  userId: Types.ObjectId,
): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const record = await User.findById(userId)
      .select(selectedFields)
      .lean<UserServerRecord>()
      .exec();
    if (!record || record.connectionHistoryInitialised) return false;

    const revision = record.connectionHistoryRevision;
    const state = initialConnectionHistoryState(record);
    const filter = {
      _id: userId,
      connectionHistoryInitialised: { $ne: true },
      ...(revision === undefined
        ? { connectionHistoryRevision: { $exists: false } }
        : { connectionHistoryRevision: revision }),
      ...identityFilter(record),
    } as QueryFilter<UserServerRecord>;
    const result = await User.updateOne(filter, {
      $set: {
        ...state,
        connectionHistoryInitialised: true,
        connectionHistoryRevision: (revision || 0) + 1,
      },
    }).exec();
    if (result.matchedCount === 1) return true;
  }

  throw new Error(
    'Could not initialise external connection history after retries.',
  );
}

export async function backfillConnectionHistory(
  User: Model<UserServerRecord>,
): Promise<number> {
  const cursor = User.find({ connectionHistoryInitialised: { $ne: true } })
    .select(selectedFields)
    .lean<UserServerRecord>()
    .cursor();
  let initialisedCount = 0;
  try {
    for await (const record of cursor) {
      if (await initialiseConnectionHistoryForUser(User, record._id)) {
        initialisedCount += 1;
      }
    }
    return initialisedCount;
  } finally {
    await cursor.close();
  }
}
