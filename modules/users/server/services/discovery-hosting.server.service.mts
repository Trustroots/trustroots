import mongoose, { type Types } from 'mongoose';

interface DiscoveryOffer {
  user: Types.ObjectId;
  locationFuzzy: [number, number];
}

export async function findDiscoveryHostingLocations(
  ownerIDs: Types.ObjectId[],
  sharedCircleOwnerIDs: Types.ObjectId[],
  now: Date,
) {
  if (!ownerIDs.length) return new Map<string, [number, number]>();

  const offers = await mongoose
    .model<DiscoveryOffer>('Offer')
    .find({
      user: { $in: ownerIDs },
      type: 'host',
      status: { $in: ['yes', 'maybe'] },
      locationFuzzy: { $size: 2 },
      $and: [
        {
          $or: [
            { validUntil: { $gte: now } },
            { validUntil: { $exists: false } },
          ],
        },
        {
          $or: [
            { showOnlyInMyCircles: { $ne: true } },
            { user: { $in: sharedCircleOwnerIDs } },
          ],
        },
      ],
    })
    .select('user locationFuzzy')
    .sort({ updated: -1, _id: 1 })
    .maxTimeMS(1000)
    .lean()
    .exec();

  const locations = new Map<string, [number, number]>();
  for (const { user, locationFuzzy } of offers) {
    const id = user.toString();
    const [lat, lon] = locationFuzzy;
    if (
      !locations.has(id) &&
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lon) <= 180
    ) {
      locations.set(id, locationFuzzy);
    }
  }
  return locations;
}
