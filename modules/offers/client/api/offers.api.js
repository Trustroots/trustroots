import axios from 'axios';

/**
 * API request: read user's offers
 * @param {int} userId - id of user
 * @returns Promise<Offer[]> - array of the found offers
 */
export async function getOffers(userId, types) {
  try {
    const { data } = await axios.get(`api/offers-by/${userId}`, {
      params: { types },
    });
    return data;
  } catch (e) {
    /*
     * @TODO i'd expect the api to work as follows:
     * GET /api/users/userId/offers?types=host
     * (the request url is arbitrary, so /api/offers-by/userId is fine, too)
     * and return 404 when user not found
     * but [] when user exists but has no host offers
     */
    if (e?.response?.status === 404) {
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
export async function getOffer(offerId) {
  const { data } = await axios.get(`/api/offers/${offerId}`);
  return data;
}

/**
 * API request: query for offers by search arguments, namely bounding box location coordinates and other search filters
 * @param {int} offerId - id of offer
 * @returns Promise<Offer[]> - array of the found offers with limited info, mainly offer id and type.
 */
export async function queryOffers(query = {}) {
  const { data } = await axios.get(`/api/offers?${new URLSearchParams(query)}`);
  return data;
}
