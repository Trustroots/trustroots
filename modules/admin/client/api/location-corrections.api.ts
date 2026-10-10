import axios from 'axios';

export type LocationCorrectionMatch = 'exact' | 'nearby';

export interface LocationCorrectionOffer {
  _id: string;
  type: 'host' | 'meet';
  location: [number, number];
  match?: LocationCorrectionMatch;
  updated?: string;
}

export interface LocationCorrectionCandidate {
  userId: string;
  username: string;
  displayName?: string;
  key: string;
  match: LocationCorrectionMatch;
  offers: LocationCorrectionOffer[];
}

export interface LocationCorrectionSendResult {
  sent: boolean;
  messageId?: string;
  message?: string;
}

export async function getLocationCorrections(): Promise<
  LocationCorrectionCandidate[]
> {
  const { data } = await axios.get('/api/admin/location-corrections');
  return data as LocationCorrectionCandidate[];
}

export async function sendLocationCorrection(
  userId: string,
  key: string,
  content: string,
): Promise<LocationCorrectionSendResult> {
  const { data } = await axios.post('/api/admin/location-corrections/send', {
    userId,
    key,
    content,
  });
  return data as LocationCorrectionSendResult;
}
