import axios, {
  getErrorResponse,
} from '../../../core/client/api/http-client.js';
import type { AxiosRequestConfig } from 'axios';
import type {
  CreateOfferRequest,
  OfferMutationResponse,
  OfferPayload,
  OfferReadPayload,
  OfferSearchFeatureCollection,
  UpdateOfferRequest,
} from '../../shared/offer.js';

export type {
  CreateOfferRequest,
  OfferMutationResponse,
  OfferPayload,
  OfferReadPayload,
  OfferSearchFeatureCollection,
  OfferType,
  UpdateOfferRequest,
} from '../../shared/offer.js';

/** @deprecated Use OfferPayload for read responses and request-specific types. */
export type Offer = Partial<OfferPayload>;

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
): Promise<OfferPayload[]> {
  try {
    const { data } = await axios.get<OfferPayload[]>(
      `/api/offers-by/${userId}`,
      {
        ...requestOptions,
        params: { ...requestOptions.params, types },
      },
    );
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
 * API request: read an offer by id with its populated owner profile.
 * @param {int} offerId - id of offer
 * @returns Promise<OfferReadPayload> - the offer and populated owner profile
 */
export async function getOffer(offerId: string): Promise<OfferReadPayload> {
  const { data } = await axios.get<OfferReadPayload>(`/api/offers/${offerId}`);
  return data;
}

/**
 * API request: query for offers by search arguments, including bounding-box coordinates and filters.
 * @param {int} offerId - id of offer
 * @returns Promise<OfferSearchFeatureCollection> - matching offers as GeoJSON
 */
export async function queryOffers(
  query: OfferQuery = {},
): Promise<OfferSearchFeatureCollection> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });
  const { data } = await axios.get<OfferSearchFeatureCollection>(
    `/api/offers?${params}`,
  );
  return data;
}

export async function createOffer(
  payload: CreateOfferRequest,
): Promise<OfferMutationResponse> {
  const { data } = await axios.post<OfferMutationResponse>(
    '/api/offers',
    payload,
  );
  return data;
}

export async function updateOffer(
  offerId: string,
  payload: UpdateOfferRequest,
): Promise<OfferMutationResponse> {
  const { data } = await axios.put<OfferMutationResponse>(
    `/api/offers/${offerId}`,
    payload,
  );
  return data;
}

export async function deleteOffer(
  offerId: string,
): Promise<OfferMutationResponse> {
  const { data } = await axios.delete<OfferMutationResponse>(
    `/api/offers/${offerId}`,
  );
  return data;
}
