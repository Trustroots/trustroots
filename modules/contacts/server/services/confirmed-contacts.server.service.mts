import mongoose, { type Types } from 'mongoose';
import type { ContactRecord } from '../models/contacts.server.model.mts';

export async function findConfirmedContactIds(
  userId: Types.ObjectId,
): Promise<Types.ObjectId[]> {
  const contacts = await mongoose
    .model<ContactRecord>('Contact')
    .find(
      {
        confirmed: true,
        $or: [{ userFrom: userId }, { userTo: userId }],
      },
      { _id: 0, userFrom: 1, userTo: 1 },
    )
    .lean()
    .maxTimeMS(2000)
    .exec();

  return contacts.map(({ userFrom, userTo }) =>
    userFrom.equals(userId) ? userTo : userFrom,
  );
}
