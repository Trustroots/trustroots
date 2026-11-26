import mongoose, { type Types } from 'mongoose';

type ExportRecord = Record<string, unknown>;

interface ExportOfferRecord extends ExportRecord {
  _id: unknown;
  type: unknown;
  user: unknown;
  location: unknown;
  status?: unknown;
  description?: unknown;
  noOfferDescription?: unknown;
  maxGuests?: unknown;
  updated?: unknown;
  validUntil?: unknown;
  showOnlyInMyCircles?: unknown;
  createdAt?: unknown;
}

function selectOwnedOffer(offer: ExportOfferRecord): ExportRecord {
  return {
    _id: offer._id,
    type: offer.type,
    user: offer.user,
    location: offer.location,
    ...(offer.status === undefined ? {} : { status: offer.status }),
    ...(offer.description === undefined
      ? {}
      : { description: offer.description }),
    ...(offer.noOfferDescription === undefined
      ? {}
      : { noOfferDescription: offer.noOfferDescription }),
    ...(offer.maxGuests === undefined ? {} : { maxGuests: offer.maxGuests }),
    ...(offer.updated === undefined ? {} : { updated: offer.updated }),
    ...(offer.validUntil === undefined ? {} : { validUntil: offer.validUntil }),
    ...(offer.showOnlyInMyCircles === undefined
      ? {}
      : { showOnlyInMyCircles: offer.showOnlyInMyCircles }),
    ...(offer.createdAt === undefined ? {} : { createdAt: offer.createdAt }),
  };
}

export async function readOwnedOffers(
  userId: string | Types.ObjectId,
): Promise<ExportRecord[]> {
  const Offer = mongoose.model<ExportOfferRecord>('Offer');
  const offers = await Offer.find({ user: userId })
    .sort({ createdAt: 1 })
    .lean<ExportOfferRecord[]>();
  return offers.map(selectOwnedOffer);
}
