import mongoose, { type Types } from 'mongoose';
import { findConfirmedContactIds } from '../../../contacts/server/services/confirmed-contacts.server.service.mts';
import type { ExperienceRecord } from '../models/experiences.server.model.mts';

export async function findSearchConnectionIds(
  viewerId: Types.ObjectId,
): Promise<Types.ObjectId[]> {
  const [contacts, experiences] = await Promise.all([
    findConfirmedContactIds(viewerId),
    mongoose
      .model<ExperienceRecord>('Experience')
      .find(
        {
          recommend: { $in: ['yes', 'no'] },
          removedAt: { $exists: false },
          $or: [{ userFrom: viewerId }, { userTo: viewerId, public: true }],
        },
        { _id: 0, userFrom: 1, userTo: 1, recommend: 1 },
      )
      .lean()
      .maxTimeMS(2000)
      .exec(),
  ]);

  const connections = new Map(contacts.map(id => [id.toString(), id]));
  const excluded = new Set<string>();
  for (const { userFrom, userTo, recommend } of experiences) {
    const other = userFrom.equals(viewerId) ? userTo : userFrom;
    if (recommend === 'yes') {
      connections.set(other.toString(), other);
    } else {
      excluded.add(other.toString());
    }
  }
  for (const id of excluded) {
    connections.delete(id);
  }
  return [...connections.values()];
}
