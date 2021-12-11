export type OffersData = {
  features: Feature[];
  type: string;
}

export type Feature = {
  type: string;
  properties: OfferProperties;
  geometry: Geometry;
}

export type Geometry = {
  coordinates: number[];
  type: string;
}

export type OfferProperties = {
  id: string;
  status: string;
  type: string;
  offer: string;
}

// Correct naming?
export type Offer = {
  _id: string;
  type: string;
  status: string;
  user: User;
  description: string;
  noOfferDescription: string;
  maxGuests: number;
  location: number[];
  updated: string;
  showOnlyInMyCircles: boolean;
}


export type User = {
  tagline: string;
  gender: string;
  avatarSource: string;
  avatarUploaded: boolean;
  _id: string;
  emailHash: string;
  displayName: string;
  username: string;
  member: Member[];
  birthdate: string;
  updated: string;
}

export type Member = {
  since: string;
  tribe: Tribe;
}

export type Tribe = {
  count: number;
  image: boolean;
  slug: string;
  _id: string;
  label: string;
  color: string;
  description: string;
  created: string;
  attribution: string;
  attribution_url: string;
}