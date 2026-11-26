import mongoose, { type Types } from 'mongoose';

interface DiscoveryOffer {
  user: Types.ObjectId;
  locationFuzzy: [number, number];
  status: 'yes' | 'maybe' | 'no';
}

interface DiscoveryLocation {
  type: 'host' | 'meet';
  location: [number, number];
}

export async function findDiscoveryOfferLocations(
  ownerIDs: Types.ObjectId[],
  sharedCircleOwnerIDs: Types.ObjectId[],
  now: Date,
  { includeMeetings = false }: { includeMeetings?: boolean } = {},
) {
  if (!ownerIDs.length) return new Map<string, DiscoveryLocation>();

  const hosting = { status: { $in: ['yes', 'maybe'] } } as const;
  const meeting = { status: 'no', meetingStatus: 'yes' } as const;

  const offers = await mongoose
    .model<DiscoveryOffer>('Offer')
    .find({
      user: { $in: ownerIDs },
      type: 'host',
      ...(includeMeetings ? { $or: [hosting, meeting] } : hosting),
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
    .select('user locationFuzzy status')
    .sort({ updated: -1, _id: 1 })
    .maxTimeMS(1000)
    .lean()
    .exec();

  const locations = new Map<string, DiscoveryLocation>();
  for (const { user, locationFuzzy, status } of offers) {
    const id = user.toString();
    const [lat, lon] = locationFuzzy;
    const type = status === 'no' ? 'meet' : 'host';
    const existing = locations.get(id);
    if (
      (!existing || (existing.type === 'meet' && type === 'host')) &&
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lon) <= 180
    ) {
      locations.set(id, { type, location: locationFuzzy });
    }
  }
  return locations;
}
