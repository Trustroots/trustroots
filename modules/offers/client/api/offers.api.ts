import axios, {
  getErrorResponse,
} from '../../../core/client/api/http-client.js';
import type { AxiosRequestConfig } from 'axios';

export interface Offer {
  _id?: string;
  description?: string;
  location?: [number, number];
  maxGuests?: number;
  noOfferDescription?: string;
  showOnlyInMyCircles?: boolean;
  status?: 'maybe' | 'no' | 'yes';
  type?: 'host' | 'meet';
  validUntil?: string | number | Date;
  [key: string]: unknown;
}

export type OfferQuery = Record<string, string | number | boolean | undefined>;
type OfferRequestOptions = AxiosRequestConfig & {
  params?: Record<string, unknown>;
};

/**
 * API request: read user's offers
 * @param {int} userId - id of user
 * @returns Promise<Offer[]> - array of the found offers
 */
export async function getOffers(
  userId: string,
  types: string | string[],
  requestOptions: OfferRequestOptions = {},
): Promise<Offer[]> {
  try {
    const { data } = await axios.get(`/api/offers-by/${userId}`, {
      ...requestOptions,
      params: { ...requestOptions.params, types },
    });
    return data;
  } catch (e: unknown) {
    /*
     * @TODO i'd expect the api to work as follows:
     * GET /api/users/userId/offers?types=host
     * (the request url is arbitrary, so /api/offers-by/userId is fine, too)
     * and return 404 when user not found
     * but [] when user exists but has no host offers
     */
    if (getErrorResponse(e)?.status === 404) {
      return [];
    } else {
      throw e;
    }
  }
}

/**
 * API request: reade offer by id
 * @param {int} offerId - id of offer
 * @returns Promise<Offer> - a single offer
 */
export async function getOffer(offerId: string): Promise<Offer> {
  const { data } = await axios.get(`/api/offers/${offerId}`);
  return data;
}

/**
 * API request: query for offers by search arguments, namely bounding box location coordinates and other search filters
 * @param {int} offerId - id of offer
 * @returns Promise<Offer[]> - array of the found offers with limited info, mainly offer id and type.
 */
export async function queryOffers(query: OfferQuery = {}): Promise<Offer[]> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });
  const { data } = await axios.get(`/api/offers?${params}`);
  return data;
}

export async function createOffer(payload: Offer) {
  const { data } = await axios.post('/api/offers', payload);
  return data;
}

export async function updateOffer(offerId: string, payload: Offer) {
  const { data } = await axios.put(`/api/offers/${offerId}`, payload);
  return data;
}

export async function deleteOffer(offerId: string) {
  const { data } = await axios.delete(`/api/offers/${offerId}`);
  return data;
}
